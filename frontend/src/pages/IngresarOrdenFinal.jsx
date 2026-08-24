import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = 'http://localhost:3001'

function BannerContexto({ cliente, vehiculo, presupuesto, onCambiarVehiculo }) {
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
      {presupuesto && (
        <>
          <div style={s.bannerSep} />
          <div style={s.bannerBloque}>
            <span style={s.bannerLabel}>Presupuesto</span>
            <span style={s.bannerValor}>#{presupuesto.id}</span>
            <span style={s.bannerSub}>C$ {Number(presupuesto.total).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
          </div>
        </>
      )}
      <button onClick={onCambiarVehiculo} style={s.bannerCambiar}>← Cambiar</button>
    </div>
  )
}

export default function IngresarOrdenFinal() {
  const navigate = useNavigate()
  const location = useLocation()

  const cliente    = location.state?.cliente    ?? null
  const vehiculo   = location.state?.vehiculo   ?? null
  const presupuesto = location.state?.presupuesto ?? null

  // form fields
  const [tipo, setTipo]                             = useState('pintura')
  const [fechaIngreso, setFechaIngreso]             = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16) // datetime-local format
  })
  const [fechaEntregaEst, setFechaEntregaEst]       = useState('')
  const [tipoPago, setTipoPago]                     = useState(vehiculo?.aseguradora !== 'ninguna' ? vehiculo?.aseguradora : 'particular')
  const [numeroTramite, setNumeroTramite]           = useState('')
  const [numeroOrdenSeguro, setNumeroOrdenSeguro]   = useState('')
  const [montoSeguro, setMontoSeguro]               = useState('')
  const [montoCliente, setMontoCliente]             = useState('')
  const [esGarantia, setEsGarantia]                 = useState(false)
  const [fechaVencGarantia, setFechaVencGarantia]   = useState('')
  const [obraExterna, setObraExterna]               = useState(false)
  const [obraInterna, setObraInterna]               = useState(false)

  // orden derivada
  const [esDerivada, setEsDerivada]                 = useState(false)
  const [tipoDerivada, setTipoDerivada]             = useState('garantia') // 'garantia' | 'dano_oculto'
  const [busquedaOrigenQ, setBusquedaOrigenQ]       = useState('')
  const [ordenesOrigen, setOrdenesOrigen]           = useState([])
  const [idOrdenOrigen, setIdOrdenOrigen]           = useState(null)
  const [ordenOrigenSeleccionada, setOrdenOrigenSeleccionada] = useState(null)
  const [buscandoOrigen, setBuscandoOrigen]         = useState(false)

  // submit
  const [creando, setCreando]   = useState(false)
  const [error, setError]       = useState('')
  const [ordenCreada, setOrdenCreada] = useState(null)

  const esSeguro = tipoPago === 'lafise' || tipoPago === 'iniser'

  // Si viene con presupuesto y ese presupuesto ya tiene aseguradora implícita
  // del vehículo, pre-seleccionamos tipo_pago
  useEffect(() => {
    if (vehiculo?.aseguradora && vehiculo.aseguradora !== 'ninguna') {
      setTipoPago(vehiculo.aseguradora)
    }
  }, [])

  // Buscar órdenes para id_orden_origen
  useEffect(() => {
    if (!esDerivada || busquedaOrigenQ.length < 2) {
      setOrdenesOrigen([])
      return
    }
    const t = setTimeout(async () => {
      setBuscandoOrigen(true)
      try {
        const res = await fetch(
          `${API}/api/ordenes?q=${encodeURIComponent(busquedaOrigenQ)}&solo_activas=false`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        )
        if (res.ok) {
          const data = await res.json()
          setOrdenesOrigen(data.slice(0, 8))
        }
      } catch { /* silencioso */ }
      finally { setBuscandoOrigen(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [busquedaOrigenQ, esDerivada])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCreando(true)

    // validaciones básicas
    if (esSeguro && !numeroTramite.trim()) {
      setError('El número de trámite es obligatorio para órdenes con seguro.')
      setCreando(false)
      return
    }
    if (esDerivada && !idOrdenOrigen) {
      setError('Debés seleccionar la orden de origen.')
      setCreando(false)
      return
    }

    // si es derivada por garantia → es_garantia = true
    // si es derivada por dano_oculto → danos_ocultos se activa luego con la operación
    const payload = {
      id_vehiculo:             vehiculo.id,
      id_presupuesto:          presupuesto?.id ?? null,
      id_orden_origen:         esDerivada ? idOrdenOrigen : null,
      tipo,
      fecha_ingreso:           fechaIngreso,
      fecha_entrega_estimada:  fechaEntregaEst || null,
      tipo_pago:               tipoPago,
      es_garantia:             esDerivada && tipoDerivada === 'garantia',
      fecha_vencimiento_garantia: esGarantia && fechaVencGarantia ? fechaVencGarantia : null,
      obra_externa:            obraExterna,
      obra_interna:            obraInterna,
      numero_tramite:          esSeguro ? numeroTramite.trim() : null,
      numero_orden_seguro:     esSeguro ? numeroOrdenSeguro.trim() || null : null,
      monto_seguro:            esSeguro && montoSeguro ? parseFloat(montoSeguro) : null,
      monto_cliente:           esSeguro && montoCliente ? parseFloat(montoCliente) : null,
    }

    try {
      const res = await fetch(`${API}/api/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al crear la orden.'); return }
      setOrdenCreada(data)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setCreando(false)
    }
  }

  // bloqueo sin contexto
  if (!cliente || !vehiculo) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={s.bloqueado}>
            <p style={s.bloqueadoTitulo}>⚠ Sin vehículo seleccionado</p>
            <p style={s.bloqueadoTexto}>No se puede acceder al paso 4 sin cliente y vehículo confirmados.</p>
            <button onClick={() => navigate('/ordenes/nueva')} style={s.btnPrimary}>← Volver al Paso 1</button>
          </div>
        </div>
      </div>
    )
  }

  // pantalla de éxito
  if (ordenCreada) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={s.exito}>
            <p style={s.exitoIcon}>✓</p>
            <h2 style={s.exitoTitulo}>Orden <span style={s.accent}>#{ordenCreada.id}</span> creada</h2>
            <p style={s.exitoSub}>
              {ordenCreada.matricula} — {ordenCreada.nombre_cliente}
            </p>
            <p style={s.exitoMeta}>
              Tipo: {ordenCreada.tipo} · Pago: {ordenCreada.tipo_pago} · Estado: recibido
            </p>
            <div style={s.exitoBtns}>
              <button
                onClick={() => navigate(`/ordenes/${ordenCreada.id}/operaciones`)}
                style={s.btnPrimary}
              >
                Ir a Operaciones →
              </button>
              <button
                onClick={() => navigate('/ordenes')}
                style={s.btnSecondary}
              >
                Ver todas las órdenes
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* encabezado */}
        <div style={s.header}>
          <span style={s.eyebrow}>Ruta 1 — Paso 4 de 4</span>
          <h1 style={s.titulo}>Ingresar <span style={s.accent}>Orden</span></h1>
          <p style={s.subtitulo}>Datos de la orden</p>
        </div>

        {/* banner */}
        <BannerContexto
          cliente={cliente}
          vehiculo={vehiculo}
          presupuesto={presupuesto}
          onCambiarVehiculo={() => navigate('/ordenes/nueva/vehiculo', { state: { cliente } })}
        />

        <form onSubmit={handleSubmit} style={s.form}>

          {/* ── fila 1: tipo + fecha ingreso + fecha entrega ── */}
          <div style={s.filaGrid3}>
            <div style={s.field}>
              <label style={s.label}><span style={s.accent}>Tipo de orden</span></label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={s.input} required>
                <option value="pintura">Pintura</option>
                <option value="mecanica">Mecánica</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}><span style={s.accent}>Fecha de ingreso</span></label>
              <input
                type="datetime-local"
                value={fechaIngreso}
                onChange={e => setFechaIngreso(e.target.value)}
                style={s.input}
                required
                onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                onBlur={e  => Object.assign(e.target.style, s.input)}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>
                <span style={s.accent}>Fecha entrega estimada</span>
                <span style={s.opcional}> — opcional</span>
              </label>
              <input
                type="date"
                value={fechaEntregaEst}
                onChange={e => setFechaEntregaEst(e.target.value)}
                style={s.input}
                onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                onBlur={e  => Object.assign(e.target.style, s.input)}
              />
            </div>
          </div>

          {/* ── tipo de pago ── */}
          <div style={s.separador} />
          <div style={s.field}>
            <label style={s.label}><span style={s.accent}>Tipo de pago</span></label>
            <div style={s.radioGroup}>
              {['particular', 'lafise', 'iniser'].map(op => (
                <label key={op} style={tipoPago === op ? s.radioBtnActivo : s.radioBtn}>
                  <input
                    type="radio"
                    name="tipo_pago"
                    value={op}
                    checked={tipoPago === op}
                    onChange={() => setTipoPago(op)}
                    style={{ display: 'none' }}
                  />
                  {op.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* ── campos de seguro (condicional) ── */}
          {esSeguro && (
            <div style={s.bloqueSeguro}>
              <p style={s.bloqueSeguroTitulo}>Datos de seguro — {tipoPago.toUpperCase()}</p>
              <div style={s.filaGrid2}>
                <div style={s.field}>
                  <label style={s.label}><span style={s.accent}>Número de trámite</span></label>
                  <input
                    type="text"
                    value={numeroTramite}
                    onChange={e => setNumeroTramite(e.target.value)}
                    placeholder="Ej: 423686"
                    style={s.input}
                    required={esSeguro}
                    onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={e  => Object.assign(e.target.style, s.input)}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>
                    <span style={s.accent}>Número de orden del seguro</span>
                    <span style={s.opcional}> — opcional</span>
                  </label>
                  <input
                    type="text"
                    value={numeroOrdenSeguro}
                    onChange={e => setNumeroOrdenSeguro(e.target.value)}
                    placeholder="Ej: 400542"
                    style={s.input}
                    onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={e  => Object.assign(e.target.style, s.input)}
                  />
                </div>
              </div>
              <div style={s.filaGrid2}>
                <div style={s.field}>
                  <label style={s.label}>
                    <span style={s.accent}>Monto cubierto por seguro</span>
                    <span style={s.opcional}> — opcional</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoSeguro}
                    onChange={e => setMontoSeguro(e.target.value)}
                    placeholder="C$ 0.00"
                    style={s.input}
                    onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={e  => Object.assign(e.target.style, s.input)}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>
                    <span style={s.accent}>Monto adicional al cliente</span>
                    <span style={s.opcional}> — opcional</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoCliente}
                    onChange={e => setMontoCliente(e.target.value)}
                    placeholder="C$ 0.00"
                    style={s.input}
                    onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                    onBlur={e  => Object.assign(e.target.style, s.input)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── obra externa / interna ── */}
          <div style={s.separador} />
          <div style={s.filaGrid2}>
            <label style={s.checkboxRow}>
              <input
                type="checkbox"
                checked={obraExterna}
                onChange={e => setObraExterna(e.target.checked)}
                style={s.checkbox}
              />
              <span style={s.label}>
                Tiene <span style={s.accent}>obra externa</span>
                <span style={s.opcional}> (pintor, enderezador)</span>
              </span>
            </label>
            <label style={s.checkboxRow}>
              <input
                type="checkbox"
                checked={obraInterna}
                onChange={e => setObraInterna(e.target.checked)}
                style={s.checkbox}
              />
              <span style={s.label}>
                Tiene <span style={s.accent}>obra interna</span>
                <span style={s.opcional}> (mecánico del taller)</span>
              </span>
            </label>
          </div>

          {/* ── garantía ── */}
          <div style={s.separador} />
          <label style={s.checkboxRow}>
            <input
              type="checkbox"
              checked={esGarantia}
              onChange={e => {
                setEsGarantia(e.target.checked)
                if (!e.target.checked) setFechaVencGarantia('')
              }}
              style={s.checkbox}
            />
            <span style={s.label}>
              Esta orden <span style={s.accent}>tiene garantía</span>
              <span style={s.opcional}> (el cliente puede regresar si el trabajo falla)</span>
            </span>
          </label>

          {esGarantia && (
            <div style={s.field}>
              <label style={s.label}>
                <span style={s.accent}>Fecha de vencimiento de garantía</span>
                <span style={s.opcional}> — opcional</span>
              </label>
              <input
                type="date"
                value={fechaVencGarantia}
                onChange={e => setFechaVencGarantia(e.target.value)}
                style={s.input}
                onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                onBlur={e  => Object.assign(e.target.style, s.input)}
              />
            </div>
          )}

          {/* ── orden derivada (garantia o daños ocultos) ── */}
          <div style={s.separador} />
          <label style={s.checkboxRow}>
            <input
              type="checkbox"
              checked={esDerivada}
              onChange={e => {
                setEsDerivada(e.target.checked)
                if (!e.target.checked) {
                  setIdOrdenOrigen(null)
                  setOrdenOrigenSeleccionada(null)
                  setBusquedaOrigenQ('')
                }
              }}
              style={s.checkbox}
            />
            <span style={s.label}>
              Esta orden <span style={s.accent}>deriva de otra</span>
              <span style={s.opcional}> (garantía o daños ocultos de cliente particular)</span>
            </span>
          </label>

          {esDerivada && (
            <div style={s.bloqueDerivada}>
              <div style={s.radioGroup}>
                <label style={tipoDerivada === 'garantia' ? s.radioBtnActivo : s.radioBtn}>
                  <input type="radio" name="tipo_derivada" value="garantia"
                    checked={tipoDerivada === 'garantia'}
                    onChange={() => setTipoDerivada('garantia')}
                    style={{ display: 'none' }} />
                  Por garantía
                </label>
                <label style={tipoDerivada === 'dano_oculto' ? s.radioBtnActivo : s.radioBtn}>
                  <input type="radio" name="tipo_derivada" value="dano_oculto"
                    checked={tipoDerivada === 'dano_oculto'}
                    onChange={() => setTipoDerivada('dano_oculto')}
                    style={{ display: 'none' }} />
                  Por daño oculto (particular)
                </label>
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  <span style={s.accent}>Buscar orden de origen</span>
                  <span style={s.opcional}> — por matrícula, nombre o cédula</span>
                </label>
                <input
                  type="text"
                  value={busquedaOrigenQ}
                  onChange={e => {
                    setBusquedaOrigenQ(e.target.value)
                    setIdOrdenOrigen(null)
                    setOrdenOrigenSeleccionada(null)
                  }}
                  placeholder="Ej: ABC-123 o Juan Pérez..."
                  style={s.input}
                  onFocus={e => Object.assign(e.target.style, s.inputFocus)}
                  onBlur={e  => Object.assign(e.target.style, s.input)}
                />
              </div>

              {buscandoOrigen && <p style={s.buscando}>Buscando...</p>}

              {ordenesOrigen.length > 0 && !idOrdenOrigen && (
                <div style={s.listaOrigen}>
                  {ordenesOrigen.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setIdOrdenOrigen(o.id)
                        setOrdenOrigenSeleccionada(o)
                        setBusquedaOrigenQ('')
                        setOrdenesOrigen([])
                      }}
                      style={s.origenItem}
                    >
                      <span style={s.origenMatricula}>{o.matricula}</span>
                      <span style={s.origenMeta}>{o.nombre_cliente} — #{o.id} — {o.tipo} — {o.estado}</span>
                    </button>
                  ))}
                </div>
              )}

              {ordenOrigenSeleccionada && (
                <div style={s.origenConfirmado}>
                  <span style={s.origenConfirmadoLabel}>Orden origen seleccionada:</span>
                  <span style={s.origenMatricula}>#{ordenOrigenSeleccionada.id} — {ordenOrigenSeleccionada.matricula}</span>
                  <span style={s.origenMeta}>{ordenOrigenSeleccionada.nombre_cliente} — {ordenOrigenSeleccionada.tipo}</span>
                  <button
                    type="button"
                    onClick={() => { setIdOrdenOrigen(null); setOrdenOrigenSeleccionada(null) }}
                    style={s.btnQuitar}
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── error ── */}
          {error && <p style={s.errorMsg}>{error}</p>}

          {/* ── botones ── */}
          <div style={s.avanceRow}>
            <button
              type="button"
              onClick={() => navigate('/ordenes/nueva/presupuesto', { state: { cliente, vehiculo } })}
              style={s.btnSecondaryFull}
            >
              ← Volver al paso 3
            </button>
            <button
              type="submit"
              disabled={creando}
              style={creando ? s.btnDisabledFull : s.btnPrimaryFull}
            >
              {creando ? 'Creando orden...' : 'Crear orden →'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

const s = {
  page:               { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:          { width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '2rem' },
  header:             { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  eyebrow:            { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:             { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  subtitulo:          { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0 },
  accent:             { color: 'var(--yellow-500)' },
  opcional:           { color: 'var(--neutral-400)', fontWeight: 'var(--weight-regular)', fontSize: 'var(--text-xs)' },

  banner:             { display: 'flex', alignItems: 'center', gap: '1.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--blue-700)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.25rem', flexWrap: 'wrap' },
  bannerBloque:       { display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  bannerLabel:        { fontSize: 'var(--text-xs)', color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--weight-medium)' },
  bannerValor:        { fontSize: 'var(--text-body)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  bannerSub:          { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  bannerSep:          { width: '1px', height: '36px', backgroundColor: 'var(--border)', flexShrink: 0 },
  bannerCambiar:      { marginLeft: 'auto', backgroundColor: 'transparent', color: 'var(--danger)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(229,72,77,0.3)', cursor: 'pointer', flexShrink: 0 },

  form:               { display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem' },
  field:              { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  filaGrid2:          { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  filaGrid3:          { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' },
  label:              { fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' },
  input:              { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s', colorScheme: 'dark' },
  inputFocus:         { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxShadow: 'var(--glow-yellow)', colorScheme: 'dark' },
  separador:          { borderTop: '1px solid var(--border)', margin: '0' },
  checkboxRow:        { display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' },
  checkbox:           { width: '16px', height: '16px', accentColor: 'var(--yellow-500)', cursor: 'pointer', flexShrink: 0 },

  radioGroup:         { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  radioBtn:           { backgroundColor: 'var(--surface-raised)', color: 'var(--neutral-300)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  radioBtnActivo:     { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--yellow-500)', cursor: 'pointer' },

  bloqueSeguro:       { backgroundColor: 'rgba(0,29,61,0.5)', border: '1px solid var(--blue-700)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  bloqueSeguroTitulo: { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--blue-300)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },

  bloqueDerivada:     { backgroundColor: 'rgba(0,29,61,0.3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' },

  listaOrigen:        { display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '250px', overflowY: 'auto' },
  origenItem:         { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem', textAlign: 'left' },
  origenMatricula:    { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },
  origenMeta:         { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  origenConfirmado:   { backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
  origenConfirmadoLabel: { fontSize: 'var(--text-xs)', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--weight-medium)' },
  btnQuitar:          { marginLeft: 'auto', backgroundColor: 'transparent', color: 'var(--danger)', fontSize: 'var(--text-small)', border: '1px solid rgba(229,72,77,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.6rem', cursor: 'pointer' },
  buscando:           { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0 },

  avanceRow:          { display: 'flex', gap: '1rem', paddingTop: '0.5rem' },
  btnPrimaryFull:     { flex: 2, backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnSecondaryFull:   { flex: 1, backgroundColor: 'var(--surface-raised)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnDisabledFull:    { flex: 2, backgroundColor: 'var(--surface)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
  btnPrimary:         { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.7rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnSecondary:       { backgroundColor: 'var(--surface-raised)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.7rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },

  errorMsg:           { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },

  bloqueado:          { backgroundColor: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '460px', width: '100%' },
  bloqueadoTitulo:    { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--danger)', margin: 0 },
  bloqueadoTexto:     { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 },

  exito:              { backgroundColor: 'var(--surface)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 'var(--radius-lg)', padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '520px', width: '100%', alignItems: 'center', textAlign: 'center' },
  exitoIcon:          { fontSize: '3rem', color: 'var(--success)', margin: 0 },
  exitoTitulo:        { fontSize: 'var(--text-subtitle)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0 },
  exitoSub:           { fontSize: 'var(--text-body)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-medium)', margin: 0 },
  exitoMeta:          { fontSize: 'var(--text-small)', color: 'var(--neutral-300)', margin: 0 },
  exitoBtns:          { display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' },
}