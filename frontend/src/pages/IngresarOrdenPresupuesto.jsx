import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const IVA_RATE = 0.15
const getToken = () => localStorage.getItem('token')

function fmt(n) {
  return Number(n).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function badgeEstado(estado) {
  const map = {
    pendiente: { bg: 'rgba(255,195,0,0.12)',  color: 'var(--yellow-400)', border: 'rgba(255,195,0,0.3)'  },
    aprobado:  { bg: 'rgba(34,197,94,0.12)',  color: 'var(--success)',    border: 'rgba(34,197,94,0.3)'  },
    rechazado: { bg: 'rgba(229,72,77,0.12)',  color: 'var(--danger)',     border: 'rgba(229,72,77,0.3)'  },
  }
  const { bg, color, border } = map[estado] || map.pendiente
  return {
    display: 'inline-block', backgroundColor: bg, color, border: `1px solid ${border}`,
    borderRadius: 'var(--radius-full)', padding: '0.15rem 0.6rem',
    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
  }
}

// ─── calcula el total con IVA de una línea ─────────────────────────────────
function valorLinea(cantidad, precio_unitario, aplica_iva) {
  const base = parseFloat(cantidad || 0) * parseFloat(precio_unitario || 0)
  return aplica_iva ? base * (1 + IVA_RATE) : base
}

// ─── calcula la suma de todas las líneas existentes ────────────────────────
function sumaDetalles(detalles) {
  return detalles.reduce((acc, d) => acc + valorLinea(d.cantidad, d.precio_unitario, d.aplica_iva), 0)
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

function BannerContexto({ cliente, vehiculo, onCambiarVehiculo }) {
  return (
    <div style={s.banner}>
      <div style={s.bannerBloque}>
        <span style={s.bannerLabel}>Cliente</span>
        <span style={s.bannerValor}>{cliente.nombre}</span>
        <span style={s.bannerSub}>{cliente.cedula}</span>
      </div>
      <div style={s.bannerSep} />
      <div style={s.bannerBloque}>
        <span style={s.bannerLabel}>Vehículo</span>
        <span style={s.bannerValor}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio_fabricacion}</span>
        <span style={s.bannerSub}>{vehiculo.matricula}</span>
      </div>
      <button onClick={onCambiarVehiculo} style={s.bannerCambiar}>← Cambiar</button>
    </div>
  )
}

function TarjetaPresupuesto({ p, activo, onClick }) {
  return (
    <div
      onClick={() => onClick(p)}
      style={activo ? { ...s.tarjeta, ...s.tarjetaActiva } : s.tarjeta}
    >
      <div style={s.tarjetaFila}>
        <span style={s.tarjetaId}>#{p.id}</span>
        <span style={badgeEstado(p.estado)}>{p.estado}</span>
      </div>
      <div style={s.tarjetaFila}>
        <span style={s.tarjetaMeta}>{new Date(p.fecha).toLocaleDateString('es-NI')}</span>
        <span style={s.tarjetaTotal}>C$ {fmt(p.total)}</span>
      </div>
      {p.observaciones && (
        <p style={s.tarjetaObs}>{p.observaciones}</p>
      )}
    </div>
  )
}

function FilaDetalle({ d, onEliminar }) {
  return (
    <div style={s.filaDetalle}>
      <span style={s.detalleTipo}>{d.tipo_linea}</span>
      <span style={s.detalleDesc}>{d.descripcion}</span>
      <span style={s.detalleMeta}>×{d.cantidad}</span>
      <span style={s.detalleMeta}>C$ {fmt(d.precio_unitario)}</span>
      <span style={d.aplica_iva ? s.ivaTrue : s.ivaFalse}>{d.aplica_iva ? 'IVA' : '—'}</span>
      <span style={s.detalleLineatotal}>C$ {fmt(valorLinea(d.cantidad, d.precio_unitario, d.aplica_iva))}</span>
      <button onClick={() => onEliminar(d.id)} style={s.btnEliminar}>✕</button>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function IngresarOrdenPresupuesto() {
  const navigate = useNavigate()
  const location = useLocation()

  const cliente  = location.state?.cliente  ?? null
  const vehiculo = location.state?.vehiculo ?? null

  const [presupuestos, setPresupuestos]           = useState([])
  const [presupuestoActivo, setPresupuestoActivo] = useState(null)
  const [detalles, setDetalles]                   = useState([])
  const [hayPresupuesto, setHayPresupuesto]        = useState(false)

  // formulario presupuesto
  const [subtotalInput, setSubtotalInput] = useState('')
  const [obsInput, setObsInput]           = useState('')
  const [ivaCalc, setIvaCalc]             = useState(0)
  const [totalCalc, setTotalCalc]         = useState(0)
  const [creandoPres, setCreandoPres]     = useState(false)
  const [errorPres, setErrorPres]         = useState('')

  // formulario detalle
  const [formDet, setFormDet] = useState({
    tipo_linea: 'servicio', descripcion: '', cantidad: '', precio_unitario: '', aplica_iva: false,
  })
  const [creandoDet, setCreandoDet] = useState(false)
  const [errorDet, setErrorDet]     = useState('')

  const detallesRef = useRef(null)

  useEffect(() => {
    if (!vehiculo) return
    cargarPresupuestos()
  }, [vehiculo])

  async function cargarPresupuestos() {
    try {
      const res  = await fetch(
        `http://localhost:3001/api/presupuestos?id_vehiculo=${vehiculo.id}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      )
      const data = await res.json()
      if (res.ok) {
        setPresupuestos(data)
        setHayPresupuesto(data.length > 0)
      }
    } catch { /* silencioso */ }
  }

  async function seleccionarPresupuesto(p) {
    if (presupuestoActivo?.id === p.id) {
      setPresupuestoActivo(null)
      setDetalles([])
      return
    }
    setPresupuestoActivo(p)
    setErrorDet('')
    try {
      const res  = await fetch(
        `http://localhost:3001/api/presupuestos/${p.id}/detalles`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      )
      const data = await res.json()
      if (res.ok) setDetalles(data)
    } catch { setDetalles([]) }
    setTimeout(() => detallesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  function handleSubtotalChange(e) {
    const val = e.target.value
    setSubtotalInput(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) {
      const iva   = parseFloat((n * IVA_RATE).toFixed(2))
      const total = parseFloat((n + iva).toFixed(2))
      setIvaCalc(iva)
      setTotalCalc(total)
    } else {
      setIvaCalc(0)
      setTotalCalc(0)
    }
  }

  async function handleCrearPresupuesto(e) {
    e.preventDefault()
    setErrorPres('')
    setCreandoPres(true)
    try {
      const res  = await fetch('http://localhost:3001/api/presupuestos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ id_vehiculo: vehiculo.id, subtotal: subtotalInput, observaciones: obsInput }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorPres(data.message || 'Error al crear presupuesto.'); return }
      const nuevos = [data, ...presupuestos]
      setPresupuestos(nuevos)
      setHayPresupuesto(true)
      setSubtotalInput('')
      setObsInput('')
      setIvaCalc(0)
      setTotalCalc(0)
      seleccionarPresupuesto(data)
    } catch {
      setErrorPres('No se pudo conectar con el servidor.')
    } finally {
      setCreandoPres(false)
    }
  }

  function handleDetChange(e) {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormDet(prev => ({ ...prev, [e.target.name]: val }))
  }

  async function handleCrearDetalle(e) {
    e.preventDefault()
    if (!presupuestoActivo) return
    setErrorDet('')

    // ── validación monetaria ──────────────────────────────────────────────
    const nuevaLinea = valorLinea(formDet.cantidad, formDet.precio_unitario, formDet.aplica_iva)
    const sumaActual = sumaDetalles(detalles)
    const totalPres  = parseFloat(presupuestoActivo.total)

    if (sumaActual + nuevaLinea > totalPres) {
      const disponible = totalPres - sumaActual
      setErrorDet(
        `Esta línea (C$ ${fmt(nuevaLinea)}) excede el presupuesto. ` +
        `Margen disponible: C$ ${fmt(disponible > 0 ? disponible : 0)}.`
      )
      return
    }

    setCreandoDet(true)
    try {
      const res  = await fetch(
        `http://localhost:3001/api/presupuestos/${presupuestoActivo.id}/detalles`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body:    JSON.stringify(formDet),
        }
      )
      const data = await res.json()
      if (!res.ok) { setErrorDet(data.message || 'Error al agregar detalle.'); return }
      setDetalles(prev => [...prev, data])
      setFormDet({ tipo_linea: 'servicio', descripcion: '', cantidad: '', precio_unitario: '', aplica_iva: false })
    } catch {
      setErrorDet('No se pudo conectar con el servidor.')
    } finally {
      setCreandoDet(false)
    }
  }

  async function handleEliminarDetalle(id) {
    try {
      await fetch(`http://localhost:3001/api/presupuestos/detalles/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setDetalles(prev => prev.filter(d => d.id !== id))
    } catch { /* silencioso */ }
  }

  function handleAvanzar() {
    navigate('/ordenes/nueva/orden', { state: { cliente, vehiculo, presupuesto: presupuestoActivo } })
  }

  if (!cliente || !vehiculo) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={s.bloqueado}>
            <p style={s.bloqueadoTitulo}>⚠ Sin vehículo seleccionado</p>
            <p style={s.bloqueadoTexto}>No se puede acceder al paso 3 sin cliente y vehículo confirmados.</p>
            <button onClick={() => navigate('/ordenes/nueva')} style={s.btnPrimary}>← Volver al Paso 1</button>
          </div>
        </div>
      </div>
    )
  }

  // ── margen disponible para mostrar en el formulario de detalle ────────────
  const margenDisponible = presupuestoActivo
    ? parseFloat(presupuestoActivo.total) - sumaDetalles(detalles)
    : 0

  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <span style={s.eyebrow}>Ruta 1 — Paso 3 de 4</span>
          <h1 style={s.titulo}>Ingresar <span style={s.accent}>Orden</span></h1>
          <p style={s.subtitulo}>Presupuesto</p>
        </div>

        <BannerContexto
          cliente={cliente}
          vehiculo={vehiculo}
          onCambiarVehiculo={() => navigate('/ordenes/nueva/vehiculo', { state: { cliente } })}
        />

        {/* ── fila superior: formulario presupuesto (izq) + lista presupuestos (der) ── */}
        <div style={s.fila}>

          {/* izquierda — formulario nuevo presupuesto */}
          <div style={s.bloque}>
            <h2 style={s.bloqueTitulo}>Nuevo <span style={s.accent}>presupuesto</span></h2>
            <form onSubmit={handleCrearPresupuesto} style={s.form}>

              <div style={s.field}>
                <label style={s.label}><span style={s.labelAccent}>Subtotal</span> (C$)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={subtotalInput}
                  onChange={handleSubtotalChange}
                  placeholder="Ej: 5000.00"
                  style={s.input}
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)}
                  required
                />
              </div>

              <div style={s.filaCalc}>
                <div style={s.fieldCalc}>
                  <label style={s.labelDim}>IVA (15%)</label>
                  <input type="text" value={`C$ ${fmt(ivaCalc)}`} disabled style={s.inputDisabled} />
                </div>
                <div style={s.fieldCalc}>
                  <label style={s.labelDim}>Total</label>
                  <input
                    type="text" value={`C$ ${fmt(totalCalc)}`} disabled
                    style={{ ...s.inputDisabled, color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' }}
                  />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  <span style={s.labelAccent}>Observaciones</span>
                  <span style={s.labelOpcional}> — opcional</span>
                </label>
                <textarea
                  value={obsInput}
                  onChange={e => setObsInput(e.target.value)}
                  placeholder="Notas adicionales para este presupuesto..."
                  rows={3}
                  style={s.textarea}
                  onFocus={e => Object.assign(e.target.style, s.textareaFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.textarea)}
                />
              </div>

              {errorPres && <p style={s.errorMsg}>{errorPres}</p>}

              <button
                type="submit"
                disabled={creandoPres || !subtotalInput}
                style={creandoPres || !subtotalInput ? s.btnDisabledFull : s.btnPrimaryFull}
              >
                {creandoPres ? 'Guardando...' : 'Crear presupuesto'}
              </button>
            </form>
          </div>

          {/* derecha — lista de presupuestos del vehículo */}
          <div style={hayPresupuesto ? s.bloque : s.bloqueInactivo}>
            <h2 style={s.bloqueTitulo}>
              Presupuestos de este <span style={hayPresupuesto ? s.accent : s.accentDim}>vehículo</span>
            </h2>
            {!hayPresupuesto ? (
              <p style={s.inactivoTexto}>Aún no hay presupuestos registrados para este vehículo.</p>
            ) : (
              <div style={s.listaPresupuestos}>
                {presupuestos.map(p => (
                  <TarjetaPresupuesto
                    key={p.id} p={p}
                    activo={presupuestoActivo?.id === p.id}
                    onClick={seleccionarPresupuesto}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── fila inferior: formulario detalle (izq) + lista detalles (der) ── */}
        <div ref={detallesRef} style={s.fila}>

          {/* izquierda — formulario nueva línea */}
          <div style={presupuestoActivo ? s.bloque : s.bloqueInactivo}>
            <h2 style={s.bloqueTitulo}>
              Agregar <span style={presupuestoActivo ? s.accent : s.accentDim}>línea</span>
              {presupuestoActivo && <span style={s.labelOpcional}> a presupuesto #{presupuestoActivo.id}</span>}
            </h2>

            {/* margen disponible */}
            {presupuestoActivo && (
              <div style={margenDisponible <= 0 ? s.margenAgotado : s.margenDisponible}>
                <span style={s.margenLabel}>Margen disponible</span>
                <span style={s.margenValor}>C$ {fmt(margenDisponible > 0 ? margenDisponible : 0)}</span>
                {margenDisponible <= 0 && (
                  <span style={s.margenWarning}>— Presupuesto completo, no se pueden agregar más líneas.</span>
                )}
              </div>
            )}

            {!presupuestoActivo ? (
              <p style={s.inactivoTexto}>Seleccioná un presupuesto arriba para agregarle líneas.</p>
            ) : margenDisponible <= 0 ? (
              <p style={s.inactivoTexto}>El presupuesto ya está completamente cubierto por las líneas existentes.</p>
            ) : (
              <form onSubmit={handleCrearDetalle} style={s.form}>

                <div style={s.field}>
                  <label style={s.label}><span style={s.labelAccent}>Tipo de línea</span></label>
                  <select name="tipo_linea" value={formDet.tipo_linea} onChange={handleDetChange} style={s.input}>
                    <option value="servicio">Servicio</option>
                    <option value="material">Material</option>
                    <option value="repuesto">Repuesto</option>
                  </select>
                </div>

                <div style={s.field}>
                  <label style={s.label}><span style={s.labelAccent}>Descripción</span></label>
                  <input
                    type="text" name="descripcion" value={formDet.descripcion} onChange={handleDetChange}
                    placeholder="Ej: Pintura de capó, lijado y base"
                    style={s.input} required
                    onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={e  => Object.assign(e.target.style, s.input)}
                  />
                </div>

                <div style={s.filaCalc}>
                  <div style={s.fieldCalc}>
                    <label style={s.label}><span style={s.labelAccent}>Cantidad</span></label>
                    <input
                      type="number" name="cantidad" value={formDet.cantidad} onChange={handleDetChange}
                      placeholder="Ej: 2" min="1" step="1" style={s.input} required
                      onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={e  => Object.assign(e.target.style, s.input)}
                    />
                  </div>
                  <div style={s.fieldCalc}>
                    <label style={s.label}><span style={s.labelAccent}>Precio unitario</span> (C$)</label>
                    <input
                      type="number" name="precio_unitario" value={formDet.precio_unitario} onChange={handleDetChange}
                      placeholder="Ej: 1500.00" min="0" step="0.01" style={s.input} required
                      onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                      onBlur={e  => Object.assign(e.target.style, s.input)}
                    />
                  </div>
                </div>

                {/* preview del valor de esta línea */}
                {formDet.cantidad && formDet.precio_unitario && (
                  <div style={s.previewLinea}>
                    <span style={s.previewLabel}>Esta línea vale</span>
                    <span style={s.previewValor}>
                      C$ {fmt(valorLinea(formDet.cantidad, formDet.precio_unitario, formDet.aplica_iva))}
                    </span>
                  </div>
                )}

                <label style={s.checkboxRow}>
                  <input
                    type="checkbox" name="aplica_iva"
                    checked={formDet.aplica_iva} onChange={handleDetChange}
                    style={s.checkbox}
                  />
                  <span style={s.label}>Aplica <span style={s.labelAccent}>IVA</span> en esta línea</span>
                </label>

                {errorDet && <p style={s.errorMsg}>{errorDet}</p>}

                <button
                  type="submit" disabled={creandoDet}
                  style={creandoDet ? s.btnDisabledFull : s.btnPrimaryFull}
                >
                  {creandoDet ? 'Guardando...' : 'Agregar línea'}
                </button>
              </form>
            )}
          </div>

          {/* derecha — lista de líneas del presupuesto seleccionado */}
          <div style={presupuestoActivo ? s.bloque : s.bloqueInactivo}>
            <h2 style={s.bloqueTitulo}>
              Líneas de <span style={presupuestoActivo ? s.accent : s.accentDim}>
                {presupuestoActivo ? `presupuesto #${presupuestoActivo.id}` : 'presupuesto'}
              </span>
            </h2>
            {!presupuestoActivo ? (
              <p style={s.inactivoTexto}>Seleccioná un presupuesto arriba para ver sus líneas.</p>
            ) : detalles.length === 0 ? (
              <p style={s.inactivoTexto}>Este presupuesto aún no tiene líneas. Agregá una a la izquierda.</p>
            ) : (
              <>
                <div style={s.listaDetalles}>
                  <div style={s.filaDetalleHeader}>
                    <span style={s.detalleLabelCol}>Tipo</span>
                    <span style={s.detalleLabelCol}>Descripción</span>
                    <span style={s.detalleLabelCol}>Cant.</span>
                    <span style={s.detalleLabelCol}>P. unit.</span>
                    <span style={s.detalleLabelCol}>IVA</span>
                    <span style={s.detalleLabelCol}>Total línea</span>
                    <span style={s.detalleLabelCol} />
                  </div>
                  {detalles.map(d => (
                    <FilaDetalle key={d.id} d={d} onEliminar={handleEliminarDetalle} />
                  ))}
                </div>

                {/* total acumulado de líneas */}
                <div style={s.totalLineas}>
                  <span style={s.totalLineasLabel}>Total líneas</span>
                  <span style={s.totalLineasValor}>C$ {fmt(sumaDetalles(detalles))}</span>
                </div>
              </>
            )}
          </div>

        </div>

        {/* botón de avance */}
        <div style={s.avanceRow}>
          <button
            onClick={() => navigate('/ordenes/nueva/vehiculo', { state: { cliente } })}
            style={s.btnSecondaryFull}
          >
            ← Volver al paso 2
          </button>
          <button onClick={handleAvanzar} style={s.btnAvanzar}>
            {hayPresupuesto ? 'Avanzar a orden →' : 'Avanzar sin presupuesto →'}
          </button>
        </div>

      </div>
    </div>
  )
}

const s = {
  page:              { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:         { width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2rem' },
  header:            { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  eyebrow:           { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:            { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  subtitulo:         { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0 },
  accent:            { color: 'var(--yellow-500)' },
  accentDim:         { color: 'var(--neutral-400)' },

  banner:            { display: 'flex', alignItems: 'center', gap: '1.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--blue-700)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.25rem' },
  bannerBloque:      { display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  bannerLabel:       { fontSize: 'var(--text-xs)', color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--weight-medium)' },
  bannerValor:       { fontSize: 'var(--text-body)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  bannerSub:         { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  bannerSep:         { width: '1px', height: '36px', backgroundColor: 'var(--border)', flexShrink: 0 },
  bannerCambiar:     { marginLeft: 'auto', backgroundColor: 'transparent', color: 'var(--danger)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(229,72,77,0.3)', cursor: 'pointer', flexShrink: 0 },

  fila:              { display: 'flex', gap: '1.5rem', alignItems: 'flex-start' },
  bloque:            { flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 },
  bloqueInactivo:    { flex: 1, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, opacity: 0.45 },
  bloqueTitulo:      { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0 },
  inactivoTexto:     { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0 },

  // margen disponible
  margenDisponible:  { display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem' },
  margenAgotado:     { display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(229,72,77,0.07)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem', flexWrap: 'wrap' },
  margenLabel:       { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'var(--weight-medium)', flexShrink: 0 },
  margenValor:       { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--success)' },
  margenWarning:     { fontSize: 'var(--text-xs)', color: 'var(--danger)', fontWeight: 'var(--weight-medium)' },

  // preview línea
  previewLinea:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' },
  previewLabel:      { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  previewValor:      { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },

  form:              { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field:             { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  fieldCalc:         { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  filaCalc:          { display: 'flex', gap: '0.75rem' },
  label:             { fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' },
  labelDim:          { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)' },
  labelAccent:       { color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  labelOpcional:     { color: 'var(--neutral-400)', fontWeight: 'var(--weight-regular)', fontSize: 'var(--text-xs)' },
  input:             { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s' },
  inputFocus:        { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxShadow: 'var(--glow-yellow)' },
  inputDisabled:     { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--neutral-300)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', cursor: 'not-allowed' },
  textarea:          { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', resize: 'vertical', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  textareaFocus:     { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', resize: 'vertical', fontFamily: 'inherit', boxShadow: 'var(--glow-yellow)' },
  checkboxRow:       { display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' },
  checkbox:          { width: '16px', height: '16px', accentColor: 'var(--yellow-500)', cursor: 'pointer', flexShrink: 0 },

  listaPresupuestos: { display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '340px', overflowY: 'auto' },
  tarjeta:           { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.4rem', transition: 'border-color 0.15s' },
  tarjetaActiva:     { border: '1px solid var(--yellow-500)', boxShadow: 'var(--glow-yellow)' },
  tarjetaFila:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tarjetaId:         { fontSize: 'var(--text-small)', color: 'var(--neutral-300)', fontWeight: 'var(--weight-medium)' },
  tarjetaMeta:       { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  tarjetaTotal:      { fontSize: 'var(--text-body)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  tarjetaObs:        { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  listaDetalles:     { display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '280px', overflowY: 'auto' },
  filaDetalleHeader: { display: 'grid', gridTemplateColumns: '80px 1fr 50px 80px 40px 90px 28px', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border)' },
  filaDetalle:       { display: 'grid', gridTemplateColumns: '80px 1fr 50px 80px 40px 90px 28px', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  detalleLabelCol:   { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)' },
  detalleTipo:       { fontSize: 'var(--text-xs)', color: 'var(--blue-300)', fontWeight: 'var(--weight-medium)', textTransform: 'capitalize' },
  detalleDesc:       { fontSize: 'var(--text-small)', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  detalleMeta:       { fontSize: 'var(--text-small)', color: 'var(--neutral-200)' },
  detalleLineatotal: { fontSize: 'var(--text-small)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  ivaTrue:           { fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 'var(--weight-medium)' },
  ivaFalse:          { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },

  totalLineas:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' },
  totalLineasLabel:  { fontSize: 'var(--text-small)', color: 'var(--neutral-300)', fontWeight: 'var(--weight-medium)' },
  totalLineasValor:  { fontSize: 'var(--text-body)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },

  avanceRow:         { display: 'flex', gap: '1rem' },
  btnPrimaryFull:    { width: '100%', backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnDisabledFull:   { width: '100%', backgroundColor: 'var(--surface)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
  btnSecondaryFull:  { flex: 1, backgroundColor: 'var(--surface-raised)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnPrimary:        { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.7rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnAvanzar:        { flex: 2, backgroundColor: 'var(--blue-700)', color: 'var(--foreground)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--blue-600)', cursor: 'pointer', textAlign: 'center' },
  btnEliminar:       { backgroundColor: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', flexShrink: 0 },

  bloqueado:         { backgroundColor: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '460px', width: '100%' },
  bloqueadoTitulo:   { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--danger)', margin: 0 },
  bloqueadoTexto:    { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 },

  errorMsg:          { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },
}