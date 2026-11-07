import { useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi as api, currency } from '../lib/workshopApi'
import WizardSteps from '../components/WizardSteps'
import '../proformas.css'
export default function IngresarOrdenPresupuesto() {
  const { state } = useLocation(),navigate=useNavigate()
  const cliente=state?.cliente,vehiculo=state?.vehiculo
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useDeferredLoad(useCallback(()=>{if(vehiculo)api(`/api/proformas?id_vehiculo=${vehiculo.id}&fase=aprobada&disponibles_para_orden=true`).then(d=>setRows(d.rows)).catch(e=>setError(e.message))},[vehiculo]))
  async function select(id){setBusy(true);try{const p=await api(`/api/proformas/${id}`);navigate('/ordenes/nueva/orden',{state:{cliente,vehiculo,presupuesto:p}})}catch(e){setError(e.message)}finally{setBusy(false)}}
  if(!vehiculo || !cliente)return <div className="pf-empty"><p>Selecciona el cliente y el vehículo para continuar.</p><Link className="pf-primary" to="/ordenes/nueva">Nueva orden</Link></div>
  return <div className="pf-page"><WizardSteps currentStep={3}/><div className="pf-heading"><div><span className="pf-eyebrow">PASO 03 · PRESUPUESTO</span><h1>Preparar el ingreso al taller.</h1><p>{cliente.nombre} · {vehiculo.matricula}</p></div><Link className="pf-primary" to="/proformas/nueva" state={{cliente,vehiculo}}>＋ Crear proforma</Link></div>{error && <p className="pf-error" role="alert">{error}</p>}<section className="pf-panel"><h2>¿El cliente viene solo a cotizar?</h2><p>Para INISER registra el reclamo que trae el cliente; para LAFISE, su trámite. Emite la proforma para presentarla a la aseguradora. La orden de trabajo se registra después de la aprobación.</p><Link className="pf-primary" to="/proformas/nueva" state={{cliente,vehiculo}}>Solo cotizar: crear proforma →</Link></section><section className="pf-panel"><h2>¿Ya regresó con la aprobación?</h2><p>Selecciona una para trasladar sus cargos a la orden. El mismo documento permanece en el historial.</p><div className="pf-reservations">{rows.filter(p=>!p.id_orden).map(p=><button disabled={busy} className="pf-secondary" key={p.id} onClick={()=>select(p.id)}>N° {p.numero} · {currency(p.total)} →</button>)}</div>{!rows.some(p=>!p.id_orden) && <p className="pf-empty">Todavía no hay una proforma aprobada disponible.</p>}<Link className="pf-text-link" to="/cotizaciones">Consultar cotizaciones pendientes →</Link></section><section className="pf-panel"><h2>¿El vehículo ingresa sin cotización previa?</h2><p>Puedes registrar la recepción y agregar los cargos desde Operaciones.</p><button className="pf-secondary" onClick={()=>navigate('/ordenes/nueva/orden',{state:{cliente,vehiculo}})}>Continuar sin proforma →</button></section></div>
}
