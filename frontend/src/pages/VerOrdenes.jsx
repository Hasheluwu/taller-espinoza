import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { apiFetch } from '../lib/api'
import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = ''

const KANBAN_COLUMNS = [
  { key: 'recibido',   title: '📥 Recibidos',     color: '#ffac7c', badgeClass: 'badge-cyber-cyan' },
  { key: 'en_proceso', title: '🛠️ En Proceso',     color: '#fb923c', badgeClass: 'badge-cyber-orange' },
  { key: 'listo',      title: '✅ Listo Entrega', color: '#34d399', badgeClass: 'badge-cyber-emerald' },
  { key: 'entregado',  title: '🚀 Entregados',    color: '#a78bfa', badgeClass: 'badge-cyber-violet' },
]

// ─── MODAL DETALLE DE VEHÍCULO (INTERACTIVO) ──────────────────────────────────
function ModalDetalleOrden({ orden, onClose, onOperaciones, onPago, onCambiarEstado, guardando, errorEstado }) {
  if (!orden) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="card-cyber animate-modal-pop"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '520px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              backgroundColor: 'rgba(255, 149, 89, 0.2)',
              color: '#ffac7c',
              fontWeight: '900',
              fontSize: '1.1rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 149, 89, 0.4)'
            }}>
              {orden.matricula}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af', textTransform: 'capitalize' }}>
              Orden #{orden.id}
            </span>
          </div>
          <button disabled={guardando} onClick={onClose} style={{ backgroundColor: 'transparent', color: '#9ca3af', fontSize: '1.25rem' }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#f9fafb', margin: 0 }}>
            {orden.nombre_cliente}
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#ff9559' }}>
            Cédula: {orden.cedula || 'N/D'} · Teléfono: {orden.telefono || 'No registrado'}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          backgroundColor: 'rgba(17, 24, 39, 0.8)',
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#979faa', display: 'block' }}>Tipo de Trabajo</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f9fafb', textTransform: 'capitalize' }}>
              {orden.tipo}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#979faa', display: 'block' }}>Tipo de Pago</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fb923c', textTransform: 'uppercase' }}>
              {orden.tipo_pago}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#979faa', display: 'block' }}>Fecha de Ingreso</span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              {new Date(orden.fecha_ingreso).toLocaleDateString('es-NI')}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#979faa', display: 'block' }}>Estado Actual</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#34d399', textTransform: 'capitalize' }}>
              {orden.estado.replace('_', ' ')}
            </span>
          </div>
        </div>

        {errorEstado && <p role="alert" className="login-error">{errorEstado}</p>}
        {guardando && <p role="status">Guardando cambio de estado…</p>}
        {/* Mover estado rápido */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>
            Acción Rápida de Estado
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {!['en_proceso', 'entregado', 'cancelado'].includes(orden.estado) && (
              <button
                disabled={guardando} onClick={() => onCambiarEstado(orden.id, 'en_proceso')}
                className="btn-cyber-cyan"
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
              >
                ▶ Iniciar Trabajo
              </button>
            )}
            {!['listo', 'entregado', 'cancelado'].includes(orden.estado) && (
              <button
                disabled={guardando} onClick={() => onCambiarEstado(orden.id, 'listo')}
                style={{ backgroundColor: '#10b981', color: '#101215', fontWeight: '800', fontSize: '0.8rem', padding: '0.5rem' }}
              >
                ✔ Marcar Listo
              </button>
            )}
            {!['entregado', 'cancelado'].includes(orden.estado) && (
              <button
                disabled={guardando} onClick={() => onCambiarEstado(orden.id, 'entregado')}
                style={{ backgroundColor: '#8b5cf6', color: '#ffffff', fontWeight: '800', fontSize: '0.8rem', padding: '0.5rem' }}
              >
                📦 Marcar Entregado
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            disabled={guardando} onClick={() => { onClose(); onOperaciones(orden.id) }}
            className="btn-cyber-outline"
            style={{ flex: 1 }}
          >
            ⚙️ Avances & Operaciones
          </button>
          <button
            disabled={guardando} onClick={() => { onClose(); onPago(orden.id) }}
            className="btn-cyber-orange"
            style={{ flex: 1 }}
          >
            {orden.pagado ? '✓ Pagado · Ver recibos' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
        <ModalDetalleOrden
          orden={ordenModal} guardando={guardando} errorEstado={errorEstado}
          onClose={() => { if (!guardando) { setOrdenModal(null); setErrorEstado('') } }}
          onOperaciones={id => navigate(`/ordenes/${id}/operaciones`)}
          onPago={id => navigate(`/ordenes/${id}/pago`)}
          onCambiarEstado={cambiarEstado}
        />
      )}

      {mensaje && <p role="status" className="badge-cyber badge-cyber-emerald">{mensaje}</p>}
      {loading && <p role="status">Cargando órdenes…</p>}
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ff9559', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Tablero de Control Visual
          </span>
          <h1 style={{ fontSize: '1.85rem', fontWeight: '800', color: '#f9fafb', margin: 0, lineHeight: 1.1 }}>
            Gestión Operativa de Órdenes
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', backgroundColor: '#191c21', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.25rem' }}>
            <button
              onClick={() => setVistaModo('kanban')}
              style={{
                backgroundColor: vistaModo === 'kanban' ? '#ff9559' : 'transparent',
                color: vistaModo === 'kanban' ? '#101215' : '#9ca3af',
                fontWeight: vistaModo === 'kanban' ? '800' : '600',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.825rem'
              }}
            >
              📌 Tablero Kanban (Visual)
            </button>
            <button
              onClick={() => setVistaModo('tabla')}
              style={{
                backgroundColor: vistaModo === 'tabla' ? '#ff9559' : 'transparent',
                color: vistaModo === 'tabla' ? '#101215' : '#9ca3af',
                fontWeight: vistaModo === 'tabla' ? '800' : '600',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.825rem'
              }}
            >
              📋 Lista Detallada
            </button>
          </div>

          <button onClick={() => navigate('/ordenes/nueva')} className="btn-cyber-orange">
            ➕ Nueva Orden
          </button>
        </div>
      </div>

      {/* FILTROS DE BÚSQUEDA */}
      <div className="card-cyber" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Filtrar vehículo por matrícula, cliente o cédula..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ flex: 1, minWidth: '260px' }}
        />

        <select
          value={filtroTipo}
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

      {/* TABLERO KANBAN */}
      {vistaModo === 'kanban' && (
        <div className="kanban-container">
          {KANBAN_COLUMNS.map(col => {
            const ordenesCol = ordenes.filter(o => o.estado === col.key)
            return (
              <div key={col.key} className="kanban-column" style={{ borderTop: `4px solid ${col.color}` }}>
                <div className="kanban-column-header">
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#f9fafb' }}>
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
                      className="card-cyber animate-fade-in-up"
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
                          backgroundColor: 'rgba(255, 149, 89, 0.2)',
                          color: '#ffac7c',
                          fontWeight: '900',
                          fontSize: '0.9rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 149, 89, 0.4)'
                        }}>
                          {orden.matricula}
                        </span>

                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#fb923c', textTransform: 'uppercase' }}>
                          {orden.tipo_pago}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f9fafb', margin: 0 }}>
                          {orden.nombre_cliente}
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af', textTransform: 'capitalize' }}>
                          Trabajo: {orden.tipo}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#979faa', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                        <span>Ingreso: {new Date(orden.fecha_ingreso).toLocaleDateString('es-NI')}</span>
                        <span style={{ color: '#ff9559', fontWeight: '700' }}>👁 Ver Detalle</span>
                      </div>
                    </div>
                  ))}

                  {ordenesCol.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#979faa', fontSize: '0.8rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
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
      {vistaModo === 'tabla' && (
        <div className="card-cyber" style={{ padding: '1.25rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#979faa', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem' }}>Matrícula</th>
                <th style={{ padding: '0.75rem' }}>Cliente</th>
                <th style={{ padding: '0.75rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem' }}>Estado</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '800', color: '#ffac7c' }}>{o.matricula}</td>
                  <td style={{ padding: '0.75rem', color: '#f9fafb', fontWeight: '600' }}>{o.nombre_cliente}</td>
                  <td style={{ padding: '0.75rem', color: '#9ca3af', textTransform: 'capitalize' }}>{o.tipo}</td>
                  <td style={{ padding: '0.75rem', textTransform: 'capitalize', color: '#34d399', fontWeight: '700' }}>{o.estado.replace('_', ' ')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <button onClick={() => navigate(`/ordenes/${o.id}/operaciones`)} className="btn-cyber-outline" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', marginRight: '0.4rem' }}>
                      Operaciones
                    </button>
                    <button onClick={() => navigate(`/ordenes/${o.id}/pago`)} className="btn-cyber-orange" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
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







