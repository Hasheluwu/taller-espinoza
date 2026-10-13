import {useState} from 'react'
import {workshopApi} from '../lib/workshopApi'
import {Field,Notice} from './WorkshopUI'
function isAdmin(){try{return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).rol==='administrador'}catch{return false}}
export function InsuranceExcess({value,onChange}){
 if(!isAdmin())return null
 return <div style={{display:'grid',gap:8,width:'100%'}}><label><input type="checkbox" checked={!!value.confirmar_excedente} onChange={e=>onChange({...value,confirmar_excedente:e.target.checked})}/> Confirmar un importe mayor y registrar excedente por conciliar</label>{value.confirmar_excedente && <><p>El excedente queda separado del saldo de la reparación. No incrementa la venta ni la ganancia. Revisa el comprobante antes de confirmar.</p><Field label="Justificación del excedente"><input required minLength="5" maxLength="500" value={value.motivo_excedente || ''} onChange={e=>onChange({...value,motivo_excedente:e.target.value})}/></Field></>}</div>
}
export function InsuranceCorrection({payment,onSaved}){
 const [open,setOpen]=useState(false),[amount,setAmount]=useState(payment.monto),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 if(!isAdmin() || payment.estado!=='pendiente')return null
 async function save(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const data=await workshopApi(`/api/pagos/seguro/${payment.id}/pendiente`,'PUT',{monto:amount,motivo:reason});onSaved(data);setOpen(false)}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div style={{width:'100%'}}><button onClick={()=>setOpen(!open)} className="work-link">{open?'Cerrar corrección':'Corregir importe pendiente'}</button>{open&&<form className="work-panel" onSubmit={save}><p>Usa esta opción solo si el importe esperado estaba mal registrado. Los pagos recibidos permanecen intactos.</p><Field label="Importe correcto (C$)"><input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field label="Motivo de la corrección"><input required minLength="5" maxLength="500" value={reason} onChange={e=>setReason(e.target.value)}/></Field><Notice error={error}/><button type="submit" disabled={busy}>Guardar corrección</button></form>}</div>
}
