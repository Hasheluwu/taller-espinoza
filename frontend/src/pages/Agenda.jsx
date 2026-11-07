import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { localDateTime } from '../lib/date'
import { workshopApi } from '../lib/workshopApi'
import { Field, Panel, Notice } from '../components/WorkshopUI'
import { appointmentReason } from '../lib/agenda'
import { weekDays, weekStart, shiftDate } from '../lib/week'

const STATES = { programada: 'Programada', completada: 'Completada', cancelada: 'Cancelada' }
const ORDER_STATES = { recibido: 'Recibido', en_proceso: 'En proceso', listo: 'Listo para entregar' }
const at = day => new Date(`${day}T12:00:00`)
const dayName = (day, options) => at(day).toLocaleDateString('es-NI', options)
const longDay = day => { const text = dayName(day, { weekday: 'long', day: 'numeric', month: 'long' }); return text.charAt(0).toUpperCase() + text.slice(1) }
function weekLabel(first, last) {
  const a = at(first), b = at(last)
  const month = d => d.toLocaleDateString('es-NI', { month: 'long' })
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} de ${month(b)} de ${b.getFullYear()}`
    : `${a.getDate()} de ${month(a)} – ${b.getDate()} de ${month(b)} de ${b.getFullYear()}`
}
const hours = c => `${c.inicio.slice(11, 16)} – ${c.fin.slice(0, 10) === c.inicio.slice(0, 10) ? c.fin.slice(11, 16) : `${dayName(c.fin.slice(0, 10), { day: 'numeric', month: 'short' })} ${c.fin.slice(11, 16)}`}`
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Appointment({ c, day, onOpen }) {
  const starts = c.inicio.slice(0, 10) === day
  return <button type="button" className={`agenda-item is-${c.estado}`} onClick={() => onOpen(c)}>
    <span className="agenda-item-time">{starts ? hours(c) : 'Continúa'}</span>
    <strong>{c.matricula}</strong>
    <span className="agenda-item-text">{appointmentReason(c.motivo) || 'Sin motivo registrado'}</span>
    <span className="agenda-item-meta">{c.cliente}{c.estado !== 'programada' && <em>{STATES[c.estado]}</em>}</span>
  </button>
}
function Delivery({ o, late = false }) {
  return <Link className={`agenda-item is-delivery ${late ? 'is-late' : ''}`} to={`/ordenes/${o.id}/expediente`}>
    <span className="agenda-item-time">{late ? `Prometida ${dayName(o.fecha_entrega_estimada, { day: 'numeric', month: 'short' })}` : 'Entrega prevista'}</span>
    <strong>{o.matricula}</strong>
    <span className="agenda-item-text">Orden #{o.id} · {ORDER_STATES[o.estado] || o.estado}</span>
    <span className="agenda-item-meta">{o.cliente}</span>
  </Link>
}

export default function Agenda() {
  const today = localDateTime().slice(0, 10)
  const [week, setWeek] = useState(() => weekStart(today))
  const [data, setData] = useState({ citas: [], entregas: [], atrasadas: [] }), [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({ id_vehiculo: '', inicio: `${today}T08:00`, fin: `${today}T09:00`, motivo: '' })
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [showForm, setShowForm] = useState(false), [selected, setSelected] = useState(null)
  const [view, setView] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760 ? 'lista' : 'semana')
  const request = useRef(0)
  const days = weekDays(week)
  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true); setError('')
    try { const next = await workshopApi(`/api/taller/agenda?${new URLSearchParams({ desde: week, hasta: shiftDate(week, 6) })}`); if (id === request.current) setData({ atrasadas: [], ...next }) }
    catch (e) { if (id === request.current) { setError(e.message); setData({ citas: [], entregas: [], atrasadas: [] }) } }
    finally { if (id === request.current) setLoading(false) }
  }, [week])
  useDeferredLoad(load)
  const vehicleLoad = useCallback(async () => { try { setVehicles(await workshopApi('/api/taller/vehiculos')) } catch (e) { setError(e.message) } }, [])
  useDeferredLoad(vehicleLoad)
  const moveWeek = next => { if (next === week) { load(); return } ++request.current; setWeek(next); setSelected(null); setData({ citas: [], entregas: [], atrasadas: [] }); setLoading(true) }
  async function save(e) {
    e.preventDefault(); if (busy) return
    if (!appointmentReason(form.motivo)) { setError('Escribe el motivo de la cita.'); return }
    if (form.fin <= form.inicio) { setError('La cita debe terminar después de su inicio.'); return }
    setBusy(true); setError(''); setMessage('')
    try { await workshopApi('/api/taller/agenda', 'POST', form); const next = weekStart(form.inicio.slice(0, 10)); setMessage('Cita programada.'); setShowForm(false); if (next === week) await load(); else moveWeek(next) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function status(id, estado) {
    if (busy) return
    setBusy(true); setError('')
    try { await workshopApi(`/api/taller/agenda/${id}`, 'PATCH', { estado }); setSelected(null); setMessage(estado === 'completada' ? 'Cita completada.' : 'Cita cancelada.'); await load() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const change = e => setForm({ ...form, [e.target.name]: e.target.value })
  useEffect(() => {
    if (!selected) return
    const close = e => { if (e.key === 'Escape' && !busy) setSelected(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected, busy])

  const citasDe = day => data.citas.filter(c => c.inicio.slice(0, 10) <= day && c.fin.slice(0, 10) >= day)
  const entregasDe = day => data.entregas.filter(o => String(o.fecha_entrega_estimada).slice(0, 10) === day)
  const inWeek = days.includes(today)
  const programadas = data.citas.filter(c => c.estado === 'programada')
  const summary = [
    ['Citas de hoy', inWeek ? citasDe(today).filter(c => c.estado === 'programada').length : '—', inWeek ? 'Vehículos por recibir' : 'Ve a esta semana'],
    ['Entregas de hoy', inWeek ? entregasDe(today).length : '—', inWeek ? 'Prometidas al cliente' : 'Ve a esta semana'],
    ['En esta semana', programadas.length + data.entregas.length, `${plural(programadas.length, 'cita', 'citas')} · ${plural(data.entregas.length, 'entrega', 'entregas')}`],
    ['Entregas atrasadas', data.atrasadas.length, data.atrasadas.length ? 'Revisa la fecha o entrega' : 'Todo al día'],
  ]

  return <div className="work-page agenda-page">
    <header className="section-heading"><div><span className="section-kicker">PLANIFICACIÓN / TALLER</span><h1>Agenda y entregas</h1><p className="work-muted">Citas para recibir vehículos y entregas prometidas a los clientes.</p></div><button className="btn-cyber-orange" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>{showForm ? 'Cerrar formulario' : '+ Nueva cita'}</button></header>
    <Notice error={error} message={message}/>

    <div className="agenda-summary">{summary.map(([title, value, detail], i) => <div key={title} className={i === 3 && data.atrasadas.length ? 'is-alert' : ''}><span>{title}</span><strong>{loading ? '…' : value}</strong><small>{detail}</small></div>)}</div>

    {!loading && data.atrasadas.length > 0 && <section className="agenda-late" aria-label="Entregas atrasadas">
      <h2>Entregas atrasadas</h2><p>La fecha prometida ya pasó y el vehículo sigue en el taller. Abre la orden para entregarlo o cambiar la fecha.</p>
      <div className="agenda-late-list">{data.atrasadas.map(o => <Delivery key={o.id} o={o} late/>)}</div>
    </section>}

    {showForm && <Panel title="Programar una cita"><form className="work-page" onSubmit={save}>
      <Field label="Vehículo registrado"><select required name="id_vehiculo" value={form.id_vehiculo} onChange={change}><option value="">Seleccionar vehículo</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.matricula} · {v.cliente}</option>)}</select></Field>
      <div className="work-grid">{['inicio', 'fin'].map(k => <Field key={k} label={k === 'inicio' ? 'Inicio' : 'Fin'}><input required type="datetime-local" name={k} value={form[k]} onChange={change}/></Field>)}</div>
      <Field label="Motivo"><input required maxLength="500" name="motivo" value={form.motivo} onChange={change} placeholder="Ej. Revisión de frenos, recepción por reclamo INISER…"/></Field>
      <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cita'}</button>
    </form></Panel>}

    <div className="agenda-toolbar">
      <div className="agenda-nav"><button disabled={busy} aria-label="Semana anterior" onClick={() => moveWeek(shiftDate(week, -7))}>←</button><button disabled={busy || inWeek} onClick={() => moveWeek(weekStart(today))}>Esta semana</button><button disabled={busy} aria-label="Semana siguiente" onClick={() => moveWeek(shiftDate(week, 7))}>→</button></div>
      <strong className="agenda-range">{weekLabel(days[0], days[6])}</strong>
      <div className="agenda-view" role="group" aria-label="Vista">{[['semana', 'Semana'], ['lista', 'Lista']].map(([key, text]) => <button key={key} aria-pressed={view === key} className={view === key ? 'is-on' : ''} onClick={() => setView(key)}>{text}</button>)}</div>
    </div>
    <ul className="agenda-legend" aria-label="Leyenda"><li className="is-programada">Cita programada</li><li className="is-delivery">Entrega prevista</li><li className="is-completada">Cita completada</li><li className="is-cancelada">Cita cancelada</li></ul>

    {loading ? <p role="status">Cargando semana…</p> : error ? <button onClick={load}>Reintentar carga de agenda</button>
      : view === 'semana' ? <div className="agenda-week">{days.map(day => {
        const citas = citasDe(day), entregas = entregasDe(day)
        return <section className={`agenda-day ${day === today ? 'is-today' : ''} ${day < today ? 'is-past' : ''}`} key={day} aria-label={longDay(day)}>
          <header><span>{dayName(day, { weekday: 'short' })}</span><strong>{Number(day.slice(8))}</strong>{day === today && <em>Hoy</em>}</header>
          <div className="agenda-day-items">{entregas.map(o => <Delivery key={`e${o.id}`} o={o}/>)}{citas.map(c => <Appointment key={c.id} c={c} day={day} onOpen={setSelected}/>)}{!citas.length && !entregas.length && <p className="agenda-empty">Libre</p>}</div>
        </section>
      })}</div>
      : <div className="agenda-list">{days.filter(day => citasDe(day).length || entregasDe(day).length).map(day => <section key={day} className={day === today ? 'is-today' : ''}>
        <h3>{longDay(day)}{day === today && <em>Hoy</em>}</h3>
        <div className="agenda-list-items">{entregasDe(day).map(o => <Delivery key={`e${o.id}`} o={o}/>)}{citasDe(day).map(c => <Appointment key={c.id} c={c} day={day} onOpen={setSelected}/>)}</div>
      </section>)}{!data.citas.length && !data.entregas.length && <p className="agenda-empty">No hay citas ni entregas esta semana.</p>}</div>}

    {selected && <div className="agenda-dialog-backdrop" onClick={() => !busy && setSelected(null)}><div className="agenda-dialog" role="dialog" aria-modal="true" aria-labelledby="agenda-dialog-title" onClick={e => e.stopPropagation()}>
      <span className={`agenda-chip is-${selected.estado}`}>{STATES[selected.estado]}</span>
      <h2 id="agenda-dialog-title">{selected.matricula}</h2>
      <p className="agenda-dialog-sub">{selected.cliente}{selected.marca ? ` · ${selected.marca} ${selected.modelo || ''}` : ''}</p>
      <dl><div><dt>Fecha</dt><dd>{longDay(selected.inicio.slice(0, 10))}</dd></div><div><dt>Horario</dt><dd>{hours(selected)}</dd></div><div><dt>Motivo</dt><dd>{appointmentReason(selected.motivo) || 'Sin motivo registrado'}</dd></div></dl>
      <div className="work-row">{selected.estado === 'programada' && <><button className="btn-cyber-orange" disabled={busy} onClick={() => status(selected.id, 'completada')}>Marcar como completada</button><button disabled={busy} onClick={() => status(selected.id, 'cancelada')}>Cancelar cita</button></>}<button disabled={busy} onClick={() => setSelected(null)} autoFocus>Cerrar</button></div>
    </div></div>}
  </div>
}
