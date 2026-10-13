import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { apiFetch } from '../lib/api'
// frontend/src/pages/Repuestos.jsx
import { useState, useCallback } from 'react'
import { useToast } from '../hooks/useToast'
import { SkeletonList } from '../components/Skeleton'

export default function Repuestos() {
  const toast = useToast()
  const [repuestosTaller, setRepuestosTaller] = useState([])
  const [repuestosCliente, setRepuestosCliente] = useState([])
  const [loadingTaller, setLoadingTaller] = useState(true)
  const [loadingCliente, setLoadingCliente] = useState(true)

  // Filtros Taller
  const [qTaller, setQTaller] = useState('')
  const [estadoTaller, setEstadoTaller] = useState('')
  const [origenTaller, setOrigenTaller] = useState('')

  // Filtros Cliente
  const [qCliente, setQCliente] = useState('')
  const [estadoCliente, setEstadoCliente] = useState('')

  // Modales
  const [modalTaller, setModalTaller] = useState(false)
  const [modalTransferir, setModalTransferir] = useState(null) // { repuestoCliente }
  const [precioTransferencia, setPrecioTransferencia] = useState('0')

  // Formulario Repuesto Taller (Crear / Editar)
  const [formTaller, setFormTaller] = useState({
    id: null,
    nombre: '',
    marca: '',
    modelo: '',
    modelo_compatible: '',
    precio: '',
    cantidad: 1,
    estado: 'nuevo',
    origen: 'comprado'
  })

  const token = localStorage.getItem('token')

  const cargarTaller = useCallback(async () => {
    setLoadingTaller(true)
    try {
      const params = new URLSearchParams()
      if (qTaller) params.append('q', qTaller)
      if (estadoTaller) params.append('estado', estadoTaller)
      if (origenTaller) params.append('origen', origenTaller)

      const res = await apiFetch(`/api/repuestos/taller?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setRepuestosTaller(data)
      }
    } catch (err) {
      console.error('Error al cargar repuestos del taller:', err)
    } finally {
      setLoadingTaller(false)
    }
  }, [qTaller, estadoTaller, origenTaller, token])

  const cargarCliente = useCallback(async () => {
    setLoadingCliente(true)
    try {
      const params = new URLSearchParams()
      if (qCliente) params.append('q', qCliente)
      if (estadoCliente) params.append('estado', estadoCliente)

      const res = await apiFetch(`/api/repuestos/cliente?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setRepuestosCliente(data)
      }
    } catch (err) {
      console.error('Error al cargar repuestos de cliente:', err)
    } finally {
      setLoadingCliente(false)
    }
  }, [qCliente, estadoCliente, token])

  useDeferredLoad(cargarTaller, 200)

  useDeferredLoad(cargarCliente, 200)

  // Guardar Repuesto Taller
  const handleGuardarTaller = async (e) => {
    e.preventDefault()
    try {
      const url = formTaller.id ? `/api/repuestos/taller/${formTaller.id}` : '/api/repuestos/taller'
      const method = formTaller.id ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formTaller)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al guardar repuesto.')
      }

      setModalTaller(false)
      cargarTaller()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Eliminar Repuesto Taller
  const handleEliminarTaller = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este repuesto del taller?')) return
    try {
      const res = await apiFetch(`/api/repuestos/taller/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al eliminar repuesto.')
      }

      cargarTaller()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Cambiar Estado Repuesto Cliente
  const handleCambiarEstadoCliente = async (rep, nuevoEstado) => {
    if (nuevoEstado === 'transferido_a_taller') {
      setModalTransferir(rep)
      setPrecioTransferencia('0')
      return
    }

    try {
      const res = await apiFetch(`/api/repuestos/cliente/${rep.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nuevo_estado: nuevoEstado })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al actualizar estado.')
      }

      cargarCliente()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Confirmar Transferencia a Taller (Transacción Atómica)
  const handleConfirmarTransferencia = async () => {
    if (!modalTransferir) return
    try {
      const res = await apiFetch(`/api/repuestos/cliente/${modalTransferir.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nuevo_estado: 'transferido_a_taller',
          precio_asignado: Number(precioTransferencia || 0)
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al transferir repuesto al taller.')
      }

      setModalTransferir(null)
      cargarCliente()
      cargarTaller() // Refresca repuestos del taller para mostrar la nueva incorporación atómica
    } catch (err) {
      toast.error(err.message)
    }
  }

  const abrirNuevoTaller = () => {
    setFormTaller({
      id: null,
      nombre: '',
      marca: '',
      modelo: '',
      modelo_compatible: '',
      precio: '',
      cantidad: 1,
      estado: 'nuevo',
      origen: 'comprado'
    })
    setModalTaller(true)
  }

  const abrirEditarTaller = (rep) => {
    setFormTaller({
      id: rep.id,
      nombre: rep.nombre,
      marca: rep.marca,
      modelo: rep.modelo,
      modelo_compatible: rep.modelo_compatible || '',
      precio: rep.precio,
      cantidad: rep.cantidad,
      estado: rep.estado,
      origen: rep.origen
    })
    setModalTaller(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 20px)', padding: '1.5rem', boxSizing: 'border-box' }}>
      {/* ── Encabezado ── */}
      <div style={{ marginBottom: '1rem', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--foreground)' }}>🔩 Gestión de Repuestos</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--neutral-400)' }}>
          Administra de forma independiente los repuestos propiedad del taller y los repuestos ingresados por clientes.
        </p>
      </div>

      {/* ── Layout en 2 Columnas de Scroll Independiente ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>

        {/* ── COLUMNA IZQUIERDA: REPUESTOS DEL TALLER ── */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header Columna */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255, 195, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--foreground)' }}>🏭 Repuestos del Taller</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>Inventario propio (comprados o transferidos)</span>
            </div>
            <button
              onClick={abrirNuevoTaller}
              className="btn-cyber-orange"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              + Agregar Repuesto
            </button>
          </div>

          {/* Filtros Taller */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Buscar por nombre, marca, modelo..."
              value={qTaller}
              onChange={(e) => setQTaller(e.target.value)}
              style={{ flex: 1, backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}
            />
            <select
              value={estadoTaller}
              onChange={(e) => setEstadoTaller(e.target.value)}
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}
            >
              <option value="">Todos los Estados</option>
              <option value="nuevo">Nuevo</option>
              <option value="usado_bueno">Usado Bueno</option>
              <option value="usado_regular">Usado Regular</option>
              <option value="para_reparar">Para Reparar</option>
            </select>
            <select
              value={origenTaller}
              onChange={(e) => setOrigenTaller(e.target.value)}
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}
            >
              <option value="">Todos los Orígenes</option>
              <option value="comprado">Comprado</option>
              <option value="proveniente_de_cliente">Proveniente de Cliente</option>
            </select>
          </div>

          {/* Lista / Scroll Taller */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loadingTaller ? (
              <SkeletonList count={4} />
            ) : repuestosTaller.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: '2rem' }}>No hay repuestos registrados.</div>
            ) : (
              repuestosTaller.map(rep => (
                <div key={rep.id} style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{rep.nombre}</span>
                      <span style={{
                        fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '0.2rem',
                        backgroundColor: rep.origen === 'comprado' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: rep.origen === 'comprado' ? '#60A5FA' : '#F59E0B'
                      }}>
                        {rep.origen === 'comprado' ? 'Comprado' : 'De Cliente'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>
                      Marca: {rep.marca} | Modelo: {rep.modelo} {rep.modelo_compatible && `(Comp: ${rep.modelo_compatible})`}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--neutral-400)', marginTop: '0.25rem' }}>
                      Estado: <span style={{ color: 'var(--foreground)' }}>{rep.estado}</span> | Stock: <strong style={{ color: 'var(--yellow-400)' }}>{rep.cantidad}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                      C$ {Number(rep.precio).toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => abrirEditarTaller(rep)}
                        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleEliminarTaller(rep.id)}
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#EF4444', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: REPUESTOS DEL CLIENTE ── */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header Columna */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(59, 130, 246, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--foreground)' }}>🚗 Repuestos del Cliente</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>Piezas traídas por el cliente vinculadas a una orden</span>
            </div>
          </div>

          {/* Filtros Cliente */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Buscar por cliente, pieza, matrícula..."
              value={qCliente}
              onChange={(e) => setQCliente(e.target.value)}
              style={{ flex: 1, backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}
            />
            <select
              value={estadoCliente}
              onChange={(e) => setEstadoCliente(e.target.value)}
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem', fontSize: '0.85rem' }}
            >
              <option value="">Todos los Estados</option>
              <option value="en_taller">En Taller</option>
              <option value="devuelto">Devuelto a Cliente</option>
              <option value="transferido_a_taller">Transferido a Taller</option>
            </select>
          </div>

          {/* Lista / Scroll Cliente */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loadingCliente ? (
              <SkeletonList count={4} />
            ) : repuestosCliente.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: '2rem' }}>No hay repuestos de clientes registrados.</div>
            ) : (
              repuestosCliente.map(rep => (
                <div key={rep.id} style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--foreground)' }}>{rep.nombre}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>
                        Marca: {rep.marca} | Modelo: {rep.modelo} (Cant: {rep.cantidad})
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', color: 'var(--yellow-400)', fontWeight: 600 }}>
                      Orden #{rep.orden_id}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--neutral-300)', marginBottom: '0.75rem', backgroundColor: 'var(--surface)', padding: '0.4rem 0.6rem', borderRadius: '0.25rem' }}>
                    👤 <strong>{rep.cliente_nombre}</strong> | 🚘 <strong>{rep.matricula}</strong> ({rep.vehiculo_marca} {rep.vehiculo_modelo})
                  </div>

                  {/* Selector de Estado */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>Cambiar Estado:</span>
                    <select
                      value={rep.estado}
                      onChange={(e) => handleCambiarEstadoCliente(rep, e.target.value)}
                      disabled={rep.estado === 'transferido_a_taller'} // Bloqueado si ya fue transferido
                      style={{
                        backgroundColor: rep.estado === 'en_taller' ? 'rgba(59, 130, 246, 0.15)' : rep.estado === 'devuelto' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: rep.estado === 'en_taller' ? '#60A5FA' : rep.estado === 'devuelto' ? '#9CA3AF' : '#10B981',
                        border: '1px solid var(--border)',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: rep.estado === 'transferido_a_taller' ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="en_taller">🔵 En Taller</option>
                      <option value="devuelto">⚪ Devuelto a Cliente</option>
                      <option value="transferido_a_taller">🟢 Transferido a Taller</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ── Modal Nuevo / Editar Repuesto Taller ── */}
      {modalTaller && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--foreground)' }}>
              {formTaller.id ? 'Editar Repuesto del Taller' : 'Agregar Repuesto al Taller'}
            </h2>

            <form onSubmit={handleGuardarTaller} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Nombre del Repuesto *</label>
                <input
                  type="text"
                  required
                  value={formTaller.nombre}
                  onChange={(e) => setFormTaller({ ...formTaller, nombre: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Marca *</label>
                  <input
                    type="text"
                    required
                    value={formTaller.marca}
                    onChange={(e) => setFormTaller({ ...formTaller, marca: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Modelo *</label>
                  <input
                    type="text"
                    required
                    value={formTaller.modelo}
                    onChange={(e) => setFormTaller({ ...formTaller, modelo: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Modelos Compatibles (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Toyota Hilux 2016-2022"
                  value={formTaller.modelo_compatible}
                  onChange={(e) => setFormTaller({ ...formTaller, modelo_compatible: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Precio (C$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formTaller.precio}
                    onChange={(e) => setFormTaller({ ...formTaller, precio: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Cantidad / Stock *</label>
                  <input
                    type="number"
                    required
                    value={formTaller.cantidad}
                    onChange={(e) => setFormTaller({ ...formTaller, cantidad: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Estado del Repuesto</label>
                  <select
                    value={formTaller.estado}
                    onChange={(e) => setFormTaller({ ...formTaller, estado: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="usado_bueno">Usado Bueno</option>
                    <option value="usado_regular">Usado Regular</option>
                    <option value="para_reparar">Para Reparar</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Origen</label>
                  <select
                    value={formTaller.origen}
                    onChange={(e) => setFormTaller({ ...formTaller, origen: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  >
                    <option value="comprado">Comprado</option>
                    <option value="proveniente_de_cliente">Proveniente de Cliente</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setModalTaller(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: 'var(--yellow-500)', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Transferencia a Taller ── */}
      {modalTransferir && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '450px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--foreground)' }}>
              🟢 Transferir Repuesto a Inventario del Taller
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--neutral-300)', marginBottom: '1rem' }}>
              El repuesto <strong>{modalTransferir.nombre}</strong> será transferido al stock del taller con origen <em>"proveniente_de_cliente"</em>.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>
                Asignar Precio Estimado de Venta (C$)
              </label>
              <input
                type="number"
                step="0.01"
                value={precioTransferencia}
                onChange={(e) => setPrecioTransferencia(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setModalTransferir(null)}
                style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarTransferencia}
                className="btn-cyber-emerald"
                style={{ padding: '0.5rem 1rem' }}
              >
                Confirmar Transferencia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



