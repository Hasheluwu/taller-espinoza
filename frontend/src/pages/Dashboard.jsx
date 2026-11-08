import { apiFetch } from '../lib/api'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = ''

const ESTADO_STYLES = {
  recibido:   { badgeClass: 'badge-cyber-cyan',    label: 'Recibidos',           color: '#abc9f2' },
  en_proceso: { badgeClass: 'badge-cyber-orange',  label: 'En Proceso',          color: '#fb923c' },
  listo:      { badgeClass: 'badge-cyber-emerald', label: 'Listos para Entrega', color: '#34d399' },
  entregado:  { badgeClass: 'badge-cyber-violet',  label: 'Entregados',          color: '#a78bfa' },
  pagado: { badgeClass:'badge-cyber-emerald',label:'Pagados',color:'#a3e635' },
}

function fmt(n) {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DebugResetBanner() {
  const [estado, setEstado] = useState('idle')
  const [msg, setMsg] = useState('')

  async function handleReset() {
    if (!window.confirm('⚠️ ¿Deseas reiniciar la base de datos con el seed de prueba?')) return
    setEstado('loading')
    setMsg('')
    try {
      const res = await apiFetch(`${API}/api/debug/reset-db`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (res.ok) {
        setEstado('ok')
        setMsg('¡Base de datos reiniciada con éxito!')
      } else {
        setEstado('error')
        setMsg(data.message || 'Error al reiniciar.')
      }
    } catch {
      setEstado('error')
      setMsg('Error al conectar.')
    }
  }

  return (
    <div className="card-cyber" style={{
      padding: '0.85rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      borderLeft: '4px solid #ff9559'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          ENTORNO DE PRUEBAS — SEED DATA
        </span>
        <span style={{ fontSize: 'var(--text-small)', color: '#9ca3af' }}>
          Rellenar base de datos con clientes, vehículos y órdenes inorgánicas de prueba
        </span>
        {msg && (
          <span style={{ fontSize: 'var(--text-xs)', color: estado === 'ok' ? '#34d399' : '#fb7185', marginTop: '0.2rem' }}>
            {msg}
          </span>
        )}
      </div>

      <button
        onClick={handleReset}
        disabled={estado === 'loading'}
        className="btn-cyber-outline"
        style={{ fontSize: 'var(--text-small)', padding: '0.45rem 0.85rem' }}
      >
        {estado === 'loading' ? 'Reiniciando...' : '⚡ Restaurar Seed'}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [metricas,   setMetricas]   = useState(null)
  const [breakdown,  setBreakdown]  = useState(null)
  const [recientes,  setRecientes]  = useState(null)
  const [cobros,     setCobros]     = useState(null)
  const [stockBajo,  setStockBajo]  = useState(null)
  const [error, setError] = useState(false)

  async function get(endpoint) {
    const res = await apiFetch(`${API}${endpoint}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }

  useEffect(() => {
    get('/api/dashboard/metricas').then(setMetricas).catch(() => setError(true))
    get('/api/dashboard/breakdown-estados').then(setBreakdown).catch(() => setError(true))
    get('/api/dashboard/ordenes-recientes').then(setRecientes).catch(() => setError(true))
    get('/api/dashboard/cobros-pendientes').then(setCobros).catch(() => setError(true))
    get('/api/dashboard/stock-bajo').then(setStockBajo).catch(() => setError(true))
  }, [])

  const total = breakdown ? Object.values(breakdown).reduce((sum, n) => sum + Number(n), 0) : 0
  const pending = value => value === null ? (error ? 'No disponible' : 'Cargando…') : value
  return <div className="command-center">
    <header className="command-heading">
      <div><span className="section-kicker">ESPINOZA / CENTRO DE OPERACIONES</span><h1>El taller, en marcha<span>.</span></h1><p>Reparaciones, entregas y recursos. Todo a la vista.</p></div>
      <button className="btn-cyber-orange" onClick={() => navigate('/ordenes/nueva')}>＋ Recibir vehículo</button>
    </header>
    {error && <div className="dashboard-error" role="alert">Algunos datos no pudieron cargarse.<button onClick={() => window.location.reload()}>Reintentar</button></div>}
    <div className="command-stats" aria-label="Resumen del taller">
      {[
        ['En el taller', metricas?.activas, 'Órdenes activas'],
        ['Para entregar', metricas?.listas, 'Reparaciones listas'],
        ['Ingresos de hoy', metricas?.hoy, 'Vehículos recibidos'],
      ].map(([title,value,detail]) => <button key={title} onClick={() => navigate('/ordenes')}><span>{title}</span><strong>{value ?? (error ? '—' : '…')}</strong><small>{detail} <span aria-hidden="true">↗</span></small></button>)}
      <div className="command-finance"><span>Por cobrar al seguro</span><strong>{metricas ? `C$ ${fmt(metricas.cobros_pendientes)}` : '—'}</strong><small><Link to="/facturas">{metricas ? `${metricas.facturas_pendientes} ${Number(metricas.facturas_pendientes) === 1 ? 'factura pendiente' : 'facturas pendientes'}` : 'Facturas emitidas pendientes'} ↗</Link></small>{Number(metricas?.sin_factura) > 0 && <small className="finance-warning"><Link to="/facturas?estado=sin_factura">{metricas.sin_factura} {Number(metricas.sin_factura) === 1 ? 'entrega antigua' : 'entregas antiguas'} sin factura ↗</Link></small>}</div>
    </div>
    <div className="command-columns">
      <div className="command-main">
        <section className="flow-section">
          <div className="section-heading"><div><span className="section-kicker">01 / OPERACIÓN</span><h2>Ruta de las reparaciones</h2></div><button className="text-action" onClick={() => navigate('/ordenes')}>Abrir tablero ↗</button></div>
          <div className="flow-bar" aria-hidden="true">{Object.entries(ESTADO_STYLES).map(([key,st]) => <span key={key} style={{background:st.color,flex:breakdown ? Number(breakdown[key] || 0) : 1}}/>)}</div>
          <div className="flow-stations">{Object.entries(ESTADO_STYLES).map(([key,st],index) => <div key={key}><span className="station-label"><i style={{background:st.color}}/>{st.label}</span><strong>{breakdown ? breakdown[key] ?? 0 : '—'}</strong><small>{total ? `${Math.round(Number(breakdown[key] || 0) / total * 100)}% del total` : 'Sin actividad registrada'}</small><span className="station-number" aria-hidden="true">0{index+1}</span></div>)}</div>
        </section>
        <section className="recent-section">
          <div className="section-heading"><div><span className="section-kicker">02 / SEGUIMIENTO</span><h2>Últimas órdenes</h2></div><button className="text-action" onClick={() => navigate('/ordenes')}>Ver todas ↗</button></div>
          {recientes?.length ? <div className="service-list">{recientes.map(o => <article className="service-row" key={o.id}>
            <div className="service-identity"><span className="service-number">#{String(o.id).padStart(3,'0')}</span><div><strong>{o.matricula}</strong><p>{o.nombre_cliente}</p></div></div>
            <div className="service-type"><span>{o.tipo}</span><small>Trabajo solicitado</small></div>
            <span className={`badge-cyber ${ESTADO_STYLES[o.estado]?.badgeClass || ''}`}>{o.estado.replaceAll('_',' ')}</span>
            <div className="service-actions"><button className="text-action" onClick={() => navigate(`/ordenes/${o.id}/pago`)}>Pagos</button><button className="service-open" aria-label={`Ver operaciones de ${o.matricula}`} onClick={() => navigate(`/ordenes/${o.id}/operaciones`)}>↗</button></div>
          </article>)}</div> : <div className="workspace-empty">{recientes === null ? pending(null) : 'Las nuevas órdenes aparecerán aquí para darles seguimiento.'}</div>}
        </section>
      </div>
      <aside className="command-rail" aria-label="Atención y accesos rápidos">
        <section className="dispatch-panel"><span className="section-kicker">ORGANIZA LA JORNADA</span><h2>El siguiente paso<br/>empieza aquí.</h2><p>Consulta tus citas y prepara las próximas entregas.</p><button onClick={() => navigate('/agenda')}>Abrir agenda <span>↗</span></button><div className="dispatch-links"><button onClick={() => navigate('/proformas')}>Proformas ↗</button><button onClick={() => navigate('/historial')}>Historial ↗</button></div></section>
        <section className="attention-panel"><div className="section-heading"><h2>Materiales por reponer</h2><span className="attention-count">{stockBajo?.length ?? '—'}</span></div>
          {stockBajo?.length ? stockBajo.map(m => <div className="attention-item" key={m.id}><strong>{m.nombre}</strong><span>{m.cantidad} {m.unidad_medida}</span><small>Mínimo: {m.stock_minimo} {m.unidad_medida}</small></div>) : <p className="rail-empty">{stockBajo === null ? pending(null) : 'Los materiales están por encima del stock mínimo.'}</p>}
          <button className="text-action" onClick={() => navigate('/inventario')}>Gestionar inventario ↗</button>
        </section>
      </aside>
    </div>
    <section className="receivables-section"><div className="section-heading"><div><span className="section-kicker">03 / ADMINISTRACIÓN</span><h2>Cobros a aseguradoras</h2></div><span className="metric-caption">Importes pendientes de recepción</span></div>
      {cobros?.length ? <div className="receivables-list">{cobros.map(c => <article key={c.id}><div><span className="insurer-name">{c.tipo_pago}</span><h3>{c.matricula}</h3><p>{c.concepto?.replaceAll('_',' ') || 'Cobro pendiente'}</p></div><strong>C$ {fmt(c.monto)}</strong></article>)}</div> : <p className="workspace-empty">{cobros === null ? pending(null) : 'No hay cobros pendientes de aseguradoras.'}</p>}
    </section>
    {import.meta.env.DEV && <details className="dashboard-development"><summary>Herramientas de desarrollo</summary><DebugResetBanner/></details>}
  </div>
}
