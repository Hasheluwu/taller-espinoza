import {useCallback,useState} from 'react'
import {Link} from 'react-router-dom'
import {useDeferredLoad} from '../hooks/useDeferredLoad'
import {workshopApi,currency} from '../lib/workshopApi'
import {Field,Panel,Notice} from '../components/WorkshopUI'
export default function Historial(){
 const [vehicles,setVehicles]=useState([]),[selected,setSelected]=useState(''),[orders,setOrders]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=useCallback(async()=>{try{setVehicles(await workshopApi('/api/taller/vehiculos'))}catch(e){setError(e.message)}},[]);useDeferredLoad(load)
 async function search(e){e.preventDefault();setBusy(true);setError('');setOrders([]);try{setOrders(await workshopApi(`/api/taller/vehiculos/${selected}/historial`))}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="work-page"><h1>Historial por vehículo</h1><Panel title="Consultar reparaciones"><form onSubmit={search} className="work-row"><Field label="Vehículo"><select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccionar matrícula</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.matricula} · {v.marca} {v.modelo} · {v.cliente}</option>)}</select></Field><button disabled={busy} type="submit">{busy?'Buscando…':'Consultar'}</button></form><Notice error={error}/>{!orders.length && <p>Selecciona un vehículo para consultar sus órdenes registradas.</p>}{orders.map(o=><article className="work-item" key={o.id}><h3>Orden #{o.id} · {o.tipo} · {o.estado}</h3><p>{String(o.fecha_ingreso).slice(0,10)} · Total {currency(o.costo_total)}{o.es_garantia?' · Garantía':''}</p><p>Servicios: {o.servicios.map(s=>s.descripcion).join(', ') || 'Sin servicios registrados'}</p><p>Materiales: {o.materiales.map(m=>`${m.nombre} (${m.cantidad_usada} ${m.unidad_medida})`).join(', ') || 'Sin materiales'}</p><div className="work-row"><Link className="work-link" to={`/ordenes/${o.id}/operaciones`}>Operaciones</Link><Link className="work-link" to={`/ordenes/${o.id}/expediente`}>Fotos y costos</Link><Link className="work-link" to={`/ordenes/${o.id}/pago`}>Pagos</Link></div></article>)}</Panel></div>
}
