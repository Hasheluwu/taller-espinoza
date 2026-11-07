import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi } from '../lib/workshopApi'
import { MonthFolderGrid, MonthFolderBar } from '../components/MonthFolders'
import { useMonthFolder } from '../lib/months'
import PendingWork from '../components/PendingWork'

const BADGES = { recibido: 'badge-cyber-cyan', en_proceso: 'badge-cyber-orange', listo: 'badge-cyber-emerald', entregado: 'badge-cyber-violet', cancelado: '' }
const NOUN = ['trabajo', 'trabajos']
const ALL_LABEL = 'Mostrar todos los trabajos'

export default function Particulares() {
  const [orders, setOrders] = useState([]), [query, setQuery] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setOrders(await workshopApi('/api/ordenes?tipo_pago=particular')) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])
  useDeferredLoad(load)
  const filtered = orders.filter(o => `${o.matricula} ${o.nombre_cliente} ${o.id}`.toLowerCase().includes(query.toLowerCase()))
  const { selected, select, visible } = useMonthFolder(filtered)
  const rows = [...visible].sort((a, b) => String(b.fecha_ingreso).localeCompare(String(a.fecha_ingreso)))
  return <div className="work-page">
    <header className="section-heading"><div><span className="section-kicker">ATENCIÓN DIRECTA / SIN SEGURO</span><h1>Trabajos particulares</h1><p className="work-muted">Reparaciones pagadas directamente por el cliente.</p></div><Link className="btn-cyber-orange" to="/ordenes/nueva?tipo=particular">+ Registrar trabajo particular</Link></header>
    <PendingWork scope="particular"/>
    <section className="work-panel">
      <h2>Trabajos del taller</h2>
      <label className="work-field">Buscar por cliente, matrícula o número<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar trabajo particular…"/></label>
      {loading ? <p role="status">Cargando trabajos…</p>
        : error ? <div role="alert"><p>{error}</p><button onClick={load}>Reintentar</button></div>
        : !selected ? <MonthFolderGrid items={filtered} onSelect={select} noun={NOUN} allLabel={ALL_LABEL}/>
        : <>
          <MonthFolderBar selected={selected} count={rows.length} onSelect={select} noun={NOUN} allLabel={ALL_LABEL}/>
          {!rows.length ? <p>No hay trabajos particulares que coincidan con la búsqueda.</p> : rows.map(o => <article className="service-row" key={o.id}>
            <div className="service-identity"><span className="service-number">#{o.id}</span><div><strong>{o.matricula}</strong><p>{o.nombre_cliente} · {new Date(o.fecha_ingreso).toLocaleDateString('es-NI')}</p></div></div>
            <span>{o.tipo}</span>
            <span className={`badge-cyber ${BADGES[o.estado] || ''}`}>{o.estado.replaceAll('_', ' ')}</span>
            <div className="service-actions">{o.id_presupuesto && <Link to={`/proformas/${o.id_presupuesto}`}>Presupuesto ↗</Link>}<Link to={`/ordenes/${o.id}/operaciones`}>Trabajos ↗</Link><Link to={`/ordenes/${o.id}/pago`}>Pagos ↗</Link></div>
          </article>)}
        </>}
    </section>
  </div>
}
