const money = n => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export default function ProformaDocument({ document: p, blank = false }) {
  const d = p.datos || {}
  const date = String(p.fecha || '').slice(0,10).split('-').reverse().join('/')
  const global = p.mano_obra_global !== null && p.mano_obra_global !== undefined && p.mano_obra_global !== ''
  const work = (p.detalles || []).filter(x => x.tipo_linea === 'servicio')
  const parts = (p.detalles || []).filter(x => x.tipo_linea !== 'servicio')
  const value = v => blank ? '________________________________' : (v || '—')
  return <article className="proforma-paper">
    <header className="paper-header"><img src="/proformas-logo.png" alt="Taller Pedro Espinoza"/><div><small>TALLER</small><h2>“ PEDRO ESPINOZA ”</h2><strong>Taller de Mecánica Automotriz, Diesel y Gasolina</strong><p>Cambio de aceite, reparación de alternadores, luces y cableado en general<br/>Revisión de fallas mecánicas, suspensión, clutch y frenos · Scaneo computarizado<br/>Limpieza de inyectores por laboratorio</p><p>Zumen 4c. arriba, frente a Raspados Loly<br/>Tel: 7683-9147 / Cel: 8137-6991 · RUC: 0012907390014E<br/>tallerespinoza-@hotmail.com</p></div></header>
    <h3 className="paper-title">PRESUPUESTO {p.numero ? `N° ${p.numero}` : 'SIN NÚMERO'}{!blank && p.fase === 'borrador' && <small>BORRADOR · NO EMITIDO</small>}{p.fase === 'anulada' && <small>DOCUMENTO ANULADO</small>}</h3>
    <div className="paper-data"><div><p><b>Cliente:</b> {value(d.cliente)}</p><p><b>Vehículo:</b> {value(d.vehiculo)}</p><p><b>Marca:</b> {value(d.marca)}</p><p><b>Año:</b> {value(d.anio)}</p></div><div><p><b>Fecha:</b> {date || '________________'}</p><p><b>Placa:</b> {value(d.placa)}</p><p><b>Seguro:</b> {p.seguro || 'PARTICULAR'}</p>{(blank || (p.seguro === 'LAFISE' ? p.tramite : p.reclamo)) && <p><b>{p.seguro === 'LAFISE' ? 'Trámite:' : 'Reclamo:'}</b> {value(p.seguro === 'LAFISE' ? p.tramite : p.reclamo)}</p>}</div></div>
    <table className="paper-lines"><thead><tr><th>DESCRIPCIÓN</th><th>TOTAL C$</th></tr></thead><tbody>
      {blank ? Array.from({length:14},(_,i)=><tr key={i}><td>&nbsp;</td><td/></tr>) : <>
        {work.map((x,i)=><tr key={`s${i}`}><td>{Number(x.cantidad) !== 1 ? `${x.cantidad} × ` : ''}{x.descripcion}</td><td>{global ? '' : money(Number(x.cantidad)*Number(x.precio_unitario))}</td></tr>)}
        {global && <tr className="paper-group"><td>MANO DE OBRA C$</td><td>{money(p.mano_obra_global)}</td></tr>}
        {parts.length > 0 && <tr className="paper-group"><td colSpan="2">REPUESTOS Y MATERIALES</td></tr>}
        {parts.map((x,i)=><tr key={`p${i}`}><td>{Number(x.cantidad) !== 1 ? `${x.cantidad} × ` : ''}{x.descripcion}</td><td>{money(Number(x.cantidad)*Number(x.precio_unitario))}</td></tr>)}
      </>}
    </tbody></table>
    <div className="paper-bottom"><div className="paper-observations"><b>Observaciones</b><p>{blank ? '________________________________' : (p.observaciones || 'Presupuesto sujeto a autorización. No constituye comprobante de pago.')}</p></div><dl><div><dt>SUBTOTAL</dt><dd>{blank ? '____________' : money(p.subtotal)}</dd></div><div><dt>I.V.A. (15%)</dt><dd>{blank ? '____________' : money(p.iva)}</dd></div><div><dt>TOTAL C$</dt><dd>{blank ? '____________' : money(p.total)}</dd></div></dl></div>
    <footer className="paper-footer"><span>____________________________<br/>Firma y sello del taller</span><span>____________________________<br/>Autorización del cliente</span></footer>
    {!blank && <p className="paper-version">{p.numero ? `Presupuesto ${p.numero}` : 'Vista previa'} · Versión {p.version || 1}</p>}
  </article>
}
