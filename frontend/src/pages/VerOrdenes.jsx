import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const getToken = () => localStorage.getItem('token')
const API = 'http://localhost:3001'

const ESTADO_STYLES = {
  recibido:   { bg: 'rgba(107,138,170,0.15)', color: '#6b8aaa', border: 'rgba(107,138,170,0.3)' },
  en_proceso: { bg: 'rgba(255,195,0,0.12)',   color: '#FFC300', border: 'rgba(255,195,0,0.3)'   },
  listo:      { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', border: 'rgba(34,197,94,0.3)'   },
  entregado:  { bg: 'rgba(51,133,214,0.12)',  color: '#3385d6', border: 'rgba(51,133,214,0.3)'  },
  cancelado:  { bg: 'rgba(229,72,77,0.12)',   color: '#e5484d', border: 'rgba(229,72,77,0.3)'   },
}

function BadgeEstado({ estado }) {
  const st = ESTADO_STYLES[estado] || ESTADO_STYLES.recibido
  return (
    <span style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: 'var(--radius-full)', padding: '0.2rem 0.65rem', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>
      {estado.replace('_', ' ')}
    </span>
  )
}

function BadgeGarantia({ es }) {
  return (
    <span style={{ backgroundColor: es ? 'rgba(82,183,136,0.12)' : 'rgba(107,138,170,0.1)', color: es ? '#52B788' : '#6b8aaa', border: `1px solid ${es ? 'rgba(82,183,136,0.3)' : 'rgba(107,138,170,0.2)'}`, borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>
      {es ? 'Garantía' : 'Normal'}
    </span>
  )
}

function TarjetaRow({ o, onPago, onOperaciones }) {
  return (
    <div style={s.cardRow}>
      <div style={s.cardRowMain}>
        <div style={s.cardRowIzq}>
          <span style={s.matricula}>{o.matricula}</span>
          <span style={s.clienteNombre}>{o.nombre_cliente}</span>
          <span style={s.cedula}>{o.cedula}</span>
        </div>
        <div style={s.cardRowMid}>
          <BadgeEstado estado={o.estado} />
          <BadgeGarantia es={!!o.es_garantia} />
          <span style={s.tipoBadge}>{o.tipo}</span>
          <span style={s.pagoBadge}>{o.tipo_pago}</span>
        </div>
        <div style={s.cardRowDer}>
          <span style={s.fechaLabel}>Ingreso</span>
          <span style={s.fechaVal}>{new Date(o.fecha_ingreso).toLocaleDateString('es-NI')}</span>
          {o.fecha_entrega_estimada && (
            <>
              <span style={s.fechaLabel}>Entrega est.</span>
              <span style={s.fechaVal}>{new Date(o.fecha_entrega_estimada).toLocaleDateString('es-NI')}</span>
            </>
          )}
        </div>
      </div>
      <div style={s.cardBtns}>
        <button style={s.btnDetalle} disabled title="Disponible próximamente">Ver detalle</button>
        <button style={s.btnOperaciones} onClick={() => onOperaciones(o.id)}>Operaciones</button>
        <button style={s.btnPago} onClick={() => onPago(o.id)}>Ingresar pago</button>
        {o.tipo_pago === 'lafise' && (
          <button style={s.btnLinker} disabled title="Disponible próximamente">Linker LAFISE</button>
        )}
      </div>
    </div>
  )
}

function TarjetaGrid({ o, onPago, onOperaciones }) {
  return (
    <div style={s.cardGrid}>
      <div style={s.gridHeader}>
        <span style={s.matricula}>{o.matricula}</span>
        <BadgeEstado estado={o.estado} />
      </div>
      <span style={s.clienteNombre}>{o.nombre_cliente}</span>
      <span style={s.cedula}>{o.cedula}</span>
      <div style={s.gridBadges}>
        <BadgeGarantia es={!!o.es_garantia} />
        <span style={s.tipoBadge}>{o.tipo}</span>
        <span style={s.pagoBadge}>{o.tipo_pago}</span>
      </div>
      <span style={s.fechaLabel}>
        Ingreso: <span style={s.fechaVal}>{new Date(o.fecha_ingreso).toLocaleDateString('es-NI')}</span>
      </span>
      <div style={s.cardBtns}>
        <button style={s.btnDetalle} disabled>Ver detalle</button>
        <button style={s.btnOperaciones} onClick={() => onOperaciones(o.id)}>Operaciones</button>
        <button style={s.btnPago} onClick={() => onPago(o.id)}>Pago</button>
      </div>
    </div>
  )
}

export default function VerOrdenes() {
  const navigate    = useNavigate()
  const filtrosRef  = useRef(null)

  const [ordenes, setOrdenes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modo, setModo]         = useState('row')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const [q, setQ]                           = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')
  const [filtroTipo, setFiltroTipo]         = useState('')
  const [filtroPago, setFiltroPago]         = useState('')
  const [filtroGarantia, setFiltroGarantia] = useState('')
  const [filtroExterno, setFiltroExterno]   = useState('')
  const [filtroInterno, setFiltroInterno]   = useState('')
  const [filtroDanos, setFiltroDanos]       = useState('')
  const [fechaDesde, setFechaDesde]         = useState('')
  const [fechaHasta, setFechaHasta]         = useState('')
  const [ordenCosto, setOrdenCosto]         = useState('')
  const [soloActivas, setSoloActivas]       = useState(true)

  // cuenta cuántos filtros están activos (excluye soloActivas que siempre está)
  const filtrosActivos = [filtroEstado, filtroTipo, filtroPago, filtroGarantia,
    filtroExterno, filtroInterno, filtroDanos, fechaDesde, fechaHasta, ordenCosto
  ].filter(Boolean).length

  const cargarOrdenes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q)             params.set('q', q)
      if (filtroEstado)  params.set('estado', filtroEstado)
      if (filtroTipo)    params.set('tipo', filtroTipo)
      if (filtroPago)    params.set('tipo_pago', filtroPago)
      if (filtroGarantia !== '') params.set('es_garantia', filtroGarantia)
      if (filtroExterno !== '')  params.set('obra_externa', filtroExterno)
      if (filtroInterno !== '')  params.set('obra_interna', filtroInterno)
      if (filtroDanos !== '')    params.set('danos_ocultos', filtroDanos)
      if (fechaDesde)    params.set('fecha_desde', fechaDesde)
      if (fechaHasta)    params.set('fecha_hasta', fechaHasta)
      if (ordenCosto)    params.set('orden_costo', ordenCosto)
      params.set('solo_activas', soloActivas ? 'true' : 'false')

      const res  = await fetch(`${API}/api/ordenes?${params}`, {
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
  }, [q, filtroEstado, filtroTipo, filtroPago, filtroGarantia, filtroExterno,
      filtroInterno, filtroDanos, fechaDesde, fechaHasta, ordenCosto, soloActivas])

  useEffect(() => { cargarOrdenes() }, [cargarOrdenes])

  // cerrar panel si se hace click fuera
  useEffect(() => {
    function handleClick(e) {
      if (filtrosRef.current && !filtrosRef.current.contains(e.target)) {
        setFiltrosAbiertos(false)
      }
    }
    if (filtrosAbiertos) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filtrosAbiertos])

  function limpiarFiltros() {
    setQ(''); setFiltroEstado(''); setFiltroTipo(''); setFiltroPago('')
    setFiltroGarantia(''); setFiltroExterno(''); setFiltroInterno('')
    setFiltroDanos(''); setFechaDesde(''); setFechaHasta(''); setOrdenCosto('')
    setSoloActivas(true)
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* encabezado */}
        <div style={s.header}>
          <div>
            <span style={s.eyebrow}>Ruta 2</span>
            <h1 style={s.titulo}>Ver <span style={s.accent}>Órdenes</span></h1>
          </div>
          <button onClick={() => navigate('/ordenes/nueva')} style={s.btnNueva}>+ Nueva orden</button>
        </div>

        {/* ── barra principal: búsqueda + filtros + toggle ───────────────── */}
        <div style={s.barraTop}>

          {/* input búsqueda — más corto */}
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por cédula, nombre o matrícula..."
            style={s.inputBusqueda}
          />

          {/* botón filtros con contador de activos */}
          <div ref={filtrosRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setFiltrosAbiertos(v => !v)}
              style={{
                ...s.btnFiltros,
                ...(filtrosAbiertos ? s.btnFiltrosActivo : {}),
              }}
            >
              Filtros
              {filtrosActivos > 0 && (
                <span style={s.filtrosBadge}>{filtrosActivos}</span>
              )}
              <span style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}>{filtrosAbiertos ? '▲' : '▼'}</span>
            </button>

            {/* panel desplegable */}
            {filtrosAbiertos && (
              <div style={s.filtrosPanel}>
                <div style={s.filtrosPanelInner}>

                  {/* fila 1 */}
                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Estado</span>
                    <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={s.select}>
                      <option value="">Todos</option>
                      <option value="recibido">Recibido</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="listo">Listo</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Tipo</span>
                    <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={s.select}>
                      <option value="">Todos</option>
                      <option value="pintura">Pintura</option>
                      <option value="mecanica">Mecánica</option>
                      <option value="mantenimiento">Mantenimiento</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Pago</span>
                    <select value={filtroPago} onChange={e => setFiltroPago(e.target.value)} style={s.select}>
                      <option value="">Todos</option>
                      <option value="particular">Particular</option>
                      <option value="lafise">LAFISE</option>
                      <option value="iniser">INISER</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Garantía</span>
                    <select value={filtroGarantia} onChange={e => setFiltroGarantia(e.target.value)} style={s.select}>
                      <option value="">Todas</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Obra externa</span>
                    <select value={filtroExterno} onChange={e => setFiltroExterno(e.target.value)} style={s.select}>
                      <option value="">Todas</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Obra interna</span>
                    <select value={filtroInterno} onChange={e => setFiltroInterno(e.target.value)} style={s.select}>
                      <option value="">Todas</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Daños ocultos</span>
                    <select value={filtroDanos} onChange={e => setFiltroDanos(e.target.value)} style={s.select}>
                      <option value="">Todos</option>
                      <option value="true">Con daños</option>
                      <option value="false">Sin daños</option>
                    </select>
                  </div>

                  <div style={s.filtroGrupo}>
                    <span style={s.filtroLabel}>Orden por costo</span>
                    <select value={ordenCosto} onChange={e => setOrdenCosto(e.target.value)} style={s.select}>
                      <option value="">Sin ordenar</option>
                      <option value="desc">Mayor a menor</option>
                      <option value="asc">Menor a mayor</option>
                    </select>
                  </div>

                  {/* rango fechas */}
                  <div style={{ ...s.filtroGrupo, gridColumn: 'span 2' }}>
                    <span style={s.filtroLabel}>Rango de ingreso</span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={s.select} />
                      <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-small)' }}>→</span>
                      <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={s.select} />
                    </div>
                  </div>

                  {/* solo activas */}
                  <div style={{ ...s.filtroGrupo, justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={soloActivas} onChange={e => setSoloActivas(e.target.checked)} style={{ accentColor: 'var(--yellow-500)', width: '15px', height: '15px' }} />
                      <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-200)' }}>Solo activas</span>
                    </label>
                  </div>

                </div>

                {/* pie del panel */}
                <div style={s.filtrosPie}>
                  <button onClick={limpiarFiltros} style={s.btnLimpiar}>Limpiar filtros</button>
                  <button onClick={() => setFiltrosAbiertos(false)} style={s.btnAplicar}>Aplicar</button>
                </div>
              </div>
            )}
          </div>

          {/* toggle layout */}
          <div style={s.toggleLayout}>
            <button onClick={() => setModo('row')} style={modo === 'row' ? s.toggleActivo : s.toggleInactivo} title="Vista lista">☰</button>
            <button onClick={() => setModo('grid')} style={modo === 'grid' ? s.toggleActivo : s.toggleInactivo} title="Vista grid">⊞</button>
          </div>

        </div>

        <p style={s.contador}>
          {loading ? 'Cargando...' : `${ordenes.length} orden${ordenes.length !== 1 ? 'es' : ''}${filtrosActivos > 0 ? ` · ${filtrosActivos} filtro${filtrosActivos !== 1 ? 's' : ''} activo${filtrosActivos !== 1 ? 's' : ''}` : ''}`}
        </p>

        {error && <p style={s.errorMsg}>{error}</p>}

        {!loading && ordenes.length === 0 && !error && (
          <div style={s.vacio}><p style={s.vacioTexto}>No hay órdenes que coincidan con los filtros actuales.</p></div>
        )}

        {modo === 'row' ? (
          <div style={s.listaRow}>
            {ordenes.map(o => (
              <TarjetaRow key={o.id} o={o}
                onPago={id => navigate(`/ordenes/${id}/pago`)}
                onOperaciones={id => navigate(`/ordenes/${id}/operaciones`)}
              />
            ))}
          </div>
        ) : (
          <div style={s.listaGrid}>
            {ordenes.map(o => (
              <TarjetaGrid key={o.id} o={o}
                onPago={id => navigate(`/ordenes/${id}/pago`)}
                onOperaciones={id => navigate(`/ordenes/${id}/operaciones`)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

const s = {
  page:           { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:      { width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow:        { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-300)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:         { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  accent:         { color: 'var(--yellow-500)' },
  btnNueva:       { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },

  barraTop:       { display: 'flex', gap: '0.6rem', alignItems: 'center' },
  inputBusqueda:  { width: '280px', flexShrink: 0, backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.875rem', fontSize: 'var(--text-body)', outline: 'none' },

  btnFiltros:     { display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--neutral-200)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.55rem 0.875rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnFiltrosActivo: { borderColor: 'var(--yellow-500)', color: 'var(--yellow-400)' },
  filtrosBadge:   { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', borderRadius: 'var(--radius-full)', fontSize: '0.65rem', fontWeight: 'var(--weight-bold)', padding: '0.1rem 0.4rem', lineHeight: 1 },

  filtrosPanel:   { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', width: '560px', overflow: 'hidden' },
  filtrosPanelInner: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', padding: '1.25rem' },
  filtroGrupo:    { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  filtroLabel:    { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  filtrosPie:     { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' },
  btnLimpiar:     { backgroundColor: 'transparent', color: 'var(--danger)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(229,72,77,0.3)', cursor: 'pointer' },
  btnAplicar:     { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.4rem 0.875rem', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer' },

  select:         { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.6rem', fontSize: 'var(--text-small)', outline: 'none', width: '100%' },
  toggleLayout:   { display: 'flex', gap: '0.2rem', marginLeft: 'auto' },
  toggleActivo:   { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  toggleInactivo: { backgroundColor: 'var(--surface-raised)', color: 'var(--neutral-300)', fontSize: 'var(--text-body)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', cursor: 'pointer' },

  contador:       { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0 },
  errorMsg:       { fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 },
  vacio:          { backgroundColor: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vacioTexto:     { fontSize: 'var(--text-body)', color: 'var(--neutral-400)', margin: 0 },

  listaRow:       { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  listaGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' },

  cardRow:        { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  cardRowMain:    { display: 'flex', gap: '2rem', alignItems: 'flex-start' },
  cardRowIzq:     { display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '180px' },
  cardRowMid:     { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', flex: 1 },
  cardRowDer:     { display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: '120px', textAlign: 'right' },
  cardGrid:       { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  gridHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  gridBadges:     { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },

  matricula:      { fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },
  clienteNombre:  { fontSize: 'var(--text-body)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)' },
  cedula:         { fontSize: 'var(--text-small)', color: 'var(--neutral-300)' },
  tipoBadge:      { fontSize: 'var(--text-xs)', color: 'var(--blue-300)', backgroundColor: 'rgba(51,133,214,0.1)', border: '1px solid rgba(51,133,214,0.25)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontWeight: 'var(--weight-medium)', textTransform: 'capitalize' },
  pagoBadge:      { fontSize: 'var(--text-xs)', color: 'var(--neutral-200)', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '0.15rem 0.5rem', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase' },
  fechaLabel:     { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  fechaVal:       { fontSize: 'var(--text-small)', color: 'var(--neutral-200)' },
  cardBtns:       { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  btnDetalle:     { backgroundColor: 'var(--surface-raised)', color: 'var(--neutral-400)', fontSize: 'var(--text-small)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
  btnOperaciones: { backgroundColor: 'var(--blue-700)', color: 'var(--foreground)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--blue-600)', cursor: 'pointer' },
  btnPago:        { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer' },
  btnLinker:      { backgroundColor: 'transparent', color: 'var(--neutral-400)', fontSize: 'var(--text-small)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.5 },
}