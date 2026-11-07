// backend/src/services/proformaUpdate.js
const { fail, cents, lockOrder, packId } = require('./validation')
const proformas = require('./proformas')

async function pendingCharges(conn, p) {
  const orderId = p.ordenes?.[0]
  if (!orderId) fail('Esta proforma todavía no tiene una orden de trabajo.', 409)

  const [lines] = await conn.query(
    'SELECT num_linea, descripcion, precio, aplica_iva FROM orden_servicio WHERE id_orden = ? ORDER BY num_linea ASC',
    [orderId]
  )

  const expected = p.detalles.map(
    d => `${d.cantidad} × ${d.descripcion}|${Math.round(Number(d.cantidad) * cents(d.precio_unitario))}`
  )
  const extras = []
  for (const line of lines) {
    const key = `${line.descripcion}|${cents(line.precio)}`
    const at = expected.indexOf(key)
    if (at >= 0) {
      expected.splice(at, 1)
      continue
    }
    extras.push({
      id: packId(orderId, line.num_linea),
      num_linea: line.num_linea,
      descripcion: line.descripcion,
      precio: Number(line.precio),
      aplica_iva: Boolean(line.aplica_iva),
      tipo_linea: 'servicio',
    })
  }
  return { orderId, lines, extras }
}

async function updateFromOrder(conn, id, user) {
  const p = await proformas.read(conn, id, true)
  const { orderId, extras } = await pendingCharges(conn, p)
  const order = await lockOrder(conn, orderId)
  if (order.estado === 'cancelado') fail('La orden está cancelada.', 409)
  if (order.factura_emitida) fail('La orden ya tiene su factura emitida; sus cargos están cerrados.', 409)
  if (!extras.length) fail('La proforma ya incluye todos los cargos de la orden.', 409)

  const [[maxRow]] = await conn.query(
    'SELECT COALESCE(MAX(num_linea), 0) AS max_linea FROM presupuesto_detalle WHERE id_presupuesto = ?',
    [id]
  )
  let nextLinea = Number(maxRow.max_linea) + 1

  for (const extra of extras) {
    await conn.query(
      `INSERT INTO presupuesto_detalle
         (id_presupuesto, num_linea, tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva)
       VALUES (?, ?, 'servicio', ?, 1.00, ?, ?)`,
      [id, nextLinea, extra.descripcion, extra.precio, extra.aplica_iva ? 1 : 0]
    )
    nextLinea += 1
  }

  await proformas.audit(
    conn,
    user,
    id,
    'editar',
    `Actualizada desde la orden #${orderId}: ${extras.length} cargo(s) nuevo(s)`
  )
  return { ...(await proformas.read(conn, id)), cargos_agregados: extras }
}

module.exports = { pendingCharges, updateFromOrder }