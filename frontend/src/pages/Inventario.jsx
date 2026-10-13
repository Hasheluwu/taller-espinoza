import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { apiFetch } from '../lib/api'
// frontend/src/pages/Inventario.jsx
import { useState, useCallback } from 'react'
import { useToast } from '../hooks/useToast'
import { SkeletonGrid } from '../components/Skeleton'
import UseMaterial from '../components/UseMaterial'

export default function Inventario() {
  const toast = useToast()
  const [consumir, setConsumir] = useState(null)
  const [productos, setProductos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroUnidad, setFiltroUnidad] = useState('')
  const [filtroStockBajo, setFiltroStockBajo] = useState(false)
  const [filtroExpiracion, setFiltroExpiracion] = useState(false)

  // Modales
  const [modalProducto, setModalProducto] = useState(false)
  const [modalCompra, setModalCompra] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(null)
  const [modalMovimientos, setModalMovimientos] = useState(false)
  const [movimientos, setMovimientos] = useState([])

  // Formulario Producto
  const [prodForm, setProdForm] = useState({
    id: null,
    nombre: '',
    precio_unidad: '',
    cantidad: '0',
    stock_minimo: '5',
    unidad_medida: 'unidad',
    fecha_expiracion: '',
    id_proveedor: '',
    nuevo_prov_nombre: '',
    nuevo_prov_contacto: '',
    nuevo_prov_iva: false
  })
  const [creandoProveedorInline, setCreandoProveedorInline] = useState(false)

  // Formulario Compra
  const [compraForm, setCompraForm] = useState({
    id_proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    tiene_factura_iva: false,
    monto_subtotal: 0,
    monto_iva: 0,
    monto_total: 0,
    items: [] // { id_inventario, nombre, cantidad, precio_unitario }
  })

  // Formulario Ajuste Manual
  const [ajusteForm, setAjusteForm] = useState({
    id_inventario: '',
    tipo_ajuste: 'incremento',
    cantidad: 1,
    nota: ''
  })

  const token = localStorage.getItem('token')

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (busqueda) params.append('q', busqueda)
      if (filtroProveedor) params.append('proveedor_id', filtroProveedor)
      if (filtroUnidad) params.append('unidad_medida', filtroUnidad)
      if (filtroStockBajo) params.append('stock_bajo', 'true')
      if (filtroExpiracion) params.append('expiracion_proxima', 'true')

      const [resProd, resProv] = await Promise.all([
        apiFetch(`/api/inventario?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/proveedores', { headers: { Authorization: `Bearer ${token}` } })
      ])

      if (!resProd.ok || !resProv.ok) throw new Error('Error al cargar inventario o proveedores.')

      const dataProd = await resProd.json()
      const dataProv = await resProv.json()

      setProductos(dataProd)
      setProveedores(dataProv)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [busqueda, filtroProveedor, filtroUnidad, filtroStockBajo, filtroExpiracion, token, toast])

  useDeferredLoad(cargarDatos, 200)

  const cargarMovimientos = async () => {
    try {
      const res = await apiFetch('/api/inventario/movimientos', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setMovimientos(data)
        setModalMovimientos(true)
      } else {
        const data = await res.json()
        throw new Error(data.message || 'No se pudieron cargar los movimientos.')
      }
    } catch (err) {
      toast.error('Error al obtener movimientos: ' + err.message)
    }
  }

  // Guardar/Editar Producto
  const handleGuardarProducto = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      nombre: prodForm.nombre,
      precio_unidad: Number(prodForm.precio_unidad),
      cantidad: Number(prodForm.cantidad),
      stock_minimo: Number(prodForm.stock_minimo),
      unidad_medida: prodForm.unidad_medida,
      fecha_expiracion: prodForm.fecha_expiracion || null,
      id_proveedor: creandoProveedorInline ? null : (prodForm.id_proveedor || null),
      nuevo_proveedor: creandoProveedorInline ? {
        nombre: prodForm.nuevo_prov_nombre,
        contacto: prodForm.nuevo_prov_contacto,
        emite_factura_iva: prodForm.nuevo_prov_iva
      } : null
    }

    try {
      const url = prodForm.id ? `/api/inventario/${prodForm.id}` : '/api/inventario'
      const method = prodForm.id ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al guardar el producto.')
      }

      setSuccess(prodForm.id ? 'Producto actualizado correctamente.' : 'Producto creado con éxito.')
      setModalProducto(false)
      cargarDatos()
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    }
  }

  // Guardar Compra
  const handleGuardarCompra = async (e) => {
    e.preventDefault()
    if (compraForm.items.length === 0) {
      toast.warning('Debe agregar al menos un ítem a la compra.')
      return
    }

    try {
      const res = await apiFetch('/api/inventario/compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(compraForm)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al registrar la compra.')
      }

      setSuccess('Compra registrada con éxito y stock actualizado.')
      setModalCompra(false)
      cargarDatos()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // Guardar Ajuste Manual
  const handleGuardarAjuste = async (e) => {
    e.preventDefault()
    try {
      const res = await apiFetch('/api/inventario/ajuste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(ajusteForm)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || 'Error al realizar el ajuste.')
      }

      setSuccess('Ajuste manual aplicado correctamente.')
      setModalAjuste(false)
      cargarDatos()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const abrirNuevoProducto = () => {
    setProdForm({
      id: null,
      nombre: '',
      precio_unidad: '',
      cantidad: '0',
      stock_minimo: '5',
      unidad_medida: 'unidad',
      fecha_expiracion: '',
      id_proveedor: '',
      nuevo_prov_nombre: '',
      nuevo_prov_contacto: '',
      nuevo_prov_iva: false
    })
    setCreandoProveedorInline(false)
    setModalProducto(true)
  }

  const abrirEditarProducto = (prod) => {
    setProdForm({
      id: prod.id,
      nombre: prod.nombre,
      precio_unidad: prod.precio_unidad,
      cantidad: prod.cantidad,
      stock_minimo: prod.stock_minimo,
      unidad_medida: prod.unidad_medida,
      fecha_expiracion: prod.fecha_expiracion ? prod.fecha_expiracion.split('T')[0] : '',
      id_proveedor: prod.id_proveedor || '',
      nuevo_prov_nombre: '',
      nuevo_prov_contacto: '',
      nuevo_prov_iva: false
    })
    setCreandoProveedorInline(false)
    setModalProducto(true)
  }

  // Cálculos dinámicos en Formulario Compra
  const agregarItemCompra = (prodId) => {
    const p = productos.find(x => x.id === Number(prodId))
    if (!p) return
    if (compraForm.items.some(i => i.id_inventario === p.id)) return

    const newItems = [...compraForm.items, {
      id_inventario: p.id,
      nombre: p.nombre,
      cantidad: 1,
      precio_unitario: p.precio_unidad
    }]
    recalcularTotalesCompra(newItems, compraForm.tiene_factura_iva)
  }

  const actualizarItemCompra = (index, key, val) => {
    const updated = [...compraForm.items]
    updated[index][key] = val
    recalcularTotalesCompra(updated, compraForm.tiene_factura_iva)
  }

  const eliminarItemCompra = (index) => {
    const updated = compraForm.items.filter((_, i) => i !== index)
    recalcularTotalesCompra(updated, compraForm.tiene_factura_iva)
  }

  const recalcularTotalesCompra = (itemsList, tieneIva) => {
    const subtotal = itemsList.reduce((acc, item) => acc + (Number(item.cantidad || 0) * Number(item.precio_unitario || 0)), 0)
    const iva = tieneIva ? subtotal * 0.15 : 0
    const total = subtotal + iva
    setCompraForm(prev => ({
      ...prev,
      items: itemsList,
      monto_subtotal: subtotal.toFixed(2),
      monto_iva: iva.toFixed(2),
      monto_total: total.toFixed(2)
    }))
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--foreground)' }}>📦 Control de Inventario</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--neutral-400)' }}>Gestión de productos consumibles, stock bajo, compras e historial de movimientos.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setCompraForm({
                id_proveedor: '',
                fecha: new Date().toISOString().split('T')[0],
                tiene_factura_iva: false,
                monto_subtotal: 0,
                monto_iva: 0,
                monto_total: 0,
                items: []
              })
              setModalCompra(true)
            }}
            className="btn-cyber-emerald"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            🛒 Registrar Compra
          </button>

          <button
            onClick={() => setModalAjuste(true)}
            className="btn-cyber-cyan"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            ⚙️ Ajuste Manual
          </button>

          <button
            onClick={cargarMovimientos}
            className="btn-cyber-outline"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            📜 Movimientos
          </button>

          <button
            onClick={abrirNuevoProducto}
            className="btn-cyber-orange"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            + Nuevo Producto
          </button>
        </div>
      </div>

      {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', border: '1px solid #EF4444' }}>{error}</div>}
      {success && <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', border: '1px solid #10B981' }}>{success}</div>}

      {/* ── Filtros ── */}
      <div style={{ backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar producto o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: '1 1 200px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
        />

        <select
          value={filtroProveedor}
          onChange={(e) => setFiltroProveedor(e.target.value)}
          style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
        >
          <option value="">Todos los Proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <select
          value={filtroUnidad}
          onChange={(e) => setFiltroUnidad(e.target.value)}
          style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
        >
          <option value="">Todas las Unidades</option>
          <option value="galon">Galón</option>
          <option value="litro">Litro</option>
          <option value="unidad">Unidad</option>
          <option value="kilo">Kilo</option>
          <option value="metro">Metro</option>
          <option value="otro">Otro</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filtroStockBajo}
            onChange={(e) => setFiltroStockBajo(e.target.checked)}
          />
          <span>⚠️ Solo Stock Bajo</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filtroExpiracion}
            onChange={(e) => setFiltroExpiracion(e.target.checked)}
          />
          <span>📅 Expiración Próxima</span>
        </label>
      </div>

      {/* ── Grid de Productos ── */}
      {loading ? (
        <SkeletonGrid count={6} />
      ) : productos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--surface)', borderRadius: '0.5rem', border: '1px solid var(--border)', color: 'var(--neutral-400)' }}>
          {error ? 'No se pudo cargar el inventario. Revisa el mensaje anterior e intenta nuevamente.' : 'No se encontraron productos con los filtros seleccionados.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {productos.map(p => {
            const stockBajo = Number(p.cantidad) <= Number(p.stock_minimo)
            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: stockBajo ? '1px solid #EF4444' : '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative'
                }}
              >
                {stockBajo && (
                  <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontWeight: 600, border: '1px solid #EF4444' }}>
                    Stock Bajo
                  </span>
                )}

                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '0.25rem', paddingRight: stockBajo ? '4rem' : '0' }}>{p.nombre}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-400)', marginBottom: '0.75rem' }}>
                    Proveedor: <span style={{ color: 'var(--foreground)' }}>{p.proveedor_nombre || 'Sin asignar'}</span>
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', backgroundColor: 'var(--background)', padding: '0.75rem', borderRadius: '0.375rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>Disponible</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: stockBajo ? '#EF4444' : 'var(--yellow-400)' }}>
                        {p.cantidad} <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>{p.unidad_medida}</span>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>Precio Unit.</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                        C$ {Number(p.precio_unidad).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {p.fecha_expiracion && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginBottom: '0.5rem' }}>
                      Expira: {p.fecha_expiracion.split('T')[0]}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button disabled={Number(p.cantidad) <= 0} onClick={() => setConsumir(p)} className="btn-cyber-orange">Usar</button>
                  <button
                    onClick={() => setModalDetalle(p)}
                    style={{ flex: 1, backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    🔍 Detalle
                  </button>
                  <button
                    onClick={() => abrirEditarProducto(p)}
                    style={{ flex: 1, backgroundColor: 'var(--yellow-500)', border: 'none', color: '#000', padding: '0.4rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Nuevo / Editar Producto ── */}
      {consumir && <UseMaterial product={consumir} onClose={() => setConsumir(null)} onSaved={() => { setSuccess('Consumo registrado y stock descontado.'); cargarDatos() }} />}
      {modalProducto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--foreground)' }}>
              {prodForm.id ? 'Editar Producto de Inventario' : 'Agregar Nuevo Producto'}
            </h2>

            <form onSubmit={handleGuardarProducto} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={prodForm.nombre}
                  onChange={(e) => setProdForm({ ...prodForm, nombre: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Precio Unitario (C$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodForm.precio_unidad}
                    onChange={(e) => setProdForm({ ...prodForm, precio_unidad: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Unidad de Medida *</label>
                  <select
                    value={prodForm.unidad_medida}
                    onChange={(e) => setProdForm({ ...prodForm, unidad_medida: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  >
                    <option value="galon">Galón</option>
                    <option value="litro">Litro</option>
                    <option value="unidad">Unidad</option>
                    <option value="kilo">Kilo</option>
                    <option value="metro">Metro</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {!prodForm.id && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Cantidad Inicial</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prodForm.cantidad}
                      onChange={(e) => setProdForm({ ...prodForm, cantidad: e.target.value })}
                      style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                    />
                  </div>
                )}
                <div style={{ gridColumn: prodForm.id ? 'span 2' : 'span 1' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Stock Mínimo Alerta</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodForm.stock_minimo}
                    onChange={(e) => setProdForm({ ...prodForm, stock_minimo: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Fecha Expiración (Opcional)</label>
                <input
                  type="date"
                  value={prodForm.fecha_expiracion}
                  onChange={(e) => setProdForm({ ...prodForm, fecha_expiracion: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                />
              </div>

              {/* Proveedor / Inline Creation */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'var(--foreground)', fontWeight: 'bold' }}>Proveedor</label>
                  <button
                    type="button"
                    onClick={() => setCreandoProveedorInline(!creandoProveedorInline)}
                    style={{ background: 'none', border: 'none', color: 'var(--yellow-400)', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {creandoProveedorInline ? '← Seleccionar existente' : '+ Crear nuevo proveedor'}
                  </button>
                </div>

                {!creandoProveedorInline ? (
                  <select
                    value={prodForm.id_proveedor}
                    onChange={(e) => setProdForm({ ...prodForm, id_proveedor: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  >
                    <option value="">-- Sin Proveedor Asignado --</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                ) : (
                  <div style={{ backgroundColor: 'var(--background)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Nombre del nuevo proveedor *"
                      required
                      value={prodForm.nuevo_prov_nombre}
                      onChange={(e) => setProdForm({ ...prodForm, nuevo_prov_nombre: e.target.value })}
                      style={{ width: '100%', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem' }}
                    />
                    <input
                      type="text"
                      placeholder="Contacto / Teléfono"
                      value={prodForm.nuevo_prov_contacto}
                      onChange={(e) => setProdForm({ ...prodForm, nuevo_prov_contacto: e.target.value })}
                      style={{ width: '100%', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.4rem', borderRadius: '0.25rem' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', fontSize: '0.8rem' }}>
                      <input
                        type="checkbox"
                        checked={prodForm.nuevo_prov_iva}
                        onChange={(e) => setProdForm({ ...prodForm, nuevo_prov_iva: e.target.checked })}
                      />
                      Emite factura con IVA
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setModalProducto(false)}
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

      {/* ── Modal Registrar Compra ── */}
      {modalCompra && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--foreground)' }}>🛒 Registrar Compra de Mercadería</h2>

            <form onSubmit={handleGuardarCompra} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Proveedor</label>
                  <select
                    value={compraForm.id_proveedor}
                    onChange={(e) => setCompraForm({ ...compraForm, id_proveedor: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  >
                    <option value="">-- Seleccionar Proveedor --</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Fecha de Compra *</label>
                  <input
                    type="date"
                    required
                    value={compraForm.fecha}
                    onChange={(e) => setCompraForm({ ...compraForm, fecha: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Agregar Producto a la Compra</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      agregarItemCompra(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                >
                  <option value="">-- Selecciona un producto para añadir --</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock actual: {p.cantidad})</option>)}
                </select>
              </div>

              {/* Lista de Ítems */}
              <div style={{ backgroundColor: 'var(--background)', borderRadius: '0.375rem', padding: '0.75rem', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Productos en la Compra:</h4>
                {compraForm.items.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>No se han agregado productos.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {compraForm.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>{item.nombre}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Cantidad"
                          value={item.cantidad}
                          onChange={(e) => actualizarItemCompra(idx, 'cantidad', e.target.value)}
                          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.3rem', borderRadius: '0.25rem' }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Precio Unit."
                          value={item.precio_unitario}
                          onChange={(e) => actualizarItemCompra(idx, 'precio_unitario', e.target.value)}
                          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.3rem', borderRadius: '0.25rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => eliminarItemCompra(idx)}
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totales */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background)', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={compraForm.tiene_factura_iva}
                    onChange={(e) => {
                      setCompraForm(prev => ({ ...prev, tiene_factura_iva: e.target.checked }))
                      recalcularTotalesCompra(compraForm.items, e.target.checked)
                    }}
                  />
                  <span>Aplica IVA (15%)</span>
                </label>

                <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--foreground)' }}>
                  <div>Subtotal: <strong>C$ {compraForm.monto_subtotal}</strong></div>
                  <div>IVA: <strong>C$ {compraForm.monto_iva}</strong></div>
                  <div style={{ fontSize: '1.1rem', color: 'var(--yellow-400)', fontWeight: 'bold' }}>Total: C$ {compraForm.monto_total}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalCompra(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#10B981', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Guardar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Ajuste Manual ── */}
      {modalAjuste && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--foreground)' }}>⚙️ Ajuste Manual de Inventario</h2>

            <form onSubmit={handleGuardarAjuste} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Producto *</label>
                <select
                  required
                  value={ajusteForm.id_inventario}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, id_inventario: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                >
                  <option value="">-- Seleccionar Producto --</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Actual: {p.cantidad})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Tipo de Ajuste</label>
                  <select
                    value={ajusteForm.tipo_ajuste}
                    onChange={(e) => setAjusteForm({ ...ajusteForm, tipo_ajuste: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  >
                    <option value="incremento">➕ Entrada / Incremento</option>
                    <option value="decremento">➖ Salida / Merma</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Cantidad *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ajusteForm.cantidad}
                    onChange={(e) => setAjusteForm({ ...ajusteForm, cantidad: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>Nota / Justificación</label>
                <textarea
                  rows="2"
                  placeholder="Ej: Corrección de conteo, producto dañado, etc."
                  value={ajusteForm.nota}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, nota: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem', borderRadius: '0.375rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalAjuste(false)}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#6366F1', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Aplicar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Detalle de Producto ── */}
      {modalDetalle && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--foreground)' }}>🔍 Detalle de Producto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--foreground)', fontSize: '0.9rem' }}>
              <div><strong>Nombre:</strong> {modalDetalle.nombre}</div>
              <div><strong>Proveedor:</strong> {modalDetalle.proveedor_nombre || 'N/A'}</div>
              <div><strong>Precio Unitario:</strong> C$ {Number(modalDetalle.precio_unidad).toFixed(2)}</div>
              <div><strong>Stock Actual:</strong> {modalDetalle.cantidad} {modalDetalle.unidad_medida}</div>
              <div><strong>Stock Mínimo:</strong> {modalDetalle.stock_minimo} {modalDetalle.unidad_medida}</div>
              <div><strong>Fecha de Expiración:</strong> {modalDetalle.fecha_expiracion ? modalDetalle.fecha_expiracion.split('T')[0] : 'Sin fecha'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setModalDetalle(null)}
                style={{ backgroundColor: 'var(--yellow-500)', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Historial Movimientos ── */}
      {modalMovimientos && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', width: '100%', maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--foreground)' }}>📜 Historial de Movimientos</h2>
              <button onClick={() => setModalMovimientos(false)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--foreground)', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Fecha</th>
                  <th style={{ padding: '0.5rem' }}>Producto</th>
                  <th style={{ padding: '0.5rem' }}>Tipo</th>
                  <th style={{ padding: '0.5rem' }}>Cantidad</th>
                  <th style={{ padding: '0.5rem' }}>Usuario</th>
                  <th style={{ padding: '0.5rem' }}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{new Date(m.fecha).toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{m.producto_nombre}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{
                        padding: '0.15rem 0.4rem',
                        borderRadius: '0.2rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: m.tipo === 'entrada_compra' ? 'rgba(16, 185, 129, 0.2)' : m.tipo === 'salida_orden' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                        color: m.tipo === 'entrada_compra' ? '#10B981' : m.tipo === 'salida_orden' ? '#EF4444' : '#6366F1'
                      }}>
                        {m.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', color: Number(m.cantidad) >= 0 ? '#10B981' : '#EF4444' }}>
                      {Number(m.cantidad) > 0 ? `+${m.cantidad}` : m.cantidad} {m.unidad_medida}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{m.usuario_nombre}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--neutral-400)' }}>{m.nota || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}





