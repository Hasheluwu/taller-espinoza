import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi as api, currency } from '../lib/workshopApi'
import { deleteOrderDraft, listOrderDrafts, resumeTarget } from '../lib/orderDrafts'
import '../proformas.css'

const CARDS = [
  ['borrador', 'Por completar', 'Órdenes a medias y proformas en borrador'],
  ['emitida', 'Por confirmar', 'Emitidas, esperando respuesta'],
  ['aprobada', 'Aceptadas sin orden', 'Aprobadas, falta crear la orden'],
  ['rechazada', 'No aprobadas', 'Rechazadas por el cliente o el seguro'],
]
const STEP = { presupuesto: 'Falta elegir el presupuesto', orden: 'Falta confirmar la orden', vehiculo: 'Falta elegir el vehículo' }
const when = value => new Date(value).toLocaleString('es-NI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Status cards for insurer ("seguro") or private ("particular") work, plus the unfinished
// order registrations of that kind so they can be resumed where they were left.
export default function PendingWork({ scope }) {
  const navigate = useNavigate()
  const ambito = scope === 'particular' ? 'particular' : 'seguro'
  const [stats, setStats] = useState(null), [drafts, setDrafts] = useState(null)
  const [open, setOpen] = useState(''), [rows, setRows] = useState(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, pending] = await Promise.all([api(`/api/proformas?ambito=${ambito}`), listOrderDrafts(scope)])
      setStats(data.stats); setDrafts(pending); setError('')
    } catch (e) { setError(e.message) }
  }, [ambito, scope])
  useDeferredLoad(load)

  useEffect(() => {
    if (!open) return
    let active = true
    api(`/api/proformas?${new URLSearchParams({ ambito, fase: open, ...(open === 'aprobada' ? { sin_orden: 'true' } : {}) })}`)
      .then(data => { if (active) setRows(data.rows) })
      .catch(e => { if (active) { setError(e.message); setRows([]) } })
    return () => { active = false }
  }, [open, ambito])

  const stat = fase => stats?.find(s => s.fase === fase)
  const count = fase => !stats || !drafts ? null
    : fase === 'borrador' ? Number(stat(fase)?.cantidad || 0) + drafts.length
    : fase === 'aprobada' ? Number(stat(fase)?.sin_orden || 0)
    : Number(stat(fase)?.cantidad || 0)

  async function resume(draft) {
    setBusy(true)
    try { const [path, state] = await resumeTarget(draft); navigate(path, { state }) }
    catch (e) { setError(e.message); setBusy(false) }
  }
  async function discard(draft) {
    if (!window.confirm(`¿Descartar la orden sin terminar de ${draft.matricula}? El cliente y el vehículo siguen registrados.`)) return
    setBusy(true)
    try { await deleteOrderDraft({ particular: draft.tipo === 'particular', vehiculo: { id: draft.id_vehiculo } }); await load() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const label = CARDS.find(([fase]) => fase === open)
  return <section className="pending-work" aria-label="Seguimiento por estado">
    <div className="pf-stats">{CARDS.map(([fase, title, hint]) => <button key={fase} type="button" aria-pressed={open === fase} className={`pf-stat ${open === fase ? 'selected' : ''}`} onClick={() => { setRows(null); setOpen(open === fase ? '' : fase) }}>
      <span>{title}</span><strong>{count(fase) ?? '—'}</strong><small>{hint} <span>↗</span></small>
    </button>)}</div>
    {error && <p role="alert" className="pf-error">{error}</p>}
    {open && <div className="pf-panel pending-work-list">
      <div className="pf-section-heading"><h2>{label[1]}</h2><button type="button" className="pf-secondary" onClick={() => setOpen('')}>Cerrar</button></div>
      {open === 'borrador' && <>
        <h3>Órdenes sin terminar</h3>
        {!drafts?.length ? <p className="pf-muted">No hay órdenes a medias. Si sales a mitad de una orden, sus datos quedan aquí.</p>
          : <ul className="pending-drafts">{drafts.map(d => <li key={d.id}>
            <div><strong>{d.matricula}</strong><span>{d.cliente} · {d.marca} {d.modelo}</span><small>{STEP[d.paso] || 'Sin terminar'} · guardada {when(d.actualizado)}</small></div>
            <div className="pf-actions"><button type="button" className="pf-primary" disabled={busy} onClick={() => resume(d)}>Continuar →</button><button type="button" className="pf-secondary" disabled={busy} onClick={() => discard(d)}>Descartar</button></div>
          </li>)}</ul>}
        <h3>Proformas en borrador</h3>
      </>}
      {rows === null ? <p className="pf-muted">Cargando…</p>
        : !rows.length ? <p className="pf-muted">No hay documentos en este estado.</p>
        : <ul className="pending-drafts">{rows.map(p => <li key={p.id}>
          <div><strong>{p.numero ? `N° ${p.numero}` : `Borrador #${p.id}`} · {p.matricula || 'Sin placa'}</strong><span>{p.cliente || 'Sin cliente'} · {p.seguro}</span><small>{String(p.fecha || '').slice(0, 10).split('-').reverse().join('/')}{p.total != null ? ` · ${currency(p.total)}` : ''}</small></div>
          <div className="pf-actions"><Link className={open === 'aprobada' ? 'pf-primary' : 'pf-secondary'} to={`/proformas/${p.id}`}>{open === 'aprobada' ? 'Crear orden →' : open === 'borrador' ? 'Completar →' : 'Abrir →'}</Link></div>
        </li>)}</ul>}
    </div>}
  </section>
}
