import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function GlobalSearch() {
  const dialog = useRef(null)
  const [open,setOpen] = useState(false)
  const [query,setQuery] = useState('')
  const [result,setResult] = useState({rows:[],loading:false,error:''})
  const navigate = useNavigate()
  useEffect(() => {
    const key = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) } }
    window.addEventListener('keydown',key)
    return () => window.removeEventListener('keydown',key)
  },[])
  useEffect(() => { if (open) dialog.current.showModal(); else dialog.current.close() },[open])
  useEffect(() => {
    if (!open || !query.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/taller/buscar?q=${encodeURIComponent(query.trim())}`, {signal:controller.signal, headers:{Authorization:`Bearer ${localStorage.getItem('token')}`}})
        const data = await response.json()
        if (!response.ok) throw Error(data.message || 'No se pudo buscar.')
        if (!controller.signal.aborted) setResult({rows:data,loading:false,error:''})
      } catch (e) { if (!controller.signal.aborted) setResult({rows:[],loading:false,error:e.message}) }
    },250)
    return () => { clearTimeout(timer); controller.abort() }
  },[query,open])
  const close = () => setOpen(false)
  return <><button className="global-search-trigger" onClick={() => setOpen(true)} aria-label="Buscar órdenes por cliente o matrícula">Buscar en el taller <kbd>Ctrl K</kbd></button>
    <dialog className="global-search-dialog" ref={dialog} onCancel={close} aria-labelledby="search-title">
      <header><h2 id="search-title">Buscar en el taller</h2><button onClick={close} aria-label="Cerrar búsqueda">×</button></header>
      <label>Cliente, matrícula o número de orden<input autoFocus value={query} maxLength={100} onChange={e => {setQuery(e.target.value);setResult({rows:[],loading:!!e.target.value.trim(),error:''})}} placeholder="Ej. L-567890, María o 25"/></label>
      <div className="search-results" aria-live="polite">
        {!query.trim() ? <p>Encuentra una orden y abre su expediente.</p> : result.loading ? <p>Buscando…</p> : result.error ? <p role="alert">{result.error}</p> : !result.rows.length ? <p>No se encontraron órdenes con ese dato.</p> : result.rows.map(o => <button key={o.id} onClick={() => { close(); navigate(`/ordenes/${o.id}/expediente`) }}><span><strong>{o.matricula}</strong><small>{o.nombre_cliente}</small></span><span>#{o.id}<small>{o.estado.replaceAll('_',' ')}</small></span></button>)}
      </div><footer>Hasta 20 coincidencias. Escribe más detalles para afinar la búsqueda.</footer>
    </dialog></>
}
