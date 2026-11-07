import RuleInput from '../components/RuleInput'
import PlaceCombobox from '../components/PlaceCombobox'
import ParticularEditor from '../components/ParticularEditor'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { apiFetch } from '../lib/api'
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { saveOrderDraft, deleteOrderDraft } from '../lib/orderDrafts'
import { useNavigate, useLocation } from 'react-router-dom'
import WizardSteps from '../components/WizardSteps'
import { localDateTime } from '../lib/date'

const getToken = () => localStorage.getItem('token')
const API = ''

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
            <span style={s.bannerValor}>N° {presupuesto.numero || presupuesto.id}</span>
            <span style={s.bannerSub}>C$ {Number(presupuesto.total).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
          </div>
        </>
      )}
      <button onClick={onCambiarVehiculo} style={s.bannerCambiar}>← Cambiar</button>
    </div>
  )
}

const GUEST_RULES = { cliente: 'name', cedula: 'cedula', telefono: 'phone', placa: 'plate' }

export default function IngresarOrdenFinal() {
  const navigate = useNavigate()
  const location = useLocation()

  const presupuesto = location.state?.presupuesto ?? null
  const automatic = location.state?.registrarDesdeCotizacion === true && presupuesto?.es_cotizacion
  const [datosAlta,setDatosAlta] = useState(() => ({...presupuesto?.datos}))
  const fields = [['cliente','Nombre del cliente',150],['cedula','Cédula',20],['telefono','Teléfono',20],['municipio_residencia','Departamento',100],['placa','Matrícula',20],['marca','Marca',50],['vehiculo','Modelo',50],['anio','Año de fabricación',4],['color','Color',50]]
  const missing = fields.filter(([key]) => !String(presupuesto?.datos?.[key] ?? '').trim())
  const cliente = useMemo(() => automatic ? {nombre:datosAlta.cliente,cedula:datosAlta.cedula} : location.state?.cliente ?? null, [automatic, datosAlta, location.state])
  const vehiculo = useMemo(() => automatic ? {matricula:datosAlta.placa,marca:datosAlta.marca,modelo:datosAlta.vehiculo,anio_fabricacion:datosAlta.anio,aseguradora:presupuesto.seguro==='PARTICULAR'?'ninguna':presupuesto.seguro.toLowerCase()} : location.state?.vehiculo ?? null, [automatic, datosAlta, presupuesto, location.state])
  const origenId     = location.state?.origenId     ?? null   // viene de Operaciones → daño oculto particular
  const origenTipo   = location.state?.tipoDerivada ?? null   // 'dano_oculto' | 'garantia'

  const particular = location.state?.particular === true

  const draft = location.state?.borrador ?? (particular ? location.state?.borradorParticular ?? {} : {})

  // form fields
  const [tipo, setTipo]                             = useState(draft.tipo ?? 'pintura')
  const [fechaIngreso, setFechaIngreso]             = useState(() => {
    const now = new Date()
    return draft.fechaIngreso ?? localDateTime(now)
  })
  const [fechaEntregaEst, setFechaEntregaEst]       = useState(draft.fechaEntregaEst ?? '')
  const [tipoPago, setTipoPago]                     = useState(particular ? 'particular' : presupuesto?.seguro ? (presupuesto.seguro === 'PARTICULAR' ? 'particular' : presupuesto.seguro.toLowerCase()) : ['lafise', 'iniser'].includes(vehiculo?.aseguradora) ? vehiculo.aseguradora : 'particular')
  const [numeroTramite, setNumeroTramite]           = useState(draft.numeroTramite || (presupuesto?.seguro === 'INISER' ? presupuesto?.reclamo : presupuesto?.tramite || presupuesto?.reclamo) || '')
  const [esGarantia, setEsGarantia]                 = useState(draft.esGarantia ?? false)
  const [fechaVencGarantia, setFechaVencGarantia]   = useState(draft.fechaVencGarantia ?? '')
  const [obraExterna, setObraExterna]               = useState(draft.obraExterna ?? false)
  const [obraInterna, setObraInterna]               = useState(draft.obraInterna ?? false)

  // orden derivada — se pre-llena si viene desde Operaciones (daño oculto particular)
  const [esDerivada, setEsDerivada]                 = useState(!!origenId)
  const [tipoDerivada, setTipoDerivada]             = useState(origenTipo ?? 'garantia')
  const [ordenesOrigen, setOrdenesOrigen]           = useState([])
  const [idOrdenOrigen, setIdOrdenOrigen]           = useState(origenId ?? null)
  const [ordenOrigenSeleccionada, setOrdenOrigenSeleccionada] = useState(
    origenId ? { id: origenId, matricula: vehiculo?.matricula ?? '', tipo: '—', estado: '—' } : null
  )
  const [cargandoOrdenes, setCargandoOrdenes]       = useState(false)

  const [solicitud] = useState(() => draft.solicitud ?? crypto.randomUUID())
  const enviando = useRef(false)

  // submit
  const [creando, setCreando]   = useState(false)
  const [error, setError]       = useState('')
  const [ordenCreada, setOrdenCreada] = useState(null)

  const [detalleParticular, setDetalleParticular] = useState(draft.detalleParticular ?? { mano_obra_global: 0, detalles: [{ tipo_linea: 'servicio', descripcion: '', cantidad: 1, precio_unitario: 0, aplica_iva: true }], observaciones: '' })
  const [actividades, setActividades] = useState(draft.actividades ?? [{ descripcion: '', precio: '', aplica_iva: true }])
  const pideActividades = tipoPago === 'particular' && !presupuesto?.version
  const cambiarActividad = (index, campo, valor) => setActividades(items => items.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  const subtotalActividades = actividades.reduce((sum, item) => sum + Math.round((Number(item.precio) || 0) * 100), 0)
  const ivaActividades = actividades.reduce((sum, item) => sum + (item.aplica_iva ? Math.round(Math.round((Number(item.precio) || 0) * 100) * 15 / 100) : 0), 0)
  const mostrarMonto = cents => `C$ ${(cents / 100).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const esSeguro = tipoPago === 'lafise' || tipoPago === 'iniser'

  // Keep the unfinished registration as a draft (not for quote conversions or derived orders).
  const guardaBorrador = !automatic && !origenId && !!cliente && !!vehiculo?.id
  useEffect(() => {
    if (!guardaBorrador || ordenCreada) return
    const timer = setTimeout(() => saveOrderDraft({ particular, vehiculo, paso: 'orden', datos: {
      cliente, vehiculo, id_presupuesto: presupuesto?.id ?? null,
      form: { tipo, fechaIngreso, fechaEntregaEst, numeroTramite, esGarantia, fechaVencGarantia, obraExterna, obraInterna, detalleParticular, actividades, solicitud },
    } }), 800)
    return () => clearTimeout(timer)
  }, [guardaBorrador, ordenCreada, particular, cliente, vehiculo, presupuesto, tipo, fechaIngreso, fechaEntregaEst, numeroTramite, esGarantia, fechaVencGarantia, obraExterna, obraInterna, detalleParticular, actividades, solicitud])

  // Cargar órdenes del mismo vehículo al activar "esta orden deriva de otra"
  const cargarOrigenes = useCallback(() => {
    if (!esDerivada || !vehiculo?.id) {
      setOrdenesOrigen([])
      return
    }
    setCargandoOrdenes(true)
    apiFetch(
      `${API}/api/ordenes/por-vehiculo/${vehiculo.id}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    )
      .then(res => res.ok ? res.json() : [])
      .then(data => setOrdenesOrigen(data))
      .catch(() => setOrdenesOrigen([]))
      .finally(() => setCargandoOrdenes(false))
  }, [esDerivada, vehiculo])
  useDeferredLoad(cargarOrigenes)

  async function handleSubmit(e) {
    e.preventDefault()
    if (enviando.current) return
    setError('')
    if ((fechaEntregaEst && fechaEntregaEst < fechaIngreso.slice(0, 10)) || (esGarantia && fechaVencGarantia && fechaVencGarantia < fechaIngreso.slice(0, 10))) {
      setError('La entrega y el vencimiento de garantía no pueden ser anteriores al ingreso del vehículo.')
      return
    }
    if (pideActividades && !particular && actividades.some(item => !item.descripcion.trim() || item.precio === '' || !Number.isFinite(Number(item.precio)) || Number(item.precio) < 0)) {
      setError('Completa la descripción y el precio de cada actividad.')
      return
    }
    setCreando(true)

    // validaciones básicas
    if (esSeguro && !numeroTramite.trim()) {
      setError(`El número de ${tipoPago === 'iniser' ? 'reclamo' : 'trámite'} es obligatorio para esta orden con seguro.`)
      setCreando(false)
      return
    }
    if (esDerivada && !idOrdenOrigen) {
      setError('Debés seleccionar la orden de origen.')
      setCreando(false)
      return
    }

    // si es derivada por garantia → es_garantia = true
    // si es derivada por dano_oculto particular → danos_ocultos_inicial = true (se registra al crear)
    const payload = {
      solicitud,
      registrar_desde_cotizacion: automatic,
      datos_alta: automatic ? datosAlta : undefined,
      detalle_particular: particular ? detalleParticular : undefined,
      actividades: pideActividades && !particular ? actividades : undefined,
      version: presupuesto?.version,
      id_vehiculo:             vehiculo.id,
      id_presupuesto:          presupuesto?.id ?? null,
      id_orden_origen:         esDerivada ? idOrdenOrigen : null,
      tipo,
      fecha_ingreso:           fechaIngreso,
      fecha_entrega_estimada:  fechaEntregaEst || null,
      tipo_pago:               tipoPago,
      es_garantia:             esGarantia || (esDerivada && tipoDerivada === 'garantia'),
      fecha_vencimiento_garantia: esGarantia && fechaVencGarantia ? fechaVencGarantia : null,
      obra_externa:            obraExterna,
      obra_interna:            obraInterna,
      danos_ocultos_inicial:   esDerivada && tipoDerivada === 'dano_oculto',
      numero_tramite:          esSeguro ? numeroTramite.trim() : null,
      monto_seguro:            esSeguro && presupuesto?.total ? Number(presupuesto.total) : null,
      monto_cliente:           esSeguro ? 0 : null,
    }

    enviando.current = true
    try {
      const res = await apiFetch(presupuesto?.version ? `${API}/api/proformas/${presupuesto.id}/orden` : `${API}/api/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al crear la orden.'); return }
      setOrdenCreada(data)
      deleteOrderDraft({ particular, vehiculo }).catch(() => { /* The list hides drafts already turned into orders. */ })
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      enviando.current = false
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
            <p style={s.exitoMeta}>Siguiente paso: asigna los trabajadores de esta orden. Solo ellos podrán usar materiales del inventario para ella.</p>
            <div style={s.exitoBtns}>
              <button
                onClick={() => navigate(`/ordenes/${ordenCreada.id}/operaciones?seccion=equipo`)}
                style={s.btnPrimary}
              >
                Asignar trabajadores →
              </button>
              <button
                onClick={() => navigate(`/ordenes/${ordenCreada.id}/operaciones`)}
                style={s.btnSecondary}
              >
                Ir a Operaciones
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

  if (particular) return <ParticularEditor cliente={cliente} vehiculo={vehiculo} form={detalleParticular} setForm={setDetalleParticular} tipo={tipo} setTipo={setTipo} fecha={fechaIngreso} setFecha={setFechaIngreso} entrega={fechaEntregaEst} setEntrega={setFechaEntregaEst} busy={creando} error={error} onSubmit={handleSubmit} onBack={() => navigate('/ordenes/nueva/vehiculo', { state: { cliente, particular, borradorParticular: { solicitud, detalleParticular, tipo, fechaIngreso, fechaEntregaEst, esGarantia, fechaVencGarantia, obraExterna, obraInterna } } })} options={<details className="pf-panel"><summary>Opciones del trabajo</summary><div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}><label><input type="checkbox" checked={obraExterna} onChange={e=>setObraExterna(e.target.checked)}/> Obra externa</label><label><input type="checkbox" checked={obraInterna} onChange={e=>setObraInterna(e.target.checked)}/> Obra interna</label><label><input type="checkbox" checked={esGarantia} onChange={e=>setEsGarantia(e.target.checked)}/> Incluye garantía</label>{esGarantia && <label className="pf-field"><span>Vencimiento de garantía</span><input type="date" min={fechaIngreso.slice(0, 10)} value={fechaVencGarantia} onChange={e=>setFechaVencGarantia(e.target.value)}/></label>}</div></details>}/>

  return (
    <div style={s.page}>
      <div style={s.container}>

        {automatic ? <p className="section-kicker">COTIZACIÓN A ORDEN · CONFIRMAR INGRESO</p> : particular ? <p className="section-kicker">TRABAJO PARTICULAR · PASO 3 DE 3</p> : <WizardSteps currentStep={4} />}

        {/* encabezado */}
        <div style={s.header}>
          {!automatic && <span style={s.eyebrow}>Ruta 1 — Paso 4 de 4</span>}
          <h1 style={s.titulo}>{particular ? 'Registrar trabajo particular' : 'Ingresar orden'}</h1>
          <p style={s.subtitulo}>{presupuesto?.version ? 'La proforma ya está aprobada. Ahora registrarás la reparación como una orden de trabajo.' : 'Registra la recepción del vehículo y los datos de la reparación.'}</p>{presupuesto?.version && <button type="button" style={s.btnSecondary} onClick={() => navigate(`${presupuesto.es_cotizacion ? '/cotizaciones' : '/proformas'}/${presupuesto.id}`)}>← Volver a la proforma sin crear una orden</button>}
        </div>

        {/* banner */}
        <BannerContexto
          cliente={cliente}
          vehiculo={vehiculo}
          presupuesto={presupuesto}
          onCambiarVehiculo={() => automatic ? navigate(`/cotizaciones/${presupuesto.id}/editar`) : navigate('/ordenes/nueva/vehiculo', { state: { cliente, particular, presupuestoCotizacion: presupuesto?.es_cotizacion ? presupuesto : undefined } })}
        />

        <form onSubmit={handleSubmit} style={s.form}>
          {automatic && <section style={{display:'grid',gap:'1rem'}}>
            <h2>Datos recuperados de la cotización</h2>
            <p>El cliente, vehículo, actividades y precios ya están completados. Al confirmar se registrarán automáticamente; si la cédula y matrícula ya existen, se reutilizarán sin duplicarlos ni modificar sus datos.</p>
            {missing.length > 0 ? <><h3>Solo falta completar</h3><div style={s.filaGrid2}>{missing.map(([key,label,max])=><label key={key} style={s.field}><span style={s.label}>{label}</span>{key==='municipio_residencia' ? <PlaceCombobox required name={key} value={datosAlta[key] || ''} onChange={e=>setDatosAlta(old=>({...old,[key]:e.target.value}))} style={s.input}/> : GUEST_RULES[key] ? <RuleInput required rule={GUEST_RULES[key]} label={label} name={key} value={datosAlta[key] || ''} onChange={e=>setDatosAlta(old=>({...old,[key]:e.target.value}))} style={s.input}/> : <input required maxLength={max} value={datosAlta[key] || ''} onChange={e=>setDatosAlta(old=>({...old,[key]:e.target.value}))} style={s.input}/>}</label>)}</div></> : <p>No faltan datos del cliente o vehículo. Completa únicamente la recepción del trabajo.</p>}
            <details><summary>Ver actividades y observaciones cotizadas</summary><ul>{presupuesto.detalles.map((item,i)=><li key={i}>{item.cantidad} × {item.descripcion}</li>)}</ul><p style={{whiteSpace:'pre-wrap'}}>{presupuesto.observaciones}</p><strong>Total acordado: C$ {Number(presupuesto.total).toFixed(2)}</strong></details>
          </section>}

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
                min={fechaIngreso.slice(0, 10)}
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
            {presupuesto?.version ? <p>Pagador de la proforma: <strong>{presupuesto.seguro}</strong>. El total corresponde a un solo pagador.</p> : particular || vehiculo.aseguradora === 'ninguna' ? (
              <div style={s.radioGroup}>
                <label style={s.radioBtnActivo}>
                  <input type="radio" name="tipo_pago" value="particular" checked readOnly style={{ display: 'none' }} />
                  PARTICULAR
                </label>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', alignSelf: 'center' }}>
                  — el cliente paga directamente este trabajo
                </span>
              </div>
            ) : (
              <div style={s.radioGroup}>
                {['particular', vehiculo.aseguradora].map(op => (
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
            )}
          </div>

          {/* ── campos de seguro (condicional) ── */}
          {esSeguro && (
            <div style={s.bloqueSeguro}>
              <p style={s.bloqueSeguroTitulo}>Datos de seguro — {tipoPago.toUpperCase()}</p>
              <div style={s.filaGrid2}>
                <div style={s.field}>
                  <label style={s.label}><span style={s.accent}>{tipoPago === 'iniser' ? 'Número de trámite / reclamo' : 'Número de trámite'}</span></label>
                  <RuleInput rule="claim" label={tipoPago === 'iniser' ? 'Número de reclamo' : 'Número de trámite'}
                    value={numeroTramite} onChange={e => setNumeroTramite(e.target.value)}
                    placeholder="Ej: 423686" style={s.input} required={esSeguro} />
                </div>

              </div>
              <p>El total de esta reparación se cobrará únicamente a {tipoPago.toUpperCase()}.{presupuesto?.total ? ` Total: C$ ${Number(presupuesto.total).toFixed(2)}.` : ' El importe se calculará con los trabajos registrados en Operaciones.'}</p>
            </div>
          )}

          {pideActividades && (
            <section aria-labelledby="actividades-title" style={{ display: 'grid', gap: '1rem' }}>
              <div style={s.separador} />
              <h2 id="actividades-title" style={{ margin: 0, fontSize: 'var(--text-body-lg)' }}>Actividades para el vehículo</h2>
              <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Describe cada trabajo y su precio antes de IVA. Quedarán registrados en Operaciones; los materiales y repuestos se agregan allí cuando se utilicen.</p>
              {actividades.map((item, index) => (
                <fieldset key={index} disabled={creando} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', minWidth: 0 }}>
                  <legend style={s.label}>Actividad {index + 1}</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
                    <label style={{ ...s.field, flex: '3 1 240px' }}>
                      <span style={s.label}>Trabajo a realizar</span>
                      <textarea required maxLength={255} rows={2} value={item.descripcion} onChange={e => cambiarActividad(index, 'descripcion', e.target.value)} placeholder="Ej.: Enderezado y pintura del bumper delantero" style={{ ...s.input, resize: 'vertical' }} />
                    </label>
                    <label style={{ ...s.field, flex: '1 1 140px' }}>
                      <span style={s.label}>Precio C$ · antes de IVA</span>
                      <input required type="number" min="0" max="99999999.99" step="0.01" value={item.precio} onChange={e => cambiarActividad(index, 'precio', e.target.value)} placeholder="0.00" style={s.input} />
                    </label>
                    <label style={s.checkboxRow}><input type="checkbox" checked={item.aplica_iva} onChange={e => cambiarActividad(index, 'aplica_iva', e.target.checked)} /> IVA 15%</label>
                    <button type="button" disabled={actividades.length === 1} aria-label={`Quitar actividad ${index + 1}`} style={s.btnSecondary} onClick={() => setActividades(items => items.filter((_, i) => i !== index))}>Quitar</button>
                  </div>
                </fieldset>
              ))}
              <button type="button" disabled={creando || actividades.length >= 100} style={{ ...s.btnSecondary, justifySelf: 'start' }} onClick={() => setActividades(items => [...items, { descripcion: '', precio: '', aplica_iva: true }])}>+ Agregar actividad</button>
              <div style={{ background: 'var(--surface-raised)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <span>Subtotal: {mostrarMonto(subtotalActividades)}</span>
                <span>IVA: {mostrarMonto(ivaActividades)}</span>
                <strong style={s.accent}>Total del trabajo: {mostrarMonto(subtotalActividades + ivaActividades)}</strong>
              </div>
            </section>
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
                min={fechaIngreso.slice(0, 10)} value={fechaVencGarantia}
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
                  setOrdenesOrigen([])
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
                    onChange={() => { setTipoDerivada('garantia'); setIdOrdenOrigen(null); setOrdenOrigenSeleccionada(null) }}
                    style={{ display: 'none' }} />
                  Por garantía
                </label>
                <label style={tipoDerivada === 'dano_oculto' ? s.radioBtnActivo : s.radioBtn}>
                  <input type="radio" name="tipo_derivada" value="dano_oculto"
                    checked={tipoDerivada === 'dano_oculto'}
                    onChange={() => { setTipoDerivada('dano_oculto'); setIdOrdenOrigen(null); setOrdenOrigenSeleccionada(null) }}
                    style={{ display: 'none' }} />
                  Por daño oculto (particular)
                </label>
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  <span style={s.accent}>Órdenes de este vehículo</span>
                  <span style={s.opcional}> — {vehiculo.matricula}</span>
                </label>

                {cargandoOrdenes && <p style={s.buscando}>Cargando órdenes...</p>}

                {!cargandoOrdenes && (() => {
                  const filtradas = tipoDerivada === 'garantia'
                    ? ordenesOrigen.filter(o => o.es_garantia)
                    : ordenesOrigen
                  if (filtradas.length === 0) return (
                    <p style={s.buscando}>
                      {tipoDerivada === 'garantia'
                        ? 'No hay órdenes con garantía activa para este vehículo.'
                        : 'No hay órdenes anteriores para este vehículo.'}
                    </p>
                  )
                  return null
                })()}

                {!idOrdenOrigen && (() => {
                  const filtradas = tipoDerivada === 'garantia'
                    ? ordenesOrigen.filter(o => o.es_garantia)
                    : ordenesOrigen
                  if (filtradas.length === 0) return null
                  return (
                  <div style={s.listaOrigen}>
                    {filtradas.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setIdOrdenOrigen(o.id)
                          setOrdenOrigenSeleccionada(o)
                        }}
                        style={s.origenItem}
                      >
                        <span style={s.origenMatricula}>#{o.id} — {o.matricula}</span>
                        <span style={s.origenMeta}>
                          {o.tipo} · {o.estado} · {o.tipo_pago}
                          {o.es_garantia ? ' · 🛡 garantía' : ''}
                        </span>
                        <span style={{ ...s.origenMeta, color: 'var(--neutral-400)' }}>
                          Ingreso: {new Date(o.fecha_ingreso).toLocaleDateString('es-NI')}
                        </span>
                      </button>
                    ))}
                  </div>
                  )
                })()}
              </div>

              {ordenOrigenSeleccionada && (
                <div style={s.origenConfirmado}>
                  <span style={s.origenConfirmadoLabel}>Orden origen seleccionada:</span>
                  <span style={s.origenMatricula}>#{ordenOrigenSeleccionada.id} — {ordenOrigenSeleccionada.matricula}</span>
                  <span style={s.origenMeta}>{ordenOrigenSeleccionada.tipo} · {ordenOrigenSeleccionada.estado}</span>
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
              onClick={() => automatic ? navigate(`/cotizaciones/${presupuesto.id}`) : navigate(particular || presupuesto?.es_cotizacion ? '/ordenes/nueva/vehiculo' : '/ordenes/nueva/presupuesto', { state: { cliente, vehiculo, particular, presupuestoCotizacion: presupuesto?.es_cotizacion ? presupuesto : undefined } })}
              style={s.btnSecondaryFull}
            >
              {automatic ? '← Volver a la cotización' : particular ? '← Volver al vehículo' : '← Volver al paso 3'}
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
  filaGrid2:          { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem' },
  filaGrid3:          { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' },
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



