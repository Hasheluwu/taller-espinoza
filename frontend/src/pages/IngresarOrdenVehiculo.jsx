import RuleInput from '../components/RuleInput'
import { saveOrderDraft } from '../lib/orderDrafts'
import { apiFetch } from '../lib/api'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import WizardSteps from '../components/WizardSteps'

function getToken() {
  return localStorage.getItem('token')
}

const ASEGURADORA_COLORS = {
  ninguna: { color: 'var(--neutral-300)', bg: 'var(--surface-raised)', border: 'var(--border)' },
  lafise:  { color: 'var(--blue-300)',    bg: 'rgba(51,133,214,0.1)',  border: 'rgba(51,133,214,0.3)' },
  iniser:  { color: 'var(--yellow-400)',  bg: 'rgba(255,195,0,0.1)',   border: 'rgba(255,195,0,0.3)'  },
}

function BadgeAseguradora({ valor }) {
  const st = ASEGURADORA_COLORS[valor] || ASEGURADORA_COLORS.ninguna
  return (
    <span style={{
      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
      color: st.color, backgroundColor: st.bg, border: `1px solid ${st.border}`,
      borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem',
      textTransform: 'uppercase',
    }}>
      {valor}
    </span>
  )
}

function VehiculoCard({ vehiculo, seleccionado, onSeleccionar }) {
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(vehiculo)}
      style={{
        ...s.vehiculoCard,
        ...(seleccionado ? s.vehiculoCardActivo : {}),
      }}
    >
      <div style={s.vehiculoCardHeader}>
        <span style={s.matricula}>{vehiculo.matricula}</span>
        <BadgeAseguradora valor={vehiculo.aseguradora} />
      </div>
      <span style={s.vehiculoNombre}>{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio_fabricacion}</span>
      <span style={s.vehiculoMeta}>Color: {vehiculo.color}</span>
      {(vehiculo.chasis || vehiculo.motor) && (
        <span style={s.vehiculoMeta}>
          {vehiculo.chasis ? `Chasis: ${vehiculo.chasis}` : ''}
          {vehiculo.chasis && vehiculo.motor ? ' · ' : ''}
          {vehiculo.motor  ? `Motor: ${vehiculo.motor}` : ''}
        </span>
      )}
      {seleccionado && (
        <span style={s.vehiculoSeleccionadoLabel}>✓ Seleccionado</span>
      )}
    </button>
  )
}

const VEHICLE_RULES = { matricula: 'plate', chasis: 'serial', motor: 'serial' }
function CampoTexto({ label, name, value, onChange, placeholder, type = 'text', requerido, opcional }) {
  return (
    <div style={s.field}>
      <label style={s.label}>
        <span style={s.labelAccent}>{label}</span>
        {opcional && <span style={s.labelOpcional}> — opcional</span>}
      </label>
      {VEHICLE_RULES[name] ? <RuleInput rule={VEHICLE_RULES[name]} label={label} name={name} value={value} onChange={onChange} required={!!requerido} placeholder={placeholder} style={s.input}/> : <input
        maxLength={{matricula:20,marca:50,modelo:50,color:50,chasis:50,motor:50}[name]}
        pattern={type === 'text' && requerido ? '.*\\S.*' : undefined}
        title={type === 'text' && requerido ? 'Escribe un valor; no puede contener solo espacios.' : undefined}
        min={name === 'anio_fabricacion' ? 1901 : undefined}
        max={name === 'anio_fabricacion' ? Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Managua' }).slice(0,4)) + 1 : undefined}
        step={name === 'anio_fabricacion' ? 1 : undefined}
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} required={!!requerido}
        style={s.input}
        onFocus={e => Object.assign(e.target.style, s.inputFocus)}
        onBlur={e  => Object.assign(e.target.style, s.input)}
      />}
    </div>
  )
}

export default function IngresarOrdenVehiculo() {
  const navigate = useNavigate()
  const location = useLocation()

  const presupuestoCotizacion = location.state?.presupuestoCotizacion
  const quoteData = presupuestoCotizacion?.datos || {}
  const cliente = location.state?.cliente ?? null
  const particular = location.state?.particular === true

  const [vehiculos, setVehiculos]               = useState([])
  const [cargando, setCargando]                 = useState(true)
  const [vehiculoConfirmado, setVehiculoConfirmado] = useState(null)
  const [mostrarFormulario, setMostrarFormulario]   = useState(false)

  const [form, setForm] = useState({
    matricula: quoteData.placa || '', marca: quoteData.marca || '', modelo: quoteData.vehiculo || '',
    anio_fabricacion: quoteData.anio || '', aseguradora: ['LAFISE','INISER'].includes(presupuestoCotizacion?.seguro) ? presupuestoCotizacion.seguro.toLowerCase() : 'ninguna', color: quoteData.color || '',
    chasis: quoteData.chasis || '', motor: quoteData.motor || '',
  })
  const [errorCrear, setErrorCrear] = useState('')
  const [creando, setCreando]       = useState(false)

  // Cargar vehículos del cliente al montar
  useEffect(() => {
    if (!cliente) return
    async function cargar() {
      try {
        const res  = await apiFetch(
          `/api/vehiculos/por-cliente/${cliente.id}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        )
        if (res.ok) setVehiculos(await res.json())
      } catch { /* silencioso */ }
      finally { setCargando(false) }
    }
    cargar()
  }, [cliente])

  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSeleccionar(vehiculo) {
    // si ya estaba seleccionado, deseleccionar
    if (vehiculoConfirmado?.id === vehiculo.id) {
      setVehiculoConfirmado(null)
    } else {
      setVehiculoConfirmado(vehiculo)
    }
  }

  async function handleCrearVehiculo(e) {
    e.preventDefault()
    setErrorCrear('')
    setCreando(true)
    try {
      const res  = await apiFetch('/api/vehiculos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({
          id_cliente:       cliente.id,
          matricula:        form.matricula,
          marca:            form.marca,
          modelo:           form.modelo,
          anio_fabricacion: form.anio_fabricacion,
          aseguradora:      form.aseguradora,
          color:            form.color,
          chasis:           form.chasis || null,
          motor:            form.motor  || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCrear(data.message || 'Error al crear el vehículo.'); return }

      // Agregar a la lista y seleccionar automáticamente
      setVehiculos(prev => [...prev, data])
      setVehiculoConfirmado(data)
      setMostrarFormulario(false)
      setForm({ matricula: '', marca: '', modelo: '', anio_fabricacion: '', aseguradora: 'ninguna', color: '', chasis: '', motor: '' })
    } catch {
      setErrorCrear('No se pudo conectar con el servidor.')
    } finally {
      setCreando(false)
    }
  }

  function handleContinuar() {
    // A regular order registration is kept as a draft from here on, so it can be resumed.
    if (!presupuestoCotizacion && !location.state?.destinoProforma && vehiculoConfirmado) {
      saveOrderDraft({ particular, vehiculo: vehiculoConfirmado, paso: particular ? 'orden' : 'presupuesto', datos: { cliente, vehiculo: vehiculoConfirmado } })
    }
    navigate(particular || presupuestoCotizacion ? '/ordenes/nueva/orden' : location.state?.destinoProforma ? (location.state?.cotizacion ? '/cotizaciones/nueva' : location.state?.proformaParticular ? '/proformas/nueva?tipo=particular' : '/proformas/nueva') : '/ordenes/nueva/presupuesto', { state: { presupuesto: presupuestoCotizacion, cliente, vehiculo: vehiculoConfirmado, particular, borradorParticular: location.state?.borradorParticular } })
  }

  // Pantalla de bloqueo sin cliente
  if (!cliente) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={s.bloqueado}>
            <p style={s.bloqueadoTitulo}>⚠ Sin cliente seleccionado</p>
            <p style={s.bloqueadoTexto}>No se puede ingresar un vehículo sin un cliente confirmado. Volvé al paso anterior.</p>
            <button onClick={() => navigate(particular ? '/ordenes/nueva?tipo=particular' : location.state?.destinoProforma ? `/ordenes/nueva?destino=proforma${location.state?.cotizacion ? '&cotizacion=true' : location.state?.proformaParticular ? '&proforma=particular' : ''}` : '/ordenes/nueva', { state: { presupuestoCotizacion, borradorParticular: location.state?.borradorParticular } })} style={s.btnPrimary}>← Volver al Paso 1</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        {particular ? <p className="section-kicker">TRABAJO PARTICULAR · PASO 2 DE 3</p> : <WizardSteps currentStep={2} />}

        {/* encabezado */}
        <div style={s.header}>
          {!particular && <span style={s.eyebrow}>Ruta 1 — Paso 2 de 4</span>}
          <h1 style={s.titulo}>{particular ? 'Trabajo particular · Vehículo' : 'Ingresar orden'}</h1>
          <p style={s.subtitulo}>Seleccioná el vehículo</p>
        </div>

        {/* banner del cliente */}
        <div style={s.clienteBanner}>
          <span style={s.clienteBannerLabel}>Cliente activo</span>
          <span style={s.clienteBannerNombre}>{cliente.nombre}</span>
          <span style={s.clienteBannerCedula}>{cliente.cedula}</span>
          <button onClick={() => navigate(particular ? '/ordenes/nueva?tipo=particular' : location.state?.destinoProforma ? `/ordenes/nueva?destino=proforma${location.state?.cotizacion ? '&cotizacion=true' : location.state?.proformaParticular ? '&proforma=particular' : ''}` : '/ordenes/nueva', { state: { presupuestoCotizacion, borradorParticular: location.state?.borradorParticular } })} style={s.clienteBannerCambiar}>Cambiar</button>
        </div>

        <div style={s.cuerpo}>
          <div style={s.columnaIzq}>

            {/* lista de vehículos del cliente */}
            <section style={s.seccion}>
              <div style={s.seccionHeader}>
                <h2 style={s.seccionTitulo}>
                  Vehículos de <span style={s.accent}>{cliente.nombre.split(' ')[0]}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => { setMostrarFormulario(v => !v); setErrorCrear('') }}
                  style={s.btnMini}
                >
                  {mostrarFormulario ? '← Cancelar' : '+ Agregar vehículo'}
                </button>
              </div>

              {cargando ? (
                <p style={s.textoMeta}>Cargando vehículos...</p>
              ) : vehiculos.length === 0 && !mostrarFormulario ? (
                <div style={s.sinVehiculos}>
                  <p style={s.sinVehiculosTitulo}>Este cliente no tiene vehículos registrados.</p>
                  <p style={s.textoMeta}>Usá el botón <strong>+ Agregar vehículo</strong> para registrar el primero.</p>
                </div>
              ) : (
                <div style={s.listaVehiculos}>
                  {vehiculos.map(v => (
                    <VehiculoCard
                      key={v.id}
                      vehiculo={v}
                      seleccionado={vehiculoConfirmado?.id === v.id}
                      onSeleccionar={handleSeleccionar}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* formulario de nuevo vehículo */}
            {mostrarFormulario && (
              <section style={s.seccion}>
                <h2 style={s.seccionTitulo}>Nuevo <span style={s.accent}>vehículo</span></h2>
                <form onSubmit={handleCrearVehiculo} style={s.form}>
                  <CampoTexto label="Matrícula"          name="matricula"        value={form.matricula}        onChange={handleFormChange} placeholder="Ej: M 123456"           requerido />
                  <CampoTexto label="Marca"              name="marca"            value={form.marca}            onChange={handleFormChange} placeholder="Ej: Toyota"              requerido />
                  <CampoTexto label="Modelo"             name="modelo"           value={form.modelo}           onChange={handleFormChange} placeholder="Ej: Corolla"             requerido />
                  <CampoTexto label="Año de fabricación" name="anio_fabricacion" value={form.anio_fabricacion} onChange={handleFormChange} placeholder="Ej: 2018" type="number" requerido />
                  <CampoTexto label="Color"              name="color"            value={form.color}            onChange={handleFormChange} placeholder="Ej: Blanco"              requerido />

                  <div style={s.field}>
                    <label style={s.label}><span style={s.labelAccent}>Aseguradora</span></label>
                    <select disabled={particular} name="aseguradora" value={form.aseguradora} onChange={handleFormChange} style={s.input}>
                      <option value="ninguna">Ninguna</option>
                      <option value="lafise">LAFISE</option>
                      <option value="iniser">INISER</option>
                    </select>
                  </div>

                  <CampoTexto label="Chasis" name="chasis" value={form.chasis} onChange={handleFormChange} placeholder="Ej: JT2BF22K1W0123456" opcional />
                  <CampoTexto label="Motor"  name="motor"  value={form.motor}  onChange={handleFormChange} placeholder="Ej: 1ZZ-FE"             opcional />

                  {errorCrear && <p style={s.errorMsg}>{errorCrear}</p>}

                  <button type="submit" disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
                    {creando ? 'Guardando...' : 'Crear vehículo'}
                  </button>
                </form>
              </section>
            )}

            {/* botón continuar */}
            {vehiculoConfirmado && (
              <button onClick={handleContinuar} style={s.btnContinuar}>
                Continuar con <span style={s.btnContinuarNombre}>{vehiculoConfirmado.matricula} — {vehiculoConfirmado.marca} {vehiculoConfirmado.modelo}</span> →
              </button>
            )}

          </div>

          {/* columna derecha — detalle del seleccionado */}
          <div style={s.columnaDer}>
            {vehiculoConfirmado ? (
              <div style={s.detalleCard}>
                <p style={s.detalleTitulo}>✓ Vehículo seleccionado</p>
                {[
                  { label: 'ID',          valor: vehiculoConfirmado.id },
                  { label: 'Matrícula',   valor: vehiculoConfirmado.matricula },
                  { label: 'Marca',       valor: vehiculoConfirmado.marca },
                  { label: 'Modelo',      valor: vehiculoConfirmado.modelo },
                  { label: 'Año',         valor: vehiculoConfirmado.anio_fabricacion },
                  { label: 'Color',       valor: vehiculoConfirmado.color },
                  { label: 'Aseguradora', valor: vehiculoConfirmado.aseguradora },
                  { label: 'Chasis',      valor: vehiculoConfirmado.chasis || '—' },
                  { label: 'Motor',       valor: vehiculoConfirmado.motor  || '—' },
                ].map(f => (
                  <div key={f.label} style={s.detalleFila}>
                    <span style={s.detalleLabel}>{f.label}</span>
                    <span style={s.detalleValor}>{String(f.valor)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.detalleVacio}>
                <p style={s.textoMeta}>
                  {vehiculos.length > 0
                    ? 'Seleccioná un vehículo de la lista para continuar.'
                    : 'Los datos del vehículo aparecerán aquí tras crearlo.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

const s = {
  page:                { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:           { width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '2rem' },
  header:              { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  eyebrow:             { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:              { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  subtitulo:           { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0 },
  accent:              { color: 'var(--yellow-500)' },

  clienteBanner:       { display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--surface)', border: '1px solid var(--blue-700)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1.25rem' },
  clienteBannerLabel:  { fontSize: 'var(--text-xs)', color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--weight-medium)', flexShrink: 0 },
  clienteBannerNombre: { fontSize: 'var(--text-body)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  clienteBannerCedula: { fontSize: 'var(--text-small)', color: 'var(--neutral-300)', marginLeft: 'auto' },
  clienteBannerCambiar:{ backgroundColor: 'transparent', color: 'var(--danger)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(229,72,77,0.3)', cursor: 'pointer', flexShrink: 0 },

  bloqueado:           { backgroundColor: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '460px', width: '100%' },
  bloqueadoTitulo:     { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--danger)', margin: 0 },
  bloqueadoTexto:      { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 },

  cuerpo:              { display: 'flex', gap: '2rem', alignItems: 'flex-start' },
  columnaIzq:          { flex: '0 0 460px', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  columnaDer:          { flex: 1 },

  seccion:             { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  seccionHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  seccionTitulo:       { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0 },

  listaVehiculos:      { display: 'flex', flexDirection: 'column', gap: '0.6rem' },

  vehiculoCard:        { width: '100%', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' },
  vehiculoCardActivo:  { backgroundColor: 'rgba(255,195,0,0.06)', border: '1px solid var(--yellow-500)', boxShadow: 'var(--glow-yellow)' },
  vehiculoCardHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  matricula:           { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },
  vehiculoNombre:      { fontSize: 'var(--text-body)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)' },
  vehiculoMeta:        { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  vehiculoSeleccionadoLabel: { fontSize: 'var(--text-xs)', color: 'var(--yellow-500)', fontWeight: 'var(--weight-bold)', marginTop: '0.25rem' },

  sinVehiculos:        { backgroundColor: 'var(--surface-raised)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  sinVehiculosTitulo:  { fontSize: 'var(--text-body)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', margin: 0 },
  textoMeta:           { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0 },

  form:                { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field:               { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label:               { fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' },
  labelAccent:         { color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  labelOpcional:       { color: 'var(--neutral-400)', fontWeight: 'var(--weight-regular)', fontSize: 'var(--text-xs)' },
  input:               { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s' },
  inputFocus:          { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxShadow: 'var(--glow-yellow)' },

  btnPrimary:          { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', width: '100%' },
  btnDisabled:         { backgroundColor: 'var(--surface)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5, width: '100%' },
  btnMini:             { backgroundColor: 'transparent', color: 'var(--neutral-300)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnContinuar:        { width: '100%', backgroundColor: 'var(--blue-700)', color: 'var(--foreground)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--blue-600)', cursor: 'pointer', textAlign: 'left' },
  btnContinuarNombre:  { color: 'var(--yellow-400)' },

  errorMsg:            { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },

  detalleCard:         { backgroundColor: 'var(--surface)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  detalleTitulo:       { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)', margin: '0 0 0.5rem', letterSpacing: '0.04em' },
  detalleFila:         { display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' },
  detalleLabel:        { fontSize: 'var(--text-small)', color: 'var(--neutral-300)', fontWeight: 'var(--weight-medium)', flexShrink: 0 },
  detalleValor:        { fontSize: 'var(--text-small)', color: 'var(--foreground)', textAlign: 'right', wordBreak: 'break-all' },
  detalleVacio:        { backgroundColor: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' },
}

