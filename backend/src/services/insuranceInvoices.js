const { cents, fail, lockOrder } = require('./validation')
const { json, calculate: quoteTotals } = require('./proformas')
const insured = order => ['lafise', 'iniser'].includes(order.tipo_pago)

function calculate(insurer, lines) {
  const rate = { lafise: 20, iniser: 15 }[insurer]
  if (!rate) fail('Esta orden no corresponde a una aseguradora admitida.')
  const details = lines.map(line => {
    const base = cents(line.importe, 'Importe de la actividad')
    const labor = line.tipo_linea === 'servicio'
    const discount = labor ? Math.round(base * rate / 100) : 0
    const net = base - discount
    const tax = labor || line.aplica_iva ? Math.round(net * .15) : 0
    return { ...line, importe: base / 100, descuento: discount / 100, neto: net / 100, iva: tax / 100, total: (net + tax) / 100 }
  })
  const sum = key => details.reduce((total, line) => total + cents(line[key]), 0) / 100
  return { porcentaje_descuento: rate, detalles: details, bruto: sum('importe'), descuento: sum('descuento'), subtotal: sum('neto'), iva: sum('iva'), total: sum('total') }
}
async function existing(conn, id) {
  const [[row]] = await conn.query('SELECT * FROM factura_seguro WHERE id_orden=?', [id])
  return row ? { ...row, documento: json(row.documento) } : null
}
async function preview(conn, order) {
  if (!insured(order)) fail('Los particulares conservan sus pagos por abonos.')
  const [[vehicle]] = await conn.query(`SELECT v.*,c.nombre AS cliente,c.municipio_residencia FROM vehiculo v JOIN cliente c ON c.id=v.id_cliente WHERE v.id=?`, [order.id_vehiculo])
  const [services] = await conn.query('SELECT * FROM orden_servicio WHERE id_orden=? ORDER BY id', [order.id])
  // Older converted orders stored every billed line as a service. Recover its
  // original type from the immutable, linked quote, without guessing by keywords.
  const sourceTypes = new Map()
  if (order.id_presupuesto && order.cargos_desde_proforma) {
    const p = await require('./proformas').read(conn, order.id_presupuesto)
    for (const d of quoteTotals(p).detalles) sourceTypes.set(`${d.cantidad} × ${d.descripcion}`, d.tipo_linea)
  }
  const lines = services.map(s => ({ descripcion: s.descripcion, tipo_linea: sourceTypes.get(s.descripcion) || s.tipo_linea || 'servicio', cantidad: 1, importe: Number(s.precio), aplica_iva: !!s.aplica_iva }))
  if (!order.cargos_desde_proforma) {
    const [materials] = await conn.query('SELECT m.cantidad_usada,m.precio_unitario,i.nombre FROM orden_material m JOIN inventario i ON i.id=m.id_material WHERE m.id_orden=?', [order.id])
    const [parts] = await conn.query('SELECT r.cantidad_usada,r.precio_unitario,p.nombre FROM orden_repuesto r JOIN repuesto_taller p ON p.id=r.id_repuesto WHERE r.id_orden=?', [order.id])
    for (const [type, rows] of [['material', materials], ['repuesto', parts]]) for (const row of rows) lines.push({ descripcion: row.nombre, tipo_linea: type, cantidad: Number(row.cantidad_usada), importe: Math.round(Number(row.cantidad_usada) * cents(row.precio_unitario)) / 100, aplica_iva: false })
  }
  if (!lines.length) fail('Registra las actividades y sus precios en Operaciones antes de emitir la factura.', 409)
  const totals = calculate(order.tipo_pago, lines)
  if (order.subtotal != null && cents(totals.bruto) !== cents(order.subtotal)) fail('Los conceptos no coinciden con el subtotal de la orden. Revisa sus cargos antes de facturar.',409)
  const [[credits]] = await conn.query(`SELECT (SELECT COALESCE(SUM(monto),0) FROM pago_cliente WHERE id_orden=?) cliente, (SELECT COALESCE(SUM(monto),0) FROM pago_seguro WHERE id_orden=? AND estado='recibido') seguro`, [order.id, order.id])
  const credit = cents(credits.cliente) + cents(credits.seguro)
  return { ...totals, id_orden: order.id, aseguradora: order.tipo_pago.toUpperCase(), tramite: order.numero_tramite,
    cliente: vehicle.cliente, poblacion: vehicle.municipio_residencia, ingreso: order.fecha_ingreso,
    vehiculo: { matricula: vehicle.matricula, marca: vehicle.marca, modelo: vehicle.modelo, anio: vehicle.anio_fabricacion, color: vehicle.color },
    credito_cliente_anterior: Number(credits.cliente), credito_seguro_anterior: Number(credits.seguro),
    credito_anterior: credit / 100, saldo: Math.max(0, cents(totals.total) - credit) / 100,
    excedente_anterior: Math.max(0, credit - cents(totals.total)) / 100 }
}
async function audit(conn, user, id, action, detail) {
  await conn.query('INSERT INTO auditoria (id_usuario,tabla,id_registro,accion,detalle) VALUES (?,\'factura_seguro\',?,?,?)', [user, id, action, detail])
}
async function issue(conn, id, user) {
  const order = await lockOrder(conn, id)
  const prior = await existing(conn, id)
  if (prior) return prior
  if (!['listo','entregado'].includes(order.estado)) fail('Marca la reparación como lista antes de emitir su factura definitiva.', 409)
  const document = await preview(conn, order)
  if (document.total <= 0) fail('La factura debe tener un total mayor que cero.')
  const state = document.saldo === 0 ? 'pagada' : 'pendiente'
  const [result] = await conn.query(`INSERT INTO factura_seguro (id_orden,aseguradora,documento,total,saldo_inicial,estado,creado_por) VALUES (?,?,?,?,?,?,?)`, [id, order.tipo_pago, JSON.stringify(document), document.total, document.saldo, state, user])
  await conn.query('UPDATE orden SET factura_emitida=TRUE WHERE id=?', [id])
  await audit(conn, user, result.insertId, 'crear', `Factura de orden #${id}. Total ${document.total}; crédito histórico ${document.credito_anterior}.`)
  return existing(conn, id)
}
async function pay(conn, id, body, user) {
  const order = await lockOrder(conn, id)
  if (!insured(order) || order.estado === 'cancelado') fail('Esta orden no admite pagos de aseguradora.', 409)
  const invoice = await existing(conn, id)
  if (!invoice) fail('Emite y revisa primero la factura de la aseguradora.', 409)
  if (invoice.estado === 'pagada') return invoice
  if (body.confirmar !== true) fail('Confirma que recibiste el pago completo.')
  const date = String(body.fecha || '')
  const parsed = new Date(`${date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date > new Date().toLocaleDateString('en-CA',{timeZone:'America/Managua'})) fail('Ingresa una fecha de pago válida, no futura.')
  const reference = require('./fieldRules').reference(body.referencia, { label: 'Referencia del pago', max: 100 })
  await conn.query("UPDATE factura_seguro SET estado='pagada',fecha_pago=?,referencia=?,pagado_por=?,monto_recibido=saldo_inicial WHERE id=?", [date, reference || null, user, invoice.id])
  await audit(conn, user, invoice.id, 'cambio_estado', `Pago completo recibido: C$ ${invoice.saldo_inicial}. Fecha ${date}.`)
  return existing(conn, id)
}
module.exports = { calculate, insured, existing, preview, issue, pay }
