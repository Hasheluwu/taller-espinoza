import OrderDrawer from '../components/OrderDrawer'
import { MonthFolderGrid, MonthFolderBar } from '../components/MonthFolders'
import { useMonthFolder } from '../lib/months'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { apiFetch } from '../lib/api'
import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = ''

const KANBAN_COLUMNS = [
  { key: 'recibido',   title: 'Recibidos',     color: 'var(--accent)', badgeClass: 'badge-cyber-cyan' },
  { key: 'en_proceso', title: 'En proceso',     color: '#fb923c', badgeClass: 'badge-cyber-orange' },
  { key: 'listo',      title: 'Listos para entrega', color: '#34d399', badgeClass: 'badge-cyber-emerald' },
  { key: 'entregado',  title: 'Entregados',    color: '#a78bfa', badgeClass: 'badge-cyber-violet' },
  { key: 'pagado', title: 'Pagados', color: '#a3e635', badgeClass: 'badge-cyber-emerald' },
]

export default function VerOrdenes() {
  const navigate = useNavigate()

  const [ordenes, setOrdenes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [q, setQ]               = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [vistaModo, setVistaModo]   = useState('kanban')
  const [ordenModal, setOrdenModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')
  const [mensaje, setMensaje] = useState('')
  const estadoEnCurso = useRef(false)
  const { selected: mes, select: abrirMes, visible: visibles } = useMonthFolder(ordenes)

  const cargarOrdenes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (filtroTipo) params.set('tipo', filtroTipo)

      const res = await apiFetch(`${API}/api/ordenes?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al cargar órdenes.'); return }
      setOrdenes(data)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [q, filtroTipo])

  useDeferredLoad(cargarOrdenes, 200)

  async function cambiarEstado(id, nuevoEstado) {
    if (estadoEnCurso.current) return
    estadoEnCurso.current = true
    setGuardando(true)
    setErrorEstado('')
    setMensaje('')
    try {
      const res = await apiFetch(`/api/ordenes/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated.message || 'No se pudo guardar el estado.')
      setOrdenes(prev => prev.map(orden => orden.id === id ? { ...orden, ...updated } : orden))
      setOrdenModal(null)
      setMensaje(`Orden #${id}: ${nuevoEstado.replaceAll('_', ' ')}. Cambio guardado correctamente.`)
    } catch (err) {
      setErrorEstado(err.message)
    } finally {
      estadoEnCurso.current = false
      setGuardando(false)
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} className="animate-fade-in-up">

      {/* MODAL INTERACTIVO */}
      {ordenModal && (
        <OrderDrawer
          orden={ordenModal} guardando={guardando} errorEstado={errorEstado}
          onClose={() => { if (!guardando) { setOrdenModal(null); setErrorEstado('') } }}
          onOperaciones={id => navigate(`/ordenes/${id}/operaciones`)}
          onExpediente={id => navigate(`/ordenes/${id}/expediente`)}
          onPago={id => navigate(`/ordenes/${id}/pago`)}
          onCambiarEstado={cambiarEstado}
        />
      )}

      {mensaje && <p role="status" className="badge-cyber badge-cyber-emerald">{mensaje}</p>}
      {loading && <div className="orders-loading" role="status"><span>Cargando órdenes…</span><div aria-hidden="true"><i/><i/><i/></div></div>}
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            OPERACIÓN DEL TALLER
          </span>
          <h1 style={{ fontSize: 'var(--text-title)', fontWeight: '800', color: '#f9fafb', margin: 0, lineHeight: 1.1 }}>
            Órdenes de trabajo
          </h1>
        </div>

        <div className="orders-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', backgroundColor: '#191c21', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.25rem' }}>
            <button
              aria-pressed={vistaModo === 'kanban'} onClick={() => setVistaModo('kanban')}
              style={{
                backgroundColor: vistaModo === 'kanban' ? 'var(--accent)' : 'transparent',
                color: vistaModo === 'kanban' ? '#101215' : '#9ca3af',
                fontWeight: vistaModo === 'kanban' ? '800' : '600',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: 'var(--text-small)'
              }}
            >
              Tablero
            </button>
            <button
              aria-pressed={vistaModo === 'tabla'} onClick={() => setVistaModo('tabla')}
              style={{
                backgroundColor: vistaModo === 'tabla' ? 'var(--accent)' : 'transparent',
                color: vistaModo === 'tabla' ? '#101215' : '#9ca3af',
                fontWeight: vistaModo === 'tabla' ? '800' : '600',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: 'var(--text-small)'
              }}
            >
              Lista
            </button>
          </div>

          <button onClick={() => navigate('/ordenes/nueva')} className="btn-cyber-orange">
            + Nueva orden
          </button>
        </div>
      </div>

      {/* FILTROS DE BÚSQUEDA */}
      <div className="card-cyber orders-filters" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          aria-label="Buscar órdenes" placeholder="Matrícula, cliente o cédula…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ flex: 1, minWidth: '260px' }}
        />

        <select
          aria-label="Tipo de trabajo" value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          style={{ width: '220px' }}
        >
          <option value="">Todos los Tipos de Trabajo</option>
          <option value="pintura">Pintura</option>
          <option value="mecanica">Mecánica</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {!loading && !error && !mes && <MonthFolderGrid items={ordenes} onSelect={abrirMes}/>}
      {mes && <MonthFolderBar selected={mes} count={visibles.length} onSelect={abrirMes}/>}

      {/* TABLERO KANBAN */}
      {mes && vistaModo === 'kanban' && (
        <div key="kanban" className="kanban-container view-enter">
          {KANBAN_COLUMNS.map(col => {
            const ordenesCol = visibles.filter(o => (o.estado === 'entregado' && o.pagado ? 'pagado' : o.estado) === col.key)
            return (
              <div key={col.key} className="kanban-column" style={{ borderTop: `4px solid ${col.color}` }}>
                <div className="kanban-column-header">
                  <span style={{ fontSize: 'var(--text-body)', fontWeight: '800', color: '#f9fafb' }}>
                    {col.title}
                  </span>
                  <span className={`badge-cyber ${col.badgeClass}`}>
                    {ordenesCol.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {ordenesCol.map(orden => (
                    <div
                      key={orden.id}
                      onClick={() => setOrdenModal(orden)}
                      className="card-cyber order-ticket"
                      role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOrdenModal(orden) } }}
                      style={{
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          backgroundColor: '#dce4d5',
                          color: '#182016',
                          fontWeight: '900',
                          fontSize: 'var(--text-body)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #dce4d5'
                        }}>
                          {orden.matricula}
                        </span>

                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: '700', color: '#fb923c', textTransform: 'uppercase' }}>
                          {orden.tipo_pago}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontSize: 'var(--text-body)', fontWeight: '700', color: '#f9fafb', margin: 0 }}>
                          {orden.nombre_cliente}
                        </h4>
                        <span style={{ fontSize: 'var(--text-xs)', color: '#9ca3af', textTransform: 'capitalize' }}>
                          Trabajo: {orden.tipo}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: '#979faa', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                        <span>Ingreso: {new Date(orden.fecha_ingreso).toLocaleDateString('es-NI')}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: '700' }}>Abrir orden ↗</span>
                      </div>
                    </div>
                  ))}

                  {ordenesCol.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#979faa', fontSize: 'var(--text-small)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                      Sin vehículos
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VISTA TABLA */}
      {mes && vistaModo === 'tabla' && (
        <div key="table" className="card-cyber view-enter" style={{ padding: '1.25rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-body)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#979faa', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem' }}>Matrícula</th>
                <th style={{ padding: '0.75rem' }}>Cliente</th>
                <th style={{ padding: '0.75rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem' }}>Estado</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '800', color: 'var(--accent)' }}><button className="text-action" onClick={() => setOrdenModal(o)} aria-label={`Ver orden de ${o.matricula}`}>{o.matricula} ↗</button></td>
                  <td style={{ padding: '0.75rem', color: '#f9fafb', fontWeight: '600' }}>{o.nombre_cliente}</td>
                  <td style={{ padding: '0.75rem', color: '#9ca3af', textTransform: 'capitalize' }}>{o.tipo}</td>
                  <td style={{ padding: '0.75rem', textTransform: 'capitalize', color: '#34d399', fontWeight: '700' }}>{o.estado.replace('_', ' ')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <button onClick={() => navigate(`/ordenes/${o.id}/operaciones`)} className="btn-cyber-outline" style={{ fontSize: 'var(--text-xs)', padding: '0.35rem 0.65rem', marginRight: '0.4rem' }}>
                      Operaciones
                    </button>
                    <button onClick={() => navigate(`/ordenes/${o.id}/pago`)} className="btn-cyber-orange" style={{ fontSize: 'var(--text-xs)', padding: '0.35rem 0.65rem' }}>
                      {o.pagado ? '✓ Pagado' : 'Ver pagos'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}







