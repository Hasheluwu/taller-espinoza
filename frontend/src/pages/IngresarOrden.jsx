// frontend/src/pages/IngresarOrden.jsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = 'http://localhost:3001'

// ─── helpers ──────────────────────────────────────────────────────────────────
function hoy() {
  return new Date().toISOString().slice(0, 10)
}
function haceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ─── card de cliente confirmado ───────────────────────────────────────────────
function ClienteCard({ cliente }) {
  const filas = [
    { label: 'ID',        valor: cliente.id },
    { label: 'Nombre',    valor: cliente.nombre },
    { label: 'Cédula',    valor: cliente.cedula },
    { label: 'Teléfono',  valor: cliente.telefono },
    { label: 'Municipio', valor: cliente.municipio_residencia },
    { label: 'Dirección', valor: cliente.direccion || '—' },
  ]
  return (
    <div style={s.debugCard}>
      <p style={s.debugTitulo}>✓ Cliente confirmado</p>
      {filas.map(f => (
        <div key={f.label} style={s.debugFila}>
          <span style={s.debugLabel}>{f.label}</span>
          <span style={s.debugValor}>{String(f.valor)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── panel de filtros ─────────────────────────────────────────────────────────
function PanelFiltros({ modo, setModo, fechaDesde, setFechaDesde, fechaHasta, setFechaHasta, onCerrar }) {
  const ACCESOS_RAPIDOS = [
    { label: 'Hoy',             desde: hoy(),         hasta: hoy() },
    { label: 'Última semana',   desde: haceNDias(7),  hasta: hoy() },
    { label: 'Último mes',      desde: haceNDias(30), hasta: hoy() },
    { label: 'Últimos 3 meses', desde: haceNDias(90), hasta: hoy() },
  ]

  return (
    <div style={s.panelFiltros}>
      {/* modo de búsqueda */}
      <div style={s.filtroSeccion}>
        <p style={s.filtroLabel}>Buscar por</p>
        <div style={s.filtroChips}>
          {[
            { val: 'nombre',    txt: 'Nombre' },
            { val: 'municipio', txt: 'Municipio' },
            { val: 'telefono',  txt: 'Teléfono' },
          ].map(op => (
            <button
              key={op.val}
              type="button"
              onClick={() => setModo(op.val)}
              style={modo === op.val ? s.chipActivo : s.chip}
            >
              {op.txt}
            </button>
          ))}
        </div>
      </div>

      {/* accesos rápidos de tiempo */}
      <div style={s.filtroSeccion}>
        <p style={s.filtroLabel}>Período de registro</p>
        <div style={s.filtroChips}>
          {ACCESOS_RAPIDOS.map(ar => (
            <button
              key={ar.label}
              type="button"
              onClick={() => { setFechaDesde(ar.desde); setFechaHasta(ar.hasta) }}
              style={
                fechaDesde === ar.desde && fechaHasta === ar.hasta
                  ? s.chipActivo : s.chip
              }
            >
              {ar.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setFechaDesde(''); setFechaHasta('') }}
            style={!fechaDesde && !fechaHasta ? s.chipActivo : s.chip}
          >
            Todos
          </button>
        </div>
      </div>

      {/* rango personalizado */}
      <div style={s.filtroSeccion}>
        <p style={s.filtroLabel}>Rango personalizado</p>
        <div style={s.filtroFechaRow}>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            style={s.inputFecha}
          />
          <span style={s.fechaSep}>→</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            style={s.inputFecha}
          />
        </div>
      </div>

      <button type="button" onClick={onCerrar} style={s.btnCerrarFiltros}>
        Cerrar
      </button>
    </div>
  )
}

// ─── campo de texto reutilizable ──────────────────────────────────────────────
function CampoTexto({ label, name, value, onChange, placeholder, type = 'text', requerido, opcional, disabled }) {
  return (
    <div style={s.field}>
      <label style={s.label}>
        <span style={s.labelAccent}>{label}</span>
        {opcional && <span style={s.labelOpcional}> — opcional</span>}
      </label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} required={!!requerido} disabled={!!disabled}
        style={disabled ? s.inputDisabled : s.input}
        onFocus={e => !disabled && Object.assign(e.target.style, s.inputFocus)}
        onBlur={e  => Object.assign(e.target.style, disabled ? s.inputDisabled : s.input)}
      />
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function IngresarOrden() {
  const navigate = useNavigate()

  const [modo, setModo] = useState('buscar') // 'buscar' | 'agregar'

  // ── búsqueda flexible ─────────────────────────────────────────────────────
  const [busqModo, setBusqModo]               = useState('nombre')
  const [busqQ, setBusqQ]                     = useState('')
  const [sugerencias, setSugerencias]         = useState([])
  const [dropVisible, setDropVisible]         = useState(false)
  const [buscandoQ, setBuscandoQ]             = useState(false)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [fechaDesde, setFechaDesde]           = useState('')
  const [fechaHasta, setFechaHasta]           = useState('')

  // ── búsqueda exacta por cédula ────────────────────────────────────────────
  const [cedulaBusqueda, setCedulaBusqueda] = useState('')
  const [errorBusqueda, setErrorBusqueda]   = useState('')
  const [buscando, setBuscando]             = useState(false)

  // ── cliente confirmado ─────────────────────────────────────────────────────
  const [clienteConfirmado, setClienteConfirmado] = useState(null)

  // ── formulario de creación ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    nombre: '', cedula: '', telefono: '',
    fecha_nacimiento: '', municipio_residencia: '', direccion: '',
  })
  const [errorCrear, setErrorCrear] = useState('')
  const [creando, setCreando]       = useState(false)

  const inputCedulaRef  = useRef(null)
  const busqWrapRef     = useRef(null)
  const panelFiltrosRef = useRef(null)
  const agregandoActivo = modo === 'agregar'

  const placeholders = {
    nombre:    'Ej: María López...',
    municipio: 'Ej: Masaya...',
    telefono:  'Ej: 8888-1234...',
  }

  // ── debounce: llama a /sugerir cuando cambia texto o filtros ──────────────
  useEffect(() => {
    if (busqQ.trim().length < 2) {
      setSugerencias([])
      setDropVisible(false)
      return
    }
    setBuscandoQ(true)
    const params = new URLSearchParams({ q: busqQ.trim(), modo: busqModo })
    if (fechaDesde) params.set('fecha_desde', fechaDesde)
    if (fechaHasta) params.set('fecha_hasta', fechaHasta)

    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/api/clientes/sugerir?${params}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        const data = await res.json()
        if (res.ok) {
          setSugerencias(data)
          setDropVisible(data.length > 0)
        }
      } catch { /* silencioso */ }
      finally { setBuscandoQ(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [busqQ, busqModo, fechaDesde, fechaHasta])

  // ── cerrar dropdown y panel al hacer click fuera ───────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (busqWrapRef.current && !busqWrapRef.current.contains(e.target))
        setDropVisible(false)
      if (panelFiltrosRef.current && !panelFiltrosRef.current.contains(e.target) &&
          !e.target.closest('[data-filtros-btn]'))
        setFiltrosAbiertos(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── seleccionar del dropdown ───────────────────────────────────────────────
  function handleSeleccionar(cliente) {
    setBusqQ('')
    setSugerencias([])
    setDropVisible(false)
    setCedulaBusqueda(cliente.cedula)
    buscarPorCedula(cliente.cedula)
  }

  // ── búsqueda exacta por cédula ────────────────────────────────────────────
  async function buscarPorCedula(cedula) {
    setErrorBusqueda('')
    setClienteConfirmado(null)
    setBuscando(true)
    try {
      const res  = await fetch(
        `${API}/api/clientes/buscar?cedula=${encodeURIComponent(cedula)}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      )
      const data = await res.json()
      if (!res.ok) { setErrorBusqueda(data.message || 'Cliente no encontrado.'); return }
      setClienteConfirmado(data)
    } catch {
      setErrorBusqueda('No se pudo conectar con el servidor.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleBuscarCedula(e) {
    e.preventDefault()
    if (!cedulaBusqueda.trim()) return
    await buscarPorCedula(cedulaBusqueda)
  }

  // ── formulario nuevo cliente ───────────────────────────────────────────────
  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCrearCliente(e) {
    e.preventDefault()
    setErrorCrear('')
    setClienteConfirmado(null)
    setCreando(true)
    try {
      const res  = await fetch(`${API}/api/clientes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({
          nombre:               form.nombre,
          cedula:               form.cedula,
          telefono:             form.telefono,
          fecha_nacimiento:     form.fecha_nacimiento || null,
          municipio_residencia: form.municipio_residencia,
          direccion:            form.direccion || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCrear(data.message || 'Error al crear el cliente.'); return }
      setClienteConfirmado(data)
      setModo('buscar')
    } catch {
      setErrorCrear('No se pudo conectar con el servidor.')
    } finally {
      setCreando(false)
    }
  }

  // ── cambio de modo ─────────────────────────────────────────────────────────
  function activarModoAgregar() {
    setModo('agregar')
    setErrorBusqueda('')
    setClienteConfirmado(null)
    setBusqQ('')
    setSugerencias([])
    setDropVisible(false)
    setFiltrosAbiertos(false)
  }
  function activarModoBuscar() {
    setModo('buscar')
    setErrorCrear('')
    setClienteConfirmado(null)
    setForm({ nombre: '', cedula: '', telefono: '', fecha_nacimiento: '', municipio_residencia: '', direccion: '' })
    setTimeout(() => inputCedulaRef.current?.focus(), 50)
  }

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <span style={s.eyebrow}>Ruta 1 — Paso 1 de 4</span>
          <h1 style={s.titulo}>Ingresar <span style={s.accent}>Orden</span></h1>
          <p style={s.subtitulo}>Identificación del cliente</p>
        </div>

        <div style={s.cuerpo}>
          <div style={s.columnaIzq}>

            {/* ── sección de búsqueda ── */}
            <section style={agregandoActivo ? s.seccionDisabled : s.seccion}>
              <div style={s.seccionHeader}>
                <h2 style={s.seccionTitulo}>
                  Buscar <span style={agregandoActivo ? s.accentDim : s.accent}>cliente existente</span>
                </h2>
                {agregandoActivo && (
                  <button type="button" onClick={activarModoBuscar} style={s.btnMini}>Activar</button>
                )}
              </div>

              {/* ── input flexible + botón de filtros ── */}
              <div style={s.field}>
                <label style={agregandoActivo ? s.labelDim : s.label}>
                  <span style={agregandoActivo ? s.accentDim : s.labelAccent}>
                    {busqModo === 'nombre'    && 'Buscar por nombre'}
                    {busqModo === 'municipio' && 'Buscar por municipio'}
                    {busqModo === 'telefono'  && 'Buscar por teléfono'}
                  </span>
                  <span style={s.labelOpcional}> — seleccioná del desplegable</span>
                </label>

                <div style={{ position: 'relative' }} ref={busqWrapRef}>
                  <div style={s.busqRow}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="text"
                        value={busqQ}
                        onChange={e => { setBusqQ(e.target.value); setDropVisible(true) }}
                        onFocus={() => sugerencias.length > 0 && setDropVisible(true)}
                        placeholder={placeholders[busqModo]}
                        disabled={agregandoActivo}
                        style={agregandoActivo ? s.inputDisabled : s.input}
                        onBlur={e => Object.assign(e.target.style, agregandoActivo ? s.inputDisabled : s.input)}
                        autoComplete="off"
                      />
                      {buscandoQ && !agregandoActivo && (
                        <span style={s.buscandoTag}>buscando...</span>
                      )}
                    </div>

                    {/* botón filtros */}
                    <div style={{ position: 'relative' }} ref={panelFiltrosRef}>
                      <button
                        type="button"
                        data-filtros-btn="true"
                        disabled={agregandoActivo}
                        onClick={() => setFiltrosAbiertos(v => !v)}
                        style={
                          agregandoActivo ? s.btnFiltrosDisabled
                          : filtrosAbiertos ? s.btnFiltrosActivo
                          : s.btnFiltros
                        }
                        title="Filtros de búsqueda"
                      >
                        ⚙
                        {(fechaDesde || fechaHasta || busqModo !== 'nombre') && (
                          <span style={s.filtrosDot} />
                        )}
                      </button>

                      {filtrosAbiertos && !agregandoActivo && (
                        <PanelFiltros
                          modo={busqModo}
                          setModo={m => { setBusqModo(m); setBusqQ(''); setSugerencias([]) }}
                          fechaDesde={fechaDesde}
                          setFechaDesde={setFechaDesde}
                          fechaHasta={fechaHasta}
                          setFechaHasta={setFechaHasta}
                          onCerrar={() => setFiltrosAbiertos(false)}
                        />
                      )}
                    </div>
                  </div>

                  {/* dropdown de resultados */}
                  {dropVisible && !agregandoActivo && sugerencias.length > 0 && (
                    <div style={s.dropdown}>
                      {sugerencias.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleSeleccionar(c)}
                          style={s.dropdownItem}
                        >
                          <span style={s.dropdownNombre}>{c.nombre}</span>
                          <span style={s.dropdownMeta}>
                            {c.cedula}
                            {c.municipio_residencia ? ` · ${c.municipio_residencia}` : ''}
                            {c.telefono ? ` · ${c.telefono}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* separador */}
              <div style={s.separadorTexto}>
                <div style={s.separadorLinea} />
                <span style={s.separadorLabel}>o directamente por cédula</span>
                <div style={s.separadorLinea} />
              </div>

              {/* ── input cédula exacta ── */}
              <form onSubmit={handleBuscarCedula} style={s.form}>
                <div style={s.field}>
                  <label style={agregandoActivo ? s.labelDim : s.label}>
                    <span style={agregandoActivo ? s.accentDim : s.labelAccent}>Cédula</span>
                  </label>
                  <input
                    ref={inputCedulaRef}
                    type="text"
                    value={cedulaBusqueda}
                    onChange={e => setCedulaBusqueda(e.target.value)}
                    placeholder="Ej: 001-123456-0001A"
                    disabled={agregandoActivo}
                    style={agregandoActivo ? s.inputDisabled : s.input}
                    onFocus={e => !agregandoActivo && Object.assign(e.target.style, s.inputFocus)}
                    onBlur={e  => Object.assign(e.target.style, agregandoActivo ? s.inputDisabled : s.input)}
                  />
                </div>

                {errorBusqueda && !agregandoActivo && <p style={s.errorMsg}>{errorBusqueda}</p>}

                <div style={s.botonesRow}>
                  <button
                    type="submit"
                    disabled={agregandoActivo || buscando || !cedulaBusqueda.trim()}
                    style={agregandoActivo || !cedulaBusqueda.trim() ? s.btnDisabled : s.btnPrimary}
                  >
                    {buscando ? 'Buscando...' : 'Buscar por cédula'}
                  </button>
                  <button
                    type="button"
                    onClick={activarModoAgregar}
                    disabled={agregandoActivo}
                    style={agregandoActivo ? s.btnDisabled : s.btnSecondary}
                  >
                    Agregar cliente
                  </button>
                </div>
              </form>
            </section>

            {/* ── formulario de creación ── */}
            {agregandoActivo && (
              <section style={s.seccion}>
                <div style={s.seccionHeader}>
                  <h2 style={s.seccionTitulo}>Nuevo <span style={s.accent}>cliente</span></h2>
                  <button type="button" onClick={activarModoBuscar} style={s.btnMini}>← Cancelar</button>
                </div>
                <form onSubmit={handleCrearCliente} style={s.form}>
                  <CampoTexto label="Nombre completo"         name="nombre"               value={form.nombre}               onChange={handleFormChange} placeholder="Ej: María López García"           requerido />
                  <CampoTexto label="Cédula"                  name="cedula"               value={form.cedula}               onChange={handleFormChange} placeholder="Ej: 001-123456-0001A"             requerido />
                  <CampoTexto label="Teléfono"                name="telefono"             value={form.telefono}             onChange={handleFormChange} placeholder="Ej: 8888-1234"                    requerido />
                  <CampoTexto label="Municipio de residencia" name="municipio_residencia" value={form.municipio_residencia} onChange={handleFormChange} placeholder="Ej: Managua"                      requerido />
                  <CampoTexto label="Fecha de nacimiento"     name="fecha_nacimiento"     value={form.fecha_nacimiento}     onChange={handleFormChange} type="date"                                     opcional />
                  <CampoTexto label="Dirección"               name="direccion"            value={form.direccion}            onChange={handleFormChange} placeholder="Ej: Reparto Las Brisas, casa #14" opcional />
                  {errorCrear && <p style={s.errorMsg}>{errorCrear}</p>}
                  <button type="submit" disabled={creando} style={creando ? s.btnDisabled : s.btnPrimary}>
                    {creando ? 'Guardando...' : 'Crear cliente'}
                  </button>
                </form>
              </section>
            )}

            {/* ── continuar ── */}
            {clienteConfirmado && (
              <button
                onClick={() => navigate('/ordenes/nueva/vehiculo', { state: { cliente: clienteConfirmado } })}
                style={s.btnContinuar}
              >
                Continuar con <span style={s.btnContinuarNombre}>{clienteConfirmado.nombre}</span> →
              </button>
            )}

          </div>

          {/* ── columna derecha ── */}
          <div style={s.columnaDer}>
            {clienteConfirmado ? (
              <ClienteCard cliente={clienteConfirmado} />
            ) : (
              <div style={s.debugVacio}>
                <p style={s.debugVacioTexto}>Los datos del cliente aparecerán aquí tras la búsqueda o creación.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── estilos ──────────────────────────────────────────────────────────────────
const s = {
  page:               { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:          { width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '2rem' },
  header:             { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  eyebrow:            { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:             { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  subtitulo:          { fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', margin: 0 },
  accent:             { color: 'var(--yellow-500)' },
  accentDim:          { color: 'var(--neutral-400)' },

  cuerpo:             { display: 'flex', gap: '2rem', alignItems: 'flex-start' },
  columnaIzq:         { flex: '0 0 480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  columnaDer:         { flex: 1 },

  seccion:            { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  seccionDisabled:    { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', opacity: 0.45 },
  seccionHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  seccionTitulo:      { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0 },

  form:               { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field:              { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label:              { fontSize: 'var(--text-small)', color: 'var(--neutral-200)', fontWeight: 'var(--weight-medium)' },
  labelDim:           { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)' },
  labelAccent:        { color: 'var(--yellow-400)', fontWeight: 'var(--weight-bold)' },
  labelOpcional:      { color: 'var(--neutral-400)', fontWeight: 'var(--weight-regular)', fontSize: 'var(--text-xs)' },

  input:              { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' },
  inputFocus:         { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--yellow-500)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxSizing: 'border-box', boxShadow: 'var(--glow-yellow)' },
  inputDisabled:      { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--neutral-400)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'not-allowed' },
  inputFecha:         { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.45rem 0.6rem', fontSize: 'var(--text-small)', outline: 'none', flex: 1 },

  busqRow:            { display: 'flex', gap: '0.5rem', alignItems: 'stretch' },

  btnFiltros:         { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--neutral-300)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem', fontSize: '1rem', cursor: 'pointer', position: 'relative', flexShrink: 0 },
  btnFiltrosActivo:   { backgroundColor: 'rgba(255,195,0,0.12)', border: '1px solid var(--yellow-500)', color: 'var(--yellow-400)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem', fontSize: '1rem', cursor: 'pointer', position: 'relative', flexShrink: 0 },
  btnFiltrosDisabled: { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--neutral-500)', borderRadius: 'var(--radius-md)', padding: '0 0.75rem', fontSize: '1rem', cursor: 'not-allowed', opacity: 0.5, flexShrink: 0 },
  filtrosDot:         { position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--yellow-500)' },

  panelFiltros:       { position: 'absolute', top: 'calc(100% + 6px)', right: 0, backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' },
  filtroSeccion:      { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  filtroLabel:        { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },
  filtroChips:        { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  chip:               { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--neutral-300)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', cursor: 'pointer' },
  chipActivo:         { backgroundColor: 'rgba(255,195,0,0.12)', border: '1px solid var(--yellow-500)', color: 'var(--yellow-400)', borderRadius: 'var(--radius-full)', padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', cursor: 'pointer' },
  filtroFechaRow:     { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  fechaSep:           { color: 'var(--neutral-400)', fontSize: 'var(--text-xs)' },
  btnCerrarFiltros:   { backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--neutral-400)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.75rem', fontSize: 'var(--text-xs)', cursor: 'pointer', alignSelf: 'flex-end' },

  dropdown:           { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', overflowY: 'auto', maxHeight: '320px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  dropdownItem:       { display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.65rem 0.875rem', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left', width: '100%' },
  dropdownNombre:     { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-medium)', color: 'var(--foreground)' },
  dropdownMeta:       { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  buscandoTag:        { position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', pointerEvents: 'none' },

  separadorTexto:     { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  separadorLinea:     { flex: 1, height: '1px', backgroundColor: 'var(--border)' },
  separadorLabel:     { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', whiteSpace: 'nowrap' },

  botonesRow:         { display: 'flex', gap: '0.75rem' },
  btnPrimary:         { flex: 1, backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  btnSecondary:       { flex: 1, backgroundColor: 'var(--surface-raised)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnDisabled:        { flex: 1, backgroundColor: 'var(--surface)', color: 'var(--neutral-400)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-body)', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
  btnMini:            { backgroundColor: 'transparent', color: 'var(--neutral-300)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' },
  btnContinuar:       { width: '100%', backgroundColor: 'var(--blue-700)', color: 'var(--foreground)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--blue-600)', cursor: 'pointer', textAlign: 'left' },
  btnContinuarNombre: { color: 'var(--yellow-400)' },

  errorMsg:           { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },

  debugCard:          { backgroundColor: 'var(--surface)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  debugTitulo:        { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)', margin: '0 0 0.5rem', letterSpacing: '0.04em' },
  debugFila:          { display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' },
  debugLabel:         { fontSize: 'var(--text-small)', color: 'var(--neutral-300)', fontWeight: 'var(--weight-medium)', flexShrink: 0 },
  debugValor:         { fontSize: 'var(--text-small)', color: 'var(--foreground)', textAlign: 'right', wordBreak: 'break-all' },
  debugVacio:         { backgroundColor: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' },
  debugVacioTexto:    { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', textAlign: 'center', margin: 0 },
}