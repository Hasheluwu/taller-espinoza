// Isolated manual fixture; every request stays in memory.
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route,Link} from 'react-router-dom'
import {useState} from 'react'
import UseMaterial from '../src/components/UseMaterial'
import Historial from '../src/pages/Historial'
import Agenda from '../src/pages/Agenda'
import Expediente from '../src/pages/Expediente'
import '../src/index.css'
const vehicle={id:1,matricula:'PRUEBA-01',marca:'Kia',modelo:'Sportage',cliente:'Cliente simulado'}
const order={id:1,id_vehiculo:1,matricula:vehicle.matricula,nombre_cliente:vehicle.cliente,estado:'en_proceso',tipo:'mecanica',fecha_ingreso:'2026-10-06',fecha_entrega_estimada:'2026-10-12',costo_total:23000,servicios:[{descripcion:'Revisión de frenos'}],materiales:[]}
let stock=2
const appointments=[], photos=[]
window.fetch=async(url,options={})=>{
 const path=new URL(url,location.origin).pathname,body=options.body?JSON.parse(options.body):{}
 let data
 if(path==='/api/taller/vehiculos')data=[vehicle]
 else if(path==='/api/ordenes')data=[order]
 else if(path==='/api/ordenes/1')data=order
 else if(path==='/api/operaciones/personal/lista')data=[{id:1,nombre:'Trabajador de prueba'}]
 else if(path==='/api/operaciones/1/materiales'){stock-=Number(body.cantidad_usada);order.materiales.push({nombre:'Líquido de frenos',cantidad_usada:body.cantidad_usada,unidad_medida:'litro'});data={id:1}}
 else if(path==='/api/taller/vehiculos/1/historial')data=[order]
 else if(path==='/api/taller/agenda'){if(options.method==='POST'){appointments.push({...body,id:appointments.length+1,matricula:vehicle.matricula,estado:'programada'});data={id:appointments.length}}else data={citas:appointments,entregas:[{...order}]}}
 else if(path.startsWith('/api/taller/agenda/')){appointments.find(c=>c.id===Number(path.split('/').at(-1))).estado=body.estado;data={}}
 else if(path==='/api/taller/ordenes/1/fotos'){if(options.method==='POST'){photos.push({id:photos.length+1,...body,fecha:'2026-10-06'});data={id:photos.length}}else data=photos}
 else if(path.startsWith('/api/taller/fotos/')){const p=photos.find(p=>p.id===Number(path.split('/').at(-1)));const bytes=Uint8Array.from(atob(p.imagen.split(',')[1]),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':'image/png'}})}
 else if(path==='/api/taller/ordenes/1/costos')data={ingreso_sin_iva:20000,mano_obra:5000,costos:null,costo_total:null,ganancia:null}
 else if(path==='/api/taller/ordenes/1/entrega'){order.fecha_entrega_estimada=body.fecha;data={}}
 else throw new Error('Ruta fuera de la prueba aislada: '+path)
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})
}
export default function Stock(){const [open,setOpen]=useState(false),[quantity,setQuantity]=useState(stock);return <div className="work-page"><h1>Inventario · prueba</h1><p>Disponible: {quantity} litros</p><button onClick={()=>setOpen(true)}>Usar líquido de frenos</button>{open&&<UseMaterial product={{id:1,nombre:'Líquido de frenos',cantidad:quantity,unidad_medida:'litro'}} onClose={()=>setOpen(false)} onSaved={()=>setQuantity(stock)}/>}</div>}
createRoot(document.getElementById('root')).render(<><p style={{background:'#513520',padding:12}}>PRUEBA AISLADA · datos simulados · no modifica MySQL</p><MemoryRouter><nav className="work-row" style={{padding:24}}><Link to="/">Stock</Link><Link to="/historial">Historial</Link><Link to="/agenda">Agenda</Link><Link to="/ordenes/1/expediente">Fotos y costos</Link></nav><div style={{padding:24}}><Routes><Route path="/" element={<Stock/>}/><Route path="/historial" element={<Historial/>}/><Route path="/agenda" element={<Agenda/>}/><Route path="/ordenes/:id/expediente" element={<Expediente/>}/></Routes></div></MemoryRouter></>)
