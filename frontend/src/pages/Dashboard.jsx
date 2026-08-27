// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react'
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

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-NI')
}

function SeccionTitulo({ children }) {
  return (
    <h2 style={{ fontSize: 'var(--text-body-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, borderLeft: '3px solid var(--yellow-500)', paddingLeft: '0.75rem' }}>
      {children}
    </h2>
  )
}

function CardMetrica({ label, valor, sub, onClick, accent, disabled }) {
  return (
    <div onClick={!disabled ? onClick : undefined} title={disabled ? 'Disponible próximamente' : undefined}
      style={{ backgroundColor: 'var(--surface)', border: `1px solid ${accent ? 'rgba(255,195,0,0.35)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default', opacity: disabled ? 0.5 : 1, transition: 'border-color 0.15s' }}
      onMouseEnter={e => { if (!disabled && onClick) e.currentTarget.style.borderColor = 'var(--yellow-500)' }}
      onMouseLeave={e => { if (!disabled && onClick) e.currentTarget.style.borderColor = accent ? 'rgba(255,195,0,0.35)' : 'var(--border)' }}
    >
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: '2rem', fontWeight: 'var(--weight-bold)', color: accent ? 'var(--yellow-400)' : 'var(--foreground)', lineHeight: 1 }}>
        {valor ?? <span style={{ fontSize: '0.9rem', color: 'var(--neutral-400)' }}>cargando…</span>}
      </span>
      {sub && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' }}>{sub}</span>}
    </div>
  )
}

function Alerta({ texto }) {
  return <p style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', backgroundColor: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', margin: 0 }}>{texto}</p>
}

// ─── Banner de debug ──────────────────────────────────────────────────────────
// Limpia todas las tablas y recarga el seed completo. Solo usar en desarrollo.
function DebugResetBanner() {
  const [estado, setEstado] = useState('idle') // idle | loading | ok | error
  const [msg,    setMsg]    = useState('')

  async function handleReset() {
    const confirmar = window.confirm(
      '⚠️  REINICIO DE BASE DE DATOS\n\n' +
      'Esto borrará TODOS los datos actuales y cargará el seed de prueba.\n\n' +
      '¿Continuar?'
    )
    if (!confirmar) return

    setEstado('loading')
    setMsg('')
    try {
      const res = await fetch(`${API}/api/debug/reset-db`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      if (res.ok) {
        setEstado('ok')
        setMsg('Base de datos reiniciada. Recargá la página para ver los datos frescos.')
      } else {
        setEstado('error')
        setMsg(data.message || 'Error desconocido en el servidor.')
      }
    } catch (err) {
      setEstado('error')
      setMsg('No se pudo conectar con el backend.')
    }
  }

  const colorBorde = estado === 'ok'    ? 'rgba(34,197,94,0.4)'
                   : estado === 'error' ? 'rgba(229,72,77,0.4)'
                   : 'rgba(255,195,0,0.25)'

  const colorFondo = estado === 'ok'    ? 'rgba(34,197,94,0.06)'
                   : estado === 'error' ? 'rgba(229,72,77,0.06)'
                   : 'rgba(255,195,0,0.04)'

  return (
    <div style={{
      border: `1px dashed ${colorBorde}`,
      borderRadius: 'var(--radius-lg)',
      backgroundColor: colorFondo,
      padding: '0.85rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      {/* Texto descriptivo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--yellow-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          DEBUG — Solo desarrollo
        </span>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)' }}>
          Rellenar base de datos con datos inorgánicos de órdenes, clientes, vehículos, pagos y personal
        </span>
        {msg && (
          <span style={{
            fontSize: 'var(--text-xs)',
            color: estado === 'ok' ? '#22c55e' : 'var(--danger)',
            marginTop: '0.15rem',
          }}>
            {estado === 'ok' ? '✓ ' : '✗ '}{msg}
          </span>
        )}
      </div>

      {/* Botón */}
      <button
        onClick={handleReset}
        disabled={estado === 'loading'}
        style={{
          backgroundColor: estado === 'loading' ? 'var(--surface-raised)' : 'rgba(255,195,0,0.12)',
          color: estado === 'loading' ? 'var(--neutral-400)' : 'var(--yellow-400)',
          border: `1px solid ${estado === 'loading' ? 'var(--border)' : 'rgba(255,195,0,0.35)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 1rem',
          fontSize: 'var(--text-small)',
          fontWeight: 'var(--weight-medium)',
          cursor: estado === 'loading' ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (estado !== 'loading') e.currentTarget.style.backgroundColor = 'rgba(255,195,0,0.2)' }}
        onMouseLeave={e => { if (estado !== 'loading') e.currentTarget.style.backgroundColor = 'rgba(255,195,0,0.12)' }}
      >
        {estado === 'loading' ? 'Reiniciando…' : '⟳  Rellenar'}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [metricas,   setMetricas]   = useState(null)
  const [breakdown,  setBreakdown]  = useState(null)
  const [recientes,  setRecientes]  = useState(null)
  const [cobros,     setCobros]     = useState(null)
  const [stockBajo,  setStockBajo]  = useState(null)
  const [liquidPend, setLiquidPend] = useState(null)
  const [errores,    setErrores]    = useState({})

  async function get(endpoint) {
    const res = await fetch(`${API}${endpoint}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }
  async function cargar(key, fn, setter) {
    try { setter(await fn()) } catch { setErrores(prev => ({ ...prev, [key]: true })) }
  }

  useEffect(() => {
    cargar('metricas',   () => get('/api/dashboard/metricas'),                setMetricas)
    cargar('breakdown',  () => get('/api/dashboard/breakdown-estados'),        setBreakdown)
    cargar('recientes',  () => get('/api/dashboard/ordenes-recientes'),        setRecientes)
    cargar('cobros',     () => get('/api/dashboard/cobros-pendientes'),        setCobros)
    cargar('stockBajo',  () => get('/api/dashboard/stock-bajo'),               setStockBajo)
    cargar('liquidPend', () => get('/api/dashboard/liquidaciones-pendientes'), setLiquidPend)
  }, [])

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* ── DEBUG BANNER ───────────────────────────────────────────────── */}
        <DebugResetBanner />

        {/* encabezado */}
        <div style={s.header}>
          <div>
            <span style={s.eyebrow}>Sistema de gestión</span>
            <h1 style={s.titulo}>Taller <span style={s.accent}>Pedro Espinoza</span></h1>
          </div>
          <button onClick={() => navigate('/ordenes/nueva')} style={s.btnPrimario}>+ Nueva orden</button>
        </div>

        {/* ── ACCESOS RÁPIDOS ────────────────────────────────────────────── */}
        <section style={s.seccion}>
          <SeccionTitulo>Accesos rápidos</SeccionTitulo>
          <div style={s.grid4}>
            <button style={s.btnAcceso} onClick={() => navigate('/ordenes/nueva')}>+ Nueva orden</button>
            <button style={s.btnAcceso} onClick={() => navigate('/ordenes')}>Ver órdenes</button>
            <button style={{ ...s.btnAcceso, ...s.btnAccesoDisabled }} disabled title="Disponible próximamente">Inventario</button>
            <button style={{ ...s.btnAcceso, ...s.btnAccesoDisabled }} disabled title="Disponible próximamente">Liquidaciones</button>
            <button style={{ ...s.btnAcceso, ...s.btnAccesoDisabled }} disabled title="Disponible próximamente">Contabilidad</button>
            <button style={{ ...s.btnAcceso, ...s.btnAccesoDisabled }} disabled title="Disponible próximamente">Linker LAFISE</button>
            <button style={{ ...s.btnAcceso, ...s.btnAccesoDisabled }} disabled title="Disponible próximamente">Ajustes</button>
          </div>
        </section>

        {/* ── MÉTRICAS ───────────────────────────────────────────────────── */}
        <section style={s.seccion}>
          <SeccionTitulo>Resumen del día</SeccionTitulo>
          <div style={s.grid4}>
            <CardMetrica label="Órdenes activas"         valor={metricas?.activas}           sub="en proceso o recibidas"  accent onClick={() => navigate('/ordenes')} />
            <CardMetrica label="Listas para entregar"    valor={metricas?.listas}            sub="esperando al cliente"          onClick={() => navigate('/ordenes')} />
            <CardMetrica label="Recibidas hoy"           valor={metricas?.hoy}               sub="ingresadas en el día"          onClick={() => navigate('/ordenes')} />
            <CardMetrica label="Cobros aseg. pendientes" valor={metricas?.cobros_pendientes != null ? `C$ ${fmt(metricas.cobros_pendientes)}` : null} sub="monto total sin recibir" />
          </div>
          {errores.metricas && <Alerta texto="No se pudieron cargar las métricas." />}
        </section>

        {/* ── ESTADO DEL TALLER ──────────────────────────────────────────── */}
        <section style={s.seccion}>
          <SeccionTitulo>Estado del taller</SeccionTitulo>
          <div style={s.grid5}>
            {breakdown
              ? Object.entries(ESTADO_STYLES).map(([estado, st]) => {
                  const count = breakdown[estado] ?? 0
                  return (
                    <div key={estado} onClick={() => navigate('/ordenes')}
                      style={{ backgroundColor: st.bg, border: `1px solid ${st.border}`, borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      <span style={{ fontSize: '1.6rem', fontWeight: 'var(--weight-bold)', color: st.color }}>{count}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: st.color, textTransform: 'capitalize' }}>{estado.replace('_', ' ')}</span>
                    </div>
                  )
                })
              : <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-small)' }}>Cargando…</span>
            }
          </div>
          {errores.breakdown && <Alerta texto="No se pudo cargar el estado del taller." />}
        </section>

        {/* ── ÓRDENES RECIENTES ──────────────────────────────────────────── */}
        <section style={s.seccion}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SeccionTitulo>Órdenes activas recientes</SeccionTitulo>
            <button onClick={() => navigate('/ordenes')} style={s.btnLink}>Ver todas →</button>
          </div>
          {recientes === null && !errores.recientes && <p style={s.cargando}>Cargando…</p>}
          {errores.recientes && <Alerta texto="No se pudieron cargar las órdenes recientes." />}
          {recientes?.length === 0 && <div style={s.vacio}><p style={s.vacioTexto}>No hay órdenes activas actualmente.</p></div>}
          {recientes?.length > 0 && (
            <div style={s.tabla}>
              <div style={s.tablaHeader}>
                <span>Matrícula</span><span>Cliente</span><span>Tipo</span><span>Estado</span><span>Ingreso</span><span>Entrega est.</span><span></span>
              </div>
              {recientes.map(o => (
                <div key={o.id} style={s.tablaFila}>
                  <span style={s.matricula}>{o.matricula}</span>
                  <span style={s.clienteNombre}>{o.nombre_cliente}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)', textTransform: 'capitalize' }}>{o.tipo}</span>
                  <BadgeEstado estado={o.estado} />
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)' }}>{fmtFecha(o.fecha_ingreso)}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)' }}>{fmtFecha(o.fecha_entrega_estimada)}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button style={s.btnTabla} onClick={() => navigate(`/ordenes/${o.id}/operaciones`)}>Operaciones</button>
                    <button style={{ ...s.btnTabla, ...s.btnTablaAmarillo }} onClick={() => navigate(`/ordenes/${o.id}/pago`)}>Pago</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── COBROS PENDIENTES ──────────────────────────────────────────── */}
        <section style={s.seccion}>
          <SeccionTitulo>Cobros pendientes — Aseguradoras</SeccionTitulo>
          {cobros === null && !errores.cobros && <p style={s.cargando}>Cargando…</p>}
          {errores.cobros && <Alerta texto="No se pudieron cargar los cobros pendientes." />}
          {cobros?.length === 0 && <div style={s.vacio}><p style={s.vacioTexto}>No hay cobros pendientes de aseguradoras.</p></div>}
          {cobros?.length > 0 && (
            <div style={s.tabla}>
              <div style={{ ...s.tablaHeader, gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                <span>Matrícula</span><span>Aseguradora</span><span>Concepto</span><span>Monto</span><span>Fecha esperada</span>
              </div>
              {cobros.map(c => (
                <div key={c.id} style={{ ...s.tablaFila, gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                  <span style={s.matricula}>{c.matricula}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-200)', textTransform: 'uppercase' }}>{c.tipo_pago}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)', textTransform: 'capitalize' }}>{c.concepto.replace('_', ' ')}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-medium)' }}>C$ {fmt(c.monto)}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)' }}>{fmtFecha(c.fecha_esperada)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── STOCK BAJO ─────────────────────────────────────────────────── */}
        <section style={s.seccion}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SeccionTitulo>Materiales con stock bajo</SeccionTitulo>
            <span style={s.chipDisabled}>Inventario — disponible próximamente</span>
          </div>
          {stockBajo === null && !errores.stockBajo && <p style={s.cargando}>Cargando…</p>}
          {errores.stockBajo && <Alerta texto="No se pudo cargar el inventario." />}
          {stockBajo?.length === 0 && <div style={s.vacio}><p style={s.vacioTexto}>Todos los materiales están sobre su stock mínimo.</p></div>}
          {stockBajo?.length > 0 && (
            <div style={s.gridStock}>
              {stockBajo.map(m => {
                const pct = m.stock_minimo > 0 ? Math.min((m.cantidad / m.stock_minimo) * 100, 100) : 100
                return (
                  <div key={m.id} style={s.cardStock}>
                    <span style={s.stockNombre}>{m.nombre}</span>
                    <div style={s.stockBarra}><div style={{ ...s.stockBarraFill, width: `${pct}%` }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={s.stockNum}><span style={{ color: 'var(--danger)', fontWeight: 'var(--weight-medium)' }}>{m.cantidad}</span>{' / '}{m.stock_minimo} {m.unidad_medida}</span>
                      {m.nombre_proveedor && <span style={s.stockProv}>{m.nombre_proveedor}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── LIQUIDACIONES PENDIENTES ───────────────────────────────────── */}
        <section style={s.seccion}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SeccionTitulo>Liquidaciones pendientes</SeccionTitulo>
            <span style={s.chipDisabled}>Liquidaciones — disponible próximamente</span>
          </div>
          {liquidPend === null && !errores.liquidPend && <p style={s.cargando}>Cargando…</p>}
          {errores.liquidPend && <Alerta texto="No se pudieron cargar las liquidaciones." />}
          {liquidPend?.length === 0 && <div style={s.vacio}><p style={s.vacioTexto}>No hay montos pendientes de liquidar.</p></div>}
          {liquidPend?.length > 0 && (
            <div style={s.tabla}>
              <div style={{ ...s.tablaHeader, gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <span>Personal</span><span>Rol</span><span>Órdenes sin liquidar</span><span>Total pendiente</span>
              </div>
              {liquidPend.map(p => (
                <div key={p.id_personal} style={{ ...s.tablaFila, gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                  <span style={s.clienteNombre}>{p.nombre}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-300)', textTransform: 'capitalize' }}>{p.rol}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--neutral-200)' }}>{p.ordenes_sin_liquidar}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--yellow-400)', fontWeight: 'var(--weight-medium)' }}>C$ {fmt(p.total_pendiente)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

const s = {
  page:              { minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' },
  container:         { width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2.5rem' },
  header:            { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' },
  eyebrow:           { display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--neutral-400)', letterSpacing: '0.12em', textTransform: 'uppercase' },
  titulo:            { fontSize: 'var(--text-title)', fontWeight: 'var(--weight-bold)', color: 'var(--foreground)', margin: 0, lineHeight: 1.1 },
  accent:            { color: 'var(--yellow-500)' },
  btnPrimario:       { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-body)', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer' },
  seccion:           { display: 'flex', flexDirection: 'column', gap: '1rem' },
  grid4:             { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' },
  grid5:             { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' },
  gridStock:         { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' },
  cargando:          { fontSize: 'var(--text-small)', color: 'var(--neutral-400)', margin: 0 },
  vacio:             { backgroundColor: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vacioTexto:        { fontSize: 'var(--text-body)', color: 'var(--neutral-400)', margin: 0 },
  btnLink:           { backgroundColor: 'transparent', color: 'var(--yellow-500)', fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', border: 'none', cursor: 'pointer', padding: 0 },
  chipDisabled:      { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '0.2rem 0.65rem' },
  tabla:             { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  tablaHeader:       { display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.65rem 1.25rem', backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', fontSize: 'var(--text-xs)', color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  tablaFila:         { display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr 1fr 1fr', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  matricula:         { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--yellow-400)' },
  clienteNombre:     { fontSize: 'var(--text-small)', color: 'var(--foreground)', fontWeight: 'var(--weight-medium)' },
  btnTabla:          { backgroundColor: 'var(--surface-raised)', color: 'var(--neutral-200)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnTablaAmarillo:  { backgroundColor: 'var(--yellow-500)', color: 'var(--background)', border: 'none' },
  cardStock:         { backgroundColor: 'var(--surface)', border: '1px solid rgba(229,72,77,0.25)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  stockNombre:       { fontSize: 'var(--text-small)', fontWeight: 'var(--weight-medium)', color: 'var(--foreground)' },
  stockBarra:        { height: '4px', backgroundColor: 'var(--surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' },
  stockBarraFill:    { height: '100%', backgroundColor: 'var(--danger)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' },
  stockNum:          { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  stockProv:         { fontSize: 'var(--text-xs)', color: 'var(--neutral-400)' },
  btnAcceso:         { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 'var(--text-body)', fontWeight: 'var(--weight-medium)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'border-color 0.15s' },
  btnAccesoDisabled: { opacity: 0.4, cursor: 'not-allowed' },
}