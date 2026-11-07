import { isExpired } from '../lib/date'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi } from '../lib/workshopApi'
import { ROLE_LABELS } from '../lib/workers'
import { Field, Panel, Notice } from './WorkshopUI'

// Uses a product for an order. Only workers of that order's team can be named as responsible.
export default function UseMaterial({ product, onClose, onSaved }) {
  const [orders, setOrders] = useState([]), [team, setTeam] = useState(null)
  const [form, setForm] = useState({ id_orden: '', id_personal: '', cantidad_usada: '1', nota: '' })
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const o = await workshopApi('/api/ordenes?solo_activas=true'); setOrders(o.filter(x => ['recibido', 'en_proceso'].includes(x.estado))) }
    catch (e) { setError(e.message) }
  }, [])
  useDeferredLoad(load)

  useEffect(() => {
    if (!form.id_orden) return
    let active = true
    workshopApi(`/api/operaciones/${form.id_orden}/personal`)
      .then(rows => { if (active) setTeam([...new Map(rows.map(m => [m.id_personal, m])).values()]) })
      .catch(e => { if (active) { setError(e.message); setTeam([]) } })
    return () => { active = false }
  }, [form.id_orden])

  const remaining = Math.round((Number(product.cantidad) - Number(form.cantidad_usada || 0)) * 100) / 100
  const expired = isExpired(product.fecha_expiracion)
  const validQuantity = !expired && Number(form.cantidad_usada) > 0 && remaining >= 0
  const noTeam = !!form.id_orden && team !== null && team.length === 0
  const change = e => setForm({ ...form, [e.target.name]: e.target.value })
  const chooseOrder = e => { setTeam(null); setError(''); setForm({ ...form, id_orden: e.target.value, id_personal: '' }) }
  async function save(e) {
    e.preventDefault(); if (busy || !validQuantity || noTeam) return
    setBusy(true); setError('')
    try { await workshopApi(`/api/operaciones/${form.id_orden}/materiales`, 'POST', { ...form, id_material: product.id }); onSaved(); onClose() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return <div className="work-overlay"><div className="work-dialog" role="dialog" aria-modal="true" aria-label="Usar producto"><Panel title={`Usar ${product.nombre}`}>
    <p>Disponible: {product.cantidad} {product.unidad_medida}. El consumo se descuenta del stock y se añade a los materiales de la orden.</p>
    <div className="consumption-preview" aria-live="polite"><div><span>Disponible</span><strong>{product.cantidad}</strong></div><span aria-hidden="true">→</span><div><span>Después del consumo</span><strong className={remaining < 0 ? 'quantity-invalid' : ''}>{Number.isFinite(remaining) ? remaining : '—'} <small>{product.unidad_medida}</small></strong></div></div>
    {remaining < 0 && <p role="alert" className="work-error">La cantidad supera el stock disponible.</p>}
    <Notice error={expired ? 'Este material está vencido. No se permite su consumo.' : error}/>
    <form onSubmit={save} className="work-page">
      <Field label="Orden de trabajo"><select required name="id_orden" value={form.id_orden} onChange={chooseOrder}><option value="">Seleccionar orden</option>{orders.map(o => <option key={o.id} value={o.id}>#{o.id} · {o.matricula} · {o.nombre_cliente}</option>)}</select></Field>
      {noTeam && <div className="team-warning" role="alert"><p>La orden #{form.id_orden} no tiene equipo asignado. Solo sus trabajadores pueden usar materiales.</p><Link to={`/ordenes/${form.id_orden}/operaciones?seccion=equipo`}>Asignar equipo →</Link></div>}
      <Field label={`Cantidad en ${product.unidad_medida}`}><input required name="cantidad_usada" type="number" min="0.01" max={product.cantidad} step="0.01" value={form.cantidad_usada} onChange={change}/></Field>
      <Field label="Trabajador del equipo de la orden"><select required name="id_personal" value={form.id_personal} onChange={change} disabled={!form.id_orden || !team?.length}>
        <option value="">{!form.id_orden ? 'Elige primero la orden' : team === null ? 'Cargando equipo…' : team.length ? 'Seleccionar trabajador' : 'Sin equipo asignado'}</option>
        {team?.map(m => <option key={m.id_personal} value={m.id_personal}>{m.nombre_personal} ({ROLE_LABELS[m.rol] || m.rol})</option>)}
      </select></Field>
      <Field label="Trabajo o motivo"><input name="nota" maxLength="500" value={form.nota} onChange={change}/></Field>
      <p className="work-muted">Este registro no añade otro pago al trabajador. Su monto acordado está en el equipo de la orden.</p>
      <div className="work-row"><button type="submit" disabled={busy || !validQuantity || noTeam || !team?.length}>{busy ? 'Registrando…' : 'Confirmar consumo'}</button><button type="button" disabled={busy} onClick={onClose}>Cerrar</button></div>
    </form>
  </Panel></div></div>
}
