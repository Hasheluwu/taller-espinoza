import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDeferredLoad } from '../hooks/useDeferredLoad'
import { workshopApi as api, currency } from '../lib/workshopApi'
import '../proformas.css'
const TABS = [['pendiente','Facturas pendientes','facturas_pendientes'],['pagada','Facturas pagadas','facturas_pagadas'],['sin_factura','Entregadas sin factura','sin_factura']]
const day = value => value ? String(value).slice(0,10).split('-').reverse().join('/') : '—'
export default function Facturas() {
  const [params,setParams]=useSearchParams()
  const estado=TABS.some(([key])=>key===params.get('estado')) ? params.get('estado') : 'pendiente'
  const setEstado=value=>setParams(value==='pendiente'?{}:{estado:value},{replace:true})
  const [query,setQuery]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const load=useCallback(async()=>{setLoading(true);try{setData(await api(`/api/facturas?estado=${estado}`));setError('')}catch(e){setError(e.message)}finally{setLoading(false)}},[estado])
  useDeferredLoad(load)
  const rows=data?.rows.filter(r=>`${r.cliente} ${r.matricula} ${r.aseguradora} ${r.id ?? ''} ${r.id_orden}`.toLowerCase().includes(query.toLowerCase())) || []
  const missing=estado==='sin_factura'
  return <div className="pf-page"><header className="pf-heading"><div><span className="pf-eyebrow">COBROS A ASEGURADORAS</span><h1>Facturas del seguro</h1><p>Cada vehículo del seguro entregado genera su factura. El total por cobrar baja cuando confirmas el pago de una factura.</p></div></header>
    <div className="pf-panel"><div className="pf-section-heading"><div><p>Por cobrar al seguro</p><h2>{data?currency(data.totals.pendiente):'—'}</h2><small className="pf-muted">{data ? `${data.totals.facturas_pendientes} ${data.totals.facturas_pendientes===1?'factura pendiente':'facturas pendientes'}` : ''}</small></div><div><p>Total de facturas pagadas</p><h2>{data?currency(data.totals.pagado):'—'}</h2><small className="pf-muted">{data ? `${data.totals.facturas_pagadas} ${data.totals.facturas_pagadas===1?'factura pagada':'facturas pagadas'}` : ''}</small></div></div>
      <div className="pf-actions">{TABS.map(([key,label,count])=><button key={key} className={estado===key?'pf-primary':'pf-secondary'} aria-pressed={estado===key} onClick={()=>setEstado(key)}>{label}{data ? ` · ${data.totals[count]}` : ''}</button>)}</div></div>
    <section className="pf-panel">{missing && <p className="pf-muted">Vehículos del seguro entregados antes de que la factura se generara al entregar. No suman al total por cobrar hasta que revises sus cargos y emitas la factura desde la orden.</p>}<label className="pf-field">Buscar factura, cliente, matrícula o seguro<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>{error && <p role="alert" className="pf-error">{error}</p>}
      {loading?<p role="status">Cargando facturas…</p>:!rows.length?<p className="pf-empty">{missing?'Todas las entregas del seguro tienen su factura.':`No hay facturas ${estado==='pendiente'?'pendientes':'pagadas'} para esta búsqueda.`}</p>:<div className="pf-table-scroll"><table className="pf-table">
        {missing ? <><thead><tr><th>Orden</th><th>Cliente / vehículo</th><th>Seguro</th><th>Parte del seguro</th><th>Entregado</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id_orden}><td>Orden #{r.id_orden}<small>Sin factura</small></td><td>{r.cliente}<small>{r.matricula}</small></td><td>{r.aseguradora.toUpperCase()}</td><td>{r.monto_seguro!=null?currency(r.monto_seguro):'—'}</td><td>{day(r.fecha_entrega_real)}</td><td><Link className="pf-open" to={`/ordenes/${r.id_orden}/pago`}>Revisar y emitir →</Link></td></tr>)}</tbody></>
        : <><thead><tr><th>Factura</th><th>Cliente / vehículo</th><th>Seguro</th><th>Total</th><th>{estado==='pendiente'?'Por cobrar':'Pagada el'}</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>FS-{String(r.id).padStart(6,'0')}<small>Orden #{r.id_orden} · {day(r.fecha_emision)}</small></td><td>{r.cliente}<small>{r.matricula}</small></td><td>{r.aseguradora.toUpperCase()}</td><td>{currency(r.total)}</td><td>{estado==='pendiente'?currency(r.saldo_inicial):r.fecha_pago?day(r.fecha_pago):'Pagos anteriores'}</td><td><Link className="pf-open" to={`/ordenes/${r.id_orden}/pago`}>{estado==='pendiente'?'Confirmar pago →':'Abrir factura →'}</Link></td></tr>)}</tbody></>}
      </table></div>}</section></div>
}
