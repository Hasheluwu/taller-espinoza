import { useState, useRef } from 'react'

// ─── helpers ────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token')
}

// ─── sub-componentes ────────────────────────────────────────────────────────

function ClienteCard({ cliente, titulo }) {
  if (!cliente) return null

  const filas = [
    { label: 'ID',                  valor: cliente.id },
    { label: 'Nombre',              valor: cliente.nombre },
    { label: 'Cédula',              valor: cliente.cedula },
    { label: 'Teléfono',            valor: cliente.telefono },
    { label: 'Municipio',           valor: cliente.municipio_residencia },
    { label: 'Dirección',           valor: cliente.direccion    || '—' },
    { label: 'Fecha nacimiento',    valor: cliente.fecha_nacimiento
                                            ? new Date(cliente.fecha_nacimiento)
                                                .toLocaleDateString('es-NI')
                                            : '—' },
  ]

  return (
    <div style={s.debugCard}>
      <p style={s.debugTitulo}>{titulo}</p>
      {filas.map(f => (
        <div key={f.label} style={s.debugFila}>
          <span style={s.debugLabel}>{f.label}</span>
          <span style={s.debugValor}>{String(f.valor)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── componente principal ───────────────────────────────────────────────────

export default function IngresarOrden() {
  // modo: 'buscar' | 'agregar'
  const [modo, setModo]                   = useState('buscar')

  // búsqueda
  const [cedulaBusqueda, setCedulaBusqueda] = useState('')
  const [clienteEncontrado, setClienteEncontrado] = useState(null)
  const [errorBusqueda, setErrorBusqueda]   = useState('')
  const [buscando, setBuscando]             = useState(false)

  // formulario nuevo cliente
  const [form, setForm] = useState({
    nombre:               '',
    cedula:               '',
    telefono:             '',
    fecha_nacimiento:     '',
    municipio_residencia: '',
    direccion:            '',
  })
  const [clienteCreado, setClienteCreado]   = useState(null)
  const [errorCrear, setErrorCrear]         = useState('')
  const [creando, setCreando]               = useState(false)

  const inputBusquedaRef = useRef(null)

  // ── handlers búsqueda ──────────────────────────────────────────────────

  async function handleBuscar(e) {
    e.preventDefault()
    setErrorBusqueda('')
    setClienteEncontrado(null)
    setBuscando(true)

    try {
      const res  = await fetch(
        `http://localhost:3001/api/clientes/buscar?cedula=${encodeURIComponent(cedulaBusqueda)}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      )
      const data = await res.json()

      if (!res.ok) {
        setErrorBusqueda(data.message || 'Cliente no encontrado.')
        return
      }
      setClienteEncontrado(data)
    } catch {
      setErrorBusqueda('No se pudo conectar con el servidor.')
    } finally {
      setBuscando(false)
    }
  }

  // ── handlers nuevo cliente ─────────────────────────────────────────────

  function handleFormChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCrearCliente(e) {
    e.preventDefault()
    setErrorCrear('')
    setClienteCreado(null)
    setCreando(true)

    try {
      const res  = await fetch('http://localhost:3001/api/clientes', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          nombre:               form.nombre,
          cedula:               form.cedula,
          telefono:             form.telefono,
          fecha_nacimiento:     form.fecha_nacimiento || null,
          municipio_residencia: form.municipio_residencia,
          direccion:            form.direccion || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorCrear(data.message || 'Error al crear el cliente.')
        return
      }
      setClienteCreado(data)
    } catch {
      setErrorCrear('No se pudo conectar con el servidor.')
    } finally {
      setCreando(false)
    }
  }

  // ── cambio de modo ─────────────────────────────────────────────────────

  function activarModoAgregar() {
    setModo('agregar')
    setErrorBusqueda('')
    setClienteEncontrado(null)
  }

  function activarModoBuscar() {
    setModo('buscar')
    setErrorCrear('')
    setClienteCreado(null)
    setForm({
      nombre: '', cedula: '', telefono: '',
      fecha_nacimiento: '', municipio_residencia: '', direccion: '',
    })
    setTimeout(() => inputBusquedaRef.current?.focus(), 50)
  }

  const buscandoActivo = modo === 'buscar'
  const agregandoActivo = modo === 'agregar'

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* ── Encabezado ─────────────────────────────────────── */}
        <div style={s.header}>
          <span style={s.eyebrow}>Ruta 1</span>
          <h1 style={s.titulo}>
            Ingresar <span style={s.accent}>Orden</span>
          </h1>
          <p style={s.subtitulo}>Paso 1 — Identificación del cliente</p>
        </div>

        {/* ── Cuerpo: formulario + debug en fila ─────────────── */}
        <div style={s.cuerpo}>

          {/* columna izquierda — formularios */}
          <div style={s.columnaIzq}>

            {/* ── Sección buscar cliente ─────────────────────── */}
            <section style={buscandoActivo ? s.seccion : s.seccionDisabled}>
              <div style={s.seccionHeader}>
                <h2 style={s.seccionTitulo}>
                  Buscar <span style={buscandoActivo ? s.accent : s.accentDim}>cliente existente</span>
                </h2>
                {!buscandoActivo && (
                  <button
                    type="button"
                    onClick={activarModoBuscar}
                    style={s.btnMini}
                  >
                    Activar
                  </button>
                )}
              </div>

              <form onSubmit={handleBuscar} style={s.form}>
                <div style={s.field}>
                  <label style={buscandoActivo ? s.label : s.labelDim}>
                    <span style={buscandoActivo ? s.labelAccent : s.accentDim}>Cédula</span> del cliente
                  </label>
                  <input
                    ref={inputBusquedaRef}
                    type="text"
                    value={cedulaBusqueda}
                    onChange={e => setCedulaBusqueda(e.target.value)}
                    placeholder="Ej: 001-123456-0001A"
                    disabled={!buscandoActivo}
                    style={buscandoActivo ? s.input : s.inputDisabled}
                  />
                </div>

                {errorBusqueda && buscandoActivo && (
                  <p style={s.errorMsg}>{errorBusqueda}</p>
                )}

                <div style={s.botonesRow}>
                  <button
                    type="submit"
                    disabled={!buscandoActivo || buscando}
                    style={buscandoActivo ? s.btnPrimary : s.btnDisabled}
                  >
                    {buscando ? 'Buscando...' : 'Ingresar Orden'}
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

            {/* ── Sección agregar cliente ─────────────────────── */}
            {agregandoActivo && (
              <section style={s.seccion}>
                <div style={s.seccionHeader}>
                  <h2 style={s.seccionTitulo}>
                    Nuevo <span style={s.accent}>cliente</span>
                  </h2>
                  <button
                    type="button"
                    onClick={activarModoBuscar}
                    style={s.btnMini}
                  >
                    ← Cancelar
                  </button>
                </div>

                <form onSubmit={handleCrearCliente} style={s.form}>

                  <CampoTexto
                    label="Nombre completo"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleFormChange}
                    placeholder="Ej: María López García"
                    requerido
                  />

                  <CampoTexto
                    label="Cédula"
                    name="cedula"
                    value={form.cedula}
                    onChange={handleFormChange}
                    placeholder="Ej: 001-123456-0001A"
                    requerido
                  />

                  <CampoTexto
                    label="Teléfono"
                    name="telefono"
                    value={form.telefono}
                    onChange={handleFormChange}
                    placeholder="Ej: 8888-1234"
                    requerido
                  />

                  <CampoTexto
                    label="Municipio de residencia"
                    name="municipio_residencia"
                    value={form.municipio_residencia}
                    onChange={handleFormChange}
                    placeholder="Ej: Managua"
                    requerido
                  />

                  <CampoTexto
                    label="Fecha de nacimiento"
                    name="fecha_nacimiento"
                    value={form.fecha_nacimiento}
                    onChange={handleFormChange}
                    type="date"
                    opcional
                  />

                  <CampoTexto
                    label="Dirección"
                    name="direccion"
                    value={form.direccion}
                    onChange={handleFormChange}
                    placeholder="Ej: Reparto Las Brisas, casa #14"
                    opcional
                  />

                  {errorCrear && (
                    <p style={s.errorMsg}>{errorCrear}</p>
                  )}

                  <button
                    type="submit"
                    disabled={creando}
                    style={creando ? s.btnDisabled : s.btnPrimary}
                  >
                    {creando ? 'Guardando...' : 'Crear cliente'}
                  </button>

                </form>
              </section>
            )}

          </div>{/* fin columna izq */}

          {/* columna derecha — debug */}
          <div style={s.columnaDer}>
            {(clienteEncontrado || clienteCreado) ? (
              <ClienteCard
                cliente={clienteEncontrado || clienteCreado}
                titulo={clienteEncontrado ? '✓ Cliente encontrado' : '✓ Cliente creado'}
              />
            ) : (
              <div style={s.debugVacio}>
                <p style={s.debugVacioTexto}>
                  Los datos del cliente aparecerán aquí tras la búsqueda o creación.
                </p>
              </div>
            )}
          </div>

        </div>{/* fin cuerpo */}

      </div>
    </div>
  )
}

// ─── campo de texto reutilizable ─────────────────────────────────────────────

function CampoTexto({ label, name, value, onChange, placeholder, type = 'text', requerido, opcional }) {
  return (
    <div style={s.field}>
      <label style={s.label}>
        <span style={s.labelAccent}>{label}</span>
        {opcional && <span style={s.labelOpcional}> — opcional</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={!!requerido}
        style={s.input}
        onFocus={e => Object.assign(e.target.style, s.inputFocus)}
        onBlur={e  => Object.assign(e.target.style, s.input)}
      />
    </div>
  )
}

// ─── estilos ─────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight:       '100vh',
    backgroundColor: 'var(--background)',
    padding:         '2rem 1.5rem',
    display:         'flex',
    justifyContent:  'center',
  },

  container: {
    width:    '100%',
    maxWidth: '1100px',
    display:  'flex',
    flexDirection: 'column',
    gap:      '2rem',
  },

  header: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.3rem',
  },

  eyebrow: {
    fontSize:      'var(--text-xs)',
    fontWeight:    'var(--weight-medium)',
    color:         'var(--neutral-300)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },

  titulo: {
    fontSize:   'var(--text-title)',
    fontWeight: 'var(--weight-bold)',
    color:      'var(--foreground)',
    margin:     0,
    lineHeight: 1.1,
  },

  subtitulo: {
    fontSize: 'var(--text-body)',
    color:    'var(--text-tertiary)',
    margin:   0,
  },

  accent: {
    color: 'var(--yellow-500)',
  },

  accentDim: {
    color: 'var(--neutral-400)',
  },

  cuerpo: {
    display: 'flex',
    gap:     '2rem',
    alignItems: 'flex-start',
  },

  columnaIzq: {
    flex:    '0 0 460px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },

  columnaDer: {
    flex: 1,
  },

  // secciones
  seccion: {
    backgroundColor: 'var(--surface)',
    border:          '1px solid var(--border)',
    borderRadius:    'var(--radius-lg)',
    padding:         '1.75rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             '1.25rem',
  },

  seccionDisabled: {
    backgroundColor: 'var(--surface)',
    border:          '1px solid var(--border)',
    borderRadius:    'var(--radius-lg)',
    padding:         '1.75rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             '1.25rem',
    opacity:         0.45,
  },

  seccionHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },

  seccionTitulo: {
    fontSize:   'var(--text-body-lg)',
    fontWeight: 'var(--weight-bold)',
    color:      'var(--foreground)',
    margin:     0,
  },

  // formulario
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '1rem',
  },

  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.35rem',
  },

  label: {
    fontSize:   'var(--text-small)',
    color:      'var(--neutral-200)',
    fontWeight: 'var(--weight-medium)',
  },

  labelDim: {
    fontSize:   'var(--text-small)',
    color:      'var(--neutral-400)',
    fontWeight: 'var(--weight-medium)',
  },

  labelAccent: {
    color:      'var(--yellow-400)',
    fontWeight: 'var(--weight-bold)',
  },

  labelOpcional: {
    color:      'var(--neutral-400)',
    fontWeight: 'var(--weight-regular)',
    fontSize:   'var(--text-xs)',
  },

  input: {
    backgroundColor: 'var(--surface-raised)',
    border:          '1px solid var(--border)',
    color:           'var(--foreground)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.65rem 0.875rem',
    fontSize:        'var(--text-body)',
    outline:         'none',
    width:           '100%',
    transition:      'border-color 0.15s, box-shadow 0.15s',
  },

  inputFocus: {
    backgroundColor: 'var(--surface-raised)',
    border:          '1px solid var(--yellow-500)',
    color:           'var(--foreground)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.65rem 0.875rem',
    fontSize:        'var(--text-body)',
    outline:         'none',
    width:           '100%',
    boxShadow:       'var(--glow-yellow)',
  },

  inputDisabled: {
    backgroundColor: 'var(--surface)',
    border:          '1px solid var(--border)',
    color:           'var(--neutral-400)',
    borderRadius:    'var(--radius-md)',
    padding:         '0.65rem 0.875rem',
    fontSize:        'var(--text-body)',
    outline:         'none',
    width:           '100%',
    cursor:          'not-allowed',
  },

  botonesRow: {
    display: 'flex',
    gap:     '0.75rem',
    marginTop: '0.25rem',
  },

  btnPrimary: {
    flex:            1,
    backgroundColor: 'var(--yellow-500)',
    color:           'var(--background)',
    fontWeight:      'var(--weight-bold)',
    fontSize:        'var(--text-body)',
    padding:         '0.7rem 1rem',
    borderRadius:    'var(--radius-md)',
    border:          'none',
    cursor:          'pointer',
    transition:      'background 0.15s',
  },

  btnSecondary: {
    flex:            1,
    backgroundColor: 'var(--surface-raised)',
    color:           'var(--foreground)',
    fontWeight:      'var(--weight-medium)',
    fontSize:        'var(--text-body)',
    padding:         '0.7rem 1rem',
    borderRadius:    'var(--radius-md)',
    border:          '1px solid var(--border)',
    cursor:          'pointer',
    transition:      'background 0.15s',
  },

  btnDisabled: {
    flex:            1,
    backgroundColor: 'var(--surface)',
    color:           'var(--neutral-400)',
    fontWeight:      'var(--weight-medium)',
    fontSize:        'var(--text-body)',
    padding:         '0.7rem 1rem',
    borderRadius:    'var(--radius-md)',
    border:          '1px solid var(--border)',
    cursor:          'not-allowed',
    opacity:         0.5,
  },

  btnMini: {
    backgroundColor: 'transparent',
    color:           'var(--neutral-300)',
    fontSize:        'var(--text-small)',
    fontWeight:      'var(--weight-medium)',
    padding:         '0.3rem 0.75rem',
    borderRadius:    'var(--radius-sm)',
    border:          '1px solid var(--border)',
    cursor:          'pointer',
  },

  errorMsg: {
    fontSize:        'var(--text-small)',
    color:           'var(--danger)',
    backgroundColor: 'var(--danger-bg)',
    border:          '1px solid rgba(229,72,77,0.25)',
    borderRadius:    'var(--radius-sm)',
    padding:         '0.5rem 0.75rem',
    margin:          0,
  },

  // debug card
  debugCard: {
    backgroundColor: 'var(--surface)',
    border:          '1px solid var(--border-hover)',
    borderRadius:    'var(--radius-lg)',
    padding:         '1.5rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             '0.6rem',
  },

  debugTitulo: {
    fontSize:    'var(--text-small)',
    fontWeight:  'var(--weight-bold)',
    color:       'var(--yellow-400)',
    margin:      '0 0 0.5rem',
    letterSpacing: '0.04em',
  },

  debugFila: {
    display:         'flex',
    justifyContent:  'space-between',
    gap:             '1rem',
    borderBottom:    '1px solid var(--border)',
    paddingBottom:   '0.4rem',
  },

  debugLabel: {
    fontSize:   'var(--text-small)',
    color:      'var(--neutral-300)',
    fontWeight: 'var(--weight-medium)',
    flexShrink: 0,
  },

  debugValor: {
    fontSize:  'var(--text-small)',
    color:     'var(--foreground)',
    textAlign: 'right',
    wordBreak: 'break-all',
  },

  debugVacio: {
    backgroundColor: 'var(--surface)',
    border:          '1px dashed var(--border)',
    borderRadius:    'var(--radius-lg)',
    padding:         '2rem',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       '180px',
  },

  debugVacioTexto: {
    fontSize:  'var(--text-small)',
    color:     'var(--neutral-400)',
    textAlign: 'center',
    margin:    0,
  },
}