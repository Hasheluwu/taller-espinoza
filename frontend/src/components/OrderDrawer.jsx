import { useEffect, useRef } from 'react'

const stages = [
  ['recibido', 'Recibido'], ['en_proceso', 'En reparación'],
  ['listo', 'Listo para entregar'], ['entregado', 'Entregado'],
]

export default function OrderDrawer({ orden, onClose, onOperaciones, onPago, onExpediente, onCambiarEstado, guardando, errorEstado }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  const current = stages.findIndex(([key]) => key === orden.estado)
  return <dialog ref={ref} className="order-drawer" aria-labelledby="order-drawer-title"
    onCancel={e => { e.preventDefault(); if (!guardando) onClose() }}
    onClick={e => { if (e.target === e.currentTarget && !guardando) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
    <header className="drawer-top"><span className="section-kicker">EXPEDIENTE / ORDEN #{orden.id}</span><button autoFocus disabled={guardando} className="drawer-close" aria-label="Cerrar detalle de orden" onClick={onClose}>×</button></header>
    <div className="drawer-body">
      <div className="drawer-vehicle"><span className="section-kicker">MATRÍCULA</span><h2 id="order-drawer-title">{orden.matricula}</h2><p>{orden.nombre_cliente}</p></div>
      <div className="drawer-contact"><span>Cédula <strong>{orden.cedula || 'No registrada'}</strong></span><span>Teléfono <strong>{orden.telefono || 'No registrado'}</strong></span></div>
      <section className="drawer-section"><h3>Estado de la reparación</h3>
        {current < 0 ? <p>{orden.estado}</p> : <ol className="repair-timeline">{stages.map(([key,label],index) => <li key={key} className={index < current ? 'is-complete' : index === current ? 'is-current' : ''} aria-current={index === current ? 'step' : undefined}><span aria-hidden="true">{index < current ? '✓' : index+1}</span><div>{label}{index === current && <small>Estado actual</small>}</div></li>)}</ol>}
      </section>
      <dl className="drawer-facts"><div><dt>Trabajo</dt><dd>{orden.tipo}</dd></div><div><dt>Forma de pago</dt><dd>{orden.tipo_pago}</dd></div><div><dt>Fecha de ingreso</dt><dd>{new Date(orden.fecha_ingreso).toLocaleDateString('es-NI')}</dd></div><div><dt>Pagos</dt><dd>{orden.pagado ? 'Pagado' : orden.tipo_pago==='particular' ? 'Consultar saldo y abonos' : 'Factura pendiente de pago'}</dd></div></dl>
      {errorEstado && <p role="alert" className="work-error">{errorEstado}</p>}
      <section className="drawer-section"><h3>Actualizar estado</h3><p className="drawer-hint">El cambio se guardará en la orden de trabajo.</p><div className="drawer-state-actions">
        {!['en_proceso','entregado','cancelado'].includes(orden.estado) && <button disabled={guardando} onClick={() => onCambiarEstado(orden.id,'en_proceso')}>Iniciar trabajo <span>→</span></button>}
        {!['listo','entregado','cancelado'].includes(orden.estado) && <button disabled={guardando} onClick={() => onCambiarEstado(orden.id,'listo')}>Marcar listo <span>✓</span></button>}
        {orden.estado === 'listo' && <button disabled={guardando} onClick={() => onCambiarEstado(orden.id,'entregado')}>Marcar entregado <span>↗</span></button>}
        {['entregado','cancelado'].includes(orden.estado) && <p className="drawer-hint">Esta orden ya no requiere cambios de estado.</p>}
      </div>{guardando && <p className="saving-status" role="status">Guardando cambio…</p>}</section>
      {['lafise','iniser'].includes(orden.tipo_pago) && !orden.pagado && <button disabled={guardando} className="drawer-expediente" onClick={()=>onPago(orden.id)}>Confirmar pago completo del seguro <span>→</span></button>}
      <button disabled={guardando} className="drawer-expediente" onClick={() => onExpediente(orden.id)}>Fotos y costos de la orden <span>↗</span></button>
    </div>
    <footer className="drawer-footer"><button disabled={guardando} className="btn-cyber-outline" onClick={() => onOperaciones(orden.id)}>Operaciones</button><button disabled={guardando} className="btn-cyber-orange" onClick={() => onPago(orden.id)}>{orden.tipo_pago!=='particular' ? 'Ver factura' : orden.pagado ? 'Ver recibos' : 'Consultar pagos'}</button></footer>
  </dialog>
}
