import '../proformas.css'
import { currency } from '../lib/workshopApi'
function Field({ label, children }) { return <label className="pf-field"><span>{label}</span>{children}</label> }
function previewTotals(form) {
  const global=form.mano_obra_global!==null && form.mano_obra_global!==''
  let base=global?Math.round(Number(form.mano_obra_global || 0)*100):0,iva=global?Math.round(base*.15):0
  for(const d of form.detalles){if(global && d.tipo_linea==='servicio')continue;const amount=Math.round(Number(d.cantidad || 0)*Math.round(Number(d.precio_unitario || 0)*100));base+=amount;if(d.aplica_iva)iva+=Math.round(amount*.15)}
  return {subtotal:base/100,iva:iva/100,total:(base+iva)/100}
}

export default function ParticularEditor({ cliente, vehiculo, form, setForm, tipo, setTipo, fecha, setFecha, entrega, setEntrega, busy, error, onSubmit, onBack, options }) {
  const change = (key, value) => setForm(old => ({ ...old, [key]: value }))
  const line = (index, key, value) => change('detalles', form.detalles.map((d,i) => i === index ? { ...d, [key]: value } : d))
  const global = form.mano_obra_global !== null
  const totals = previewTotals(form)
  return <div className="pf-page">
    <header className="pf-heading"><div><span className="pf-eyebrow">ATENCIÓN DIRECTA · SIN SEGURO</span><h1>Un nuevo trabajo particular<span>.</span></h1><p>Define los trabajos, repuestos y el importe a pagar por el cliente.</p></div><button className="pf-secondary" onClick={onBack}>Cambiar cliente o vehículo</button></header>
    <form onSubmit={onSubmit} className="pf-editor">
      <div className="pf-editor-main">
        <section className="pf-panel"><div className="pf-step"><span>01</span><h2>Cliente y vehículo</h2></div>
          <div className="pf-vehicle"><div><strong>{cliente.nombre}</strong><p>{vehiculo.matricula} · {vehiculo.marca} {vehiculo.modelo} · {vehiculo.anio_fabricacion}</p></div><span className="pf-badge">PARTICULAR</span></div>
          <div className="pf-form-grid"><Field label="Fecha de ingreso"><input type="datetime-local" required value={fecha} onChange={e=>setFecha(e.target.value)}/></Field><Field label="Tipo de trabajo"><select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="pintura">Pintura</option><option value="mecanica">Mecánica</option><option value="mantenimiento">Mantenimiento</option></select></Field><Field label="Entrega estimada · opcional"><input type="date" min={fecha.slice(0, 10)} value={entrega} onChange={e=>setEntrega(e.target.value)}/></Field><Field label="Responsable del pago"><input value="PARTICULAR · Paga el cliente" readOnly/></Field></div>
        </section>
      <section className="pf-panel"><div className="pf-step"><span>02</span><h2>Trabajos y repuestos</h2></div><div className="pf-labor"><Field label="Cómo cotizar la mano de obra"><select value={global?'global':'lineas'} onChange={e=>change('mano_obra_global',e.target.value==='global'?0:null)}><option value="global">Monto global</option><option value="lineas">Precio por cada trabajo</option></select></Field>{global && <Field label="Mano de obra global C$ · IVA 15%"><input type="number" min="0" step="0.01" required value={form.mano_obra_global ?? ''} onChange={e=>change('mano_obra_global',e.target.value)} placeholder="0.00"/></Field>}</div>
      <div className="pf-lines">{form.detalles.map((d,i)=><div className="pf-line" key={i}><Field label={`Concepto ${i+1}`}><select value={d.tipo_linea} onChange={e=>line(i,'tipo_linea',e.target.value)}><option value="servicio">Mano de obra</option><option value="repuesto">Repuesto</option><option value="material">Material</option></select></Field><Field label="Descripción"><input maxLength="220" required value={d.descripcion} onChange={e=>line(i,'descripcion',e.target.value)} placeholder="Ej. Reparación de bumper delantero"/></Field><Field label="Cantidad"><input type="number" min="0.01" max="99999" step="0.01" required value={d.cantidad} onChange={e=>line(i,'cantidad',e.target.value)}/></Field><Field label="Precio C$"><input type="number" min="0" step="0.01" required disabled={global && d.tipo_linea==='servicio'} value={global && d.tipo_linea==='servicio'?0:d.precio_unitario} onChange={e=>line(i,'precio_unitario',e.target.value)}/></Field><label className="pf-check"><input type="checkbox" disabled={global && d.tipo_linea==='servicio'} checked={global && d.tipo_linea==='servicio'?true:d.aplica_iva} onChange={e=>line(i,'aplica_iva',e.target.checked)}/>IVA</label><button type="button" className="pf-remove" disabled={form.detalles.length===1} aria-label={`Eliminar concepto ${i+1}`} onClick={()=>change('detalles',form.detalles.filter((_,n)=>n!==i))}>×</button></div>)}</div><button type="button" className="pf-secondary" disabled={form.detalles.length>=100} onClick={()=>change('detalles',[...form.detalles,{tipo_linea:'repuesto',descripcion:'',cantidad:1,precio_unitario:0,aplica_iva:false}])}>＋ Agregar concepto</button></section>
      <section className="pf-panel"><div className="pf-step"><span>03</span><h2>Observaciones</h2></div><Field label="Condiciones, alcance o notas para el cliente"><textarea rows="3" maxLength="4000" value={form.observaciones || ''} onChange={e=>change('observaciones',e.target.value)} placeholder="Condiciones y detalles de este trabajo…"/></Field></section>

        {options}
      </div>
      <aside className="pf-panel pf-summary"><span className="pf-eyebrow">RESUMEN DEL TRABAJO</span><h2>Particular</h2><p>El cliente paga el total. Puedes registrar sus abonos desde Pagos después de crear la orden.</p><dl><div><dt>Subtotal</dt><dd>{currency(totals.subtotal)}</dd></div><div><dt>IVA</dt><dd>{currency(totals.iva)}</dd></div><div className="pf-grand"><dt>Total</dt><dd>{currency(totals.total)}</dd></div></dl>{error && <p role="alert" className="pf-error">{error}</p>}<button className="pf-primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar trabajo →'}</button><small>Guarda la orden y sus conceptos. El consumo de inventario se registra desde Operaciones.</small></aside>
    </form>
  </div>
}
