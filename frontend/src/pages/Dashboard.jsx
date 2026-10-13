import { apiFetch } from '../lib/api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = ''

const ESTADO_STYLES = {
  recibido:   { badgeClass: 'badge-cyber-cyan',    label: 'Recibidos',           color: '#ffac7c' },
  en_proceso: { badgeClass: 'badge-cyber-orange',  label: 'En Proceso',          color: '#fb923c' },
  listo:      { badgeClass: 'badge-cyber-emerald', label: 'Listos para Entrega', color: '#34d399' },
  entregado:  { badgeClass: 'badge-cyber-violet',  label: 'Entregados',          color: '#a78bfa' },
}

function fmt(n) {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MetricCard({ title, value, subtitle, icon, trend, onClick }) {
  return (
    <div
      onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className="card-cyber metric-card animate-fade-in-up"
      style={{
        padding: '1.35rem 1.5rem',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
        {icon && (
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 149, 89, 0.15)',
            color: '#ffac7c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <span className="metric-value" style={{ fontSize: '2.1rem', fontWeight: '900', color: '#f9fafb', lineHeight: 1 }}>
          {value ?? <span style={{ fontSize: '1rem', color: '#979faa' }}>Cargando...</span>}
        </span>
        {trend && (
          <span className="badge-cyber badge-cyber-emerald">
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <span style={{ fontSize: '0.78rem', color: '#979faa' }}>
          {subtitle}
        </span>
      )}
    </div>
  )
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
        <span style={{ fontSize: '0.725rem', fontWeight: '800', color: '#ffac7c', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          ENTORNO DE PRUEBAS — SEED DATA
        </span>
        <span style={{ fontSize: '0.825rem', color: '#9ca3af' }}>
          Rellenar base de datos con clientes, vehículos y órdenes inorgánicas de prueba
        </span>
        {msg && (
          <span style={{ fontSize: '0.78rem', color: estado === 'ok' ? '#34d399' : '#fb7185', marginTop: '0.2rem' }}>
            {msg}
          </span>
        )}
      </div>

      <button
        onClick={handleReset}
        disabled={estado === 'loading'}
        className="btn-cyber-outline"
        style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade-in-up">
      
      {import.meta.env.DEV && <details><summary style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}>Herramientas de desarrollo</summary><DebugResetBanner /></details>}

      {error && <div className="dashboard-error" role="alert">No se pudieron cargar algunos datos del taller. Comprueba la conexión con el servidor.<button onClick={() => window.location.reload()}>Reintentar</button></div>}
      {/* HEADER DE COMANDO */}
      <div className="dashboard-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ff9559', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            TU TALLER, EN UN VISTAZO
          </span>
          <h1 style={{ fontSize: '1.85rem', fontWeight: '900', color: '#f9fafb', margin: 0, lineHeight: 1.1 }}>
            Cada reparación, bajo control.
          </h1><p className="dashboard-subtitle">Consulta el trabajo de hoy y lo que necesita tu atención.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/ordenes')} className="btn-cyber-outline">
            Ver órdenes →
          </button>
          <button onClick={() => navigate('/ordenes/nueva')} className="btn-cyber-orange">
            ＋ Nueva orden
          </button>
        </div>
      </div>

      {/* MÉTRICAS CARDS */}
      <div className="metric-grid">
        <MetricCard
          title="Órdenes Activas"
          value={metricas?.activas ?? (error ? '—' : null)}
          subtitle="Vehículos en taller actualmente"

          onClick={() => navigate('/ordenes')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        />
        <MetricCard
          title="Listos para Entrega"
          value={metricas?.listas ?? (error ? '—' : null)}
          subtitle="Vehículos listos para el cliente"
          onClick={() => navigate('/ordenes')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <MetricCard
          title="Ingresadas Hoy"
          value={metricas?.hoy ?? (error ? '—' : null)}
          subtitle="Nuevas recepciones"
          onClick={() => navigate('/ordenes')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <MetricCard
          title="Cobros pendientes"
          value={metricas?.cobros_pendientes != null ? `C$ ${fmt(metricas.cobros_pendientes)}` : (error ? '—' : null)}
          subtitle="Reclamaciones LAFISE / INISER"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
      </div>

      {/* ESTADO EN VIVO CON CHIPS */}
      <div className="card-cyber" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#f9fafb', margin: 0 }}>
            Así avanza el taller
          </h2>
          <span style={{ fontSize: '0.78rem', color: '#ff9559' }}>Ver órdenes →</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
          {breakdown ? Object.entries(ESTADO_STYLES).map(([key, st]) => {
            const count = breakdown[key] ?? 0
            return (
              <div
                key={key}
                onClick={() => navigate('/ordenes')}
                className="card-cyber"
                style={{
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(31, 41, 55, 0.6)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '900', color: st.color, lineHeight: 1 }}>
                    {count}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#9ca3af', marginTop: '0.2rem' }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: st.color, boxShadow: `0 0 10px ${st.color}` }}></div>
              </div>
            )
          }) : <span style={{ color: '#979faa', fontSize: '0.85rem' }}>{error ? 'Datos no disponibles' : 'Cargando datos…'}</span>}
        </div>
      </div>

      {/* TABLA DE ÓRDENES ACTIVAS RECIENTES */}
      <div className="card-cyber" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f9fafb', margin: 0 }}>
            Órdenes recientes
          </h2>
          <button onClick={() => navigate('/ordenes')} className="btn-cyber-outline" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}>
            Todas las órdenes →
          </button>
        </div>

        {recientes && recientes.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#979faa', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Matrícula</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Trabajo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#ffac7c' }}>
                      {o.matricula}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#f9fafb', fontWeight: '600' }}>
                      {o.nombre_cliente}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#9ca3af', textTransform: 'capitalize' }}>
                      {o.tipo}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge-cyber badge-cyber-cyan">
                        {o.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => navigate(`/ordenes/${o.id}/operaciones`)}
                          className="btn-cyber-outline"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          Operaciones
                        </button>
                        <button
                          onClick={() => navigate(`/ordenes/${o.id}/pago`)}
                          className="btn-cyber-orange"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          Ver pagos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#979faa', fontSize: '0.9rem' }}>
            {recientes === null ? (error ? 'No se pudieron cargar las órdenes.' : 'Cargando órdenes…') : 'No hay órdenes activas registradas.'}
          </div>
        )}
      </div>

      {/* COBROS PENDIENTES */}
      {cobros && cobros.length > 0 && (
        <div className="card-cyber" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f9fafb', margin: 0 }}>
              Cobros Pendientes de Aseguradoras
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#979faa', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Matrícula</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Aseguradora</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Concepto</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#ffac7c' }}>
                      {c.matricula}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#fb923c', fontWeight: '700', textTransform: 'uppercase' }}>
                      {c.tipo_pago}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#9ca3af', textTransform: 'capitalize' }}>
                      {c.concepto ? c.concepto.replace('_', ' ') : 'Cobro'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#34d399', fontWeight: '800' }}>
                      C$ {fmt(c.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ALERTAS STOCK */}
      {stockBajo && stockBajo.length > 0 && (
        <div className="card-cyber" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid #f43f5e' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#f43f5e' }}>⚠️</span>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#f9fafb', margin: 0 }}>
                Materiales con Stock Crítico en Inventario
              </h2>
            </div>
            <button onClick={() => navigate('/inventario')} className="btn-cyber-outline" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
              Ir a Inventario
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {stockBajo.map(m => (
              <div key={m.id} style={{ backgroundColor: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', fontWeight: '700', color: '#f9fafb' }}>
                  <span>{m.nombre}</span>
                  <span style={{ color: '#fb7185' }}>{m.cantidad} {m.unidad_medida}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                  Stock Mínimo: {m.stock_minimo} {m.unidad_medida}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}



