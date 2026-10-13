import { useCallback, useState } from 'react'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi } from '../lib/workshopApi'
import { Field, Panel, Notice } from './WorkshopUI'
export default function UseMaterial({ product, onClose, onSaved }) {
  const [orders,setOrders]=useState([]), [people,setPeople]=useState([])
  const [form,setForm]=useState({id_orden:'',id_personal:'',cantidad_usada:'1',nota:''})
  const [error,setError]=useState(''),[busy,setBusy]=useState(false)
  const load=useCallback(async()=>{try{const [o,p]=await Promise.all([workshopApi('/api/ordenes?solo_activas=true'),workshopApi('/api/operaciones/personal/lista')]);setOrders(o.filter(x=>['recibido','en_proceso'].includes(x.estado)));setPeople(p)}catch(e){setError(e.message)}},[])
  useDeferredLoad(load)
  const change=e=>setForm({...form,[e.target.name]:e.target.value})
  async function save(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await workshopApi(`/api/operaciones/${form.id_orden}/materiales`,'POST',{...form,id_material:product.id});onSaved();onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div className="work-overlay"><div className="work-dialog" role="dialog" aria-modal="true" aria-label="Usar producto"><Panel title={`Usar ${product.nombre}`}><p>Disponible: {product.cantidad} {product.unidad_medida}. El consumo se descuenta del stock y se añade a los materiales de la orden.</p><Notice error={error}/><form onSubmit={save} className="work-page"><Field label="Orden de trabajo"><select required name="id_orden" value={form.id_orden} onChange={change}><option value="">Seleccionar orden</option>{orders.map(o=><option key={o.id} value={o.id}>#{o.id} · {o.matricula} · {o.nombre_cliente}</option>)}</select></Field><Field label={`Cantidad en ${product.unidad_medida}`}><input required name="cantidad_usada" type="number" min="0.01" max={product.cantidad} step="0.01" value={form.cantidad_usada} onChange={change}/></Field><Field label="Trabajador responsable"><select required name="id_personal" value={form.id_personal} onChange={change}><option value="">Seleccionar trabajador</option>{people.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field><Field label="Trabajo o motivo"><input name="nota" maxLength="500" value={form.nota} onChange={change}/></Field><p className="work-muted">Este registro no añade otro pago al trabajador. Su monto acordado se asigna en Operaciones.</p><div className="work-row"><button type="submit" disabled={busy}>{busy?'Registrando…':'Confirmar consumo'}</button><button type="button" disabled={busy} onClick={onClose}>Cerrar</button></div></form></Panel></div></div>
}
