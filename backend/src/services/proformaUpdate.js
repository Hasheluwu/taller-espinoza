// Brings a proforma up to date with charges added to its order after conversion.
// The approved version stays in the history; the update is a new version with the same number.
const { fail, cents, lockOrder } = require('./validation')
const proformas = require('./proformas')

// Order charge lines that the proforma does not include yet.
async function pendingCharges(conn, p) {
  const [[conversion]] = await conn.query('SELECT id_orden, version FROM proforma_conversion WHERE id_presupuesto=?', [p.id])
  const orderId = conversion?.id_orden ?? p.ordenes[0]
  if (!orderId) fail('Esta proforma todavía no tiene una orden de trabajo.', 409)
  const [lines] = await conn.query('SELECT id, descripcion, precio, aplica_iva, tipo_linea FROM orden_servicio WHERE id_orden=? ORDER BY id', [orderId])
  const [recorded] = await conn.query('SELECT id_orden_servicio FROM proforma_cargo_orden WHERE id_presupuesto=?', [p.id])
  const included = new Set(recorded.map(r => r.id_orden_servicio))
  // Lines copied at conversion come from the version that was converted.
  let source = p
  if (conversion) {
    const [[row]] = await conn.query('SELECT documento FROM proforma_version WHERE id_presupuesto=? AND version=?', [p.id, conversion.version])
    if (row) source = proformas.json(row.documento)
  }
  const copied = proformas.calculate({ detalles: source.detalles.map(d => ({ ...d, aplica_iva: !!d.aplica_iva })), mano_obra_global: source.mano_obra_global })
  const expected = copied.detalles.map(d => `${d.cantidad} × ${d.descripcion}|${cents(d.base)}`)
  if (copied.mano_obra_global !== null) expected.push(`Mano de obra · Presupuesto ${source.numero || p.id} (ver detalle en documento)|${cents(copied.mano_obra_global)}`)
  const extras = []
  for (const line of lines) {
    if (included.has(line.id)) continue
    const key = `${line.descripcion}|${cents(line.precio)}`
    const at = expected.indexOf(key)
    if (at >= 0) { expected.splice(at, 1); continue }
    extras.push({ id: line.id, descripcion: line.descripcion, precio: Number(line.precio), aplica_iva: !!line.aplica_iva, tipo_linea: line.tipo_linea || 'servicio' })
  }
  return { orderId, lines, extras }
}

async function updateFromOrder(conn, id, user) {
  const p = await proformas.read(conn, id, true)
  if (p.fase === 'anulada') fail('La proforma está anulada.', 409)
  const { orderId, lines, extras } = await pendingCharges(conn, p)
  const order = await lockOrder(conn, orderId)
  if (order.estado === 'cancelado') fail('La orden está cancelada.', 409)
  if (order.factura_emitida) fail('La orden ya tiene su factura emitida; sus cargos están cerrados.', 409)
  if (!extras.length) fail('La proforma ya incluye todos los cargos de la orden.', 409)

  // With a global labor amount, new labor is listed as an activity and added to that amount.
  let global = p.mano_obra_global === null ? null : cents(p.mano_obra_global)
  const detalles = p.detalles.map(d => ({ tipo_linea: d.tipo_linea, descripcion: d.descripcion, cantidad: Number(d.cantidad), precio_unitario: Number(d.precio_unitario), aplica_iva: !!d.aplica_iva }))
  for (const extra of extras) {
    if (global !== null && extra.tipo_linea === 'servicio') {
      if (!extra.aplica_iva) fail(`«${extra.descripcion}» no lleva IVA, pero la mano de obra de esta proforma sí. Revisa ese cargo en la orden.`, 409)
      global += cents(extra.precio)
      detalles.push({ tipo_linea: 'servicio', descripcion: extra.descripcion, cantidad: 1, precio_unitario: 0, aplica_iva: false })
    } else {
      detalles.push({ tipo_linea: extra.tipo_linea, descripcion: extra.descripcion, cantidad: 1, precio_unitario: extra.precio, aplica_iva: extra.aplica_iva })
    }
  }
  const totals = proformas.calculate({ detalles, mano_obra_global: global === null ? null : global / 100 })

  // The updated document must add up to what the order actually charges.
  const orderSubtotal = lines.reduce((s, l) => s + cents(l.precio), 0)
  const orderIva = lines.reduce((s, l) => s + (l.aplica_iva ? Math.round(cents(l.precio) * 0.15) : 0), 0)
  const tolerance = lines.length
  if (Math.abs(cents(totals.subtotal) - orderSubtotal) > 0 || Math.abs(cents(totals.iva) - orderIva) > tolerance) {
    fail(`La proforma actualizada sumaría C$ ${totals.total.toFixed(2)}, pero la orden cobra C$ ${((orderSubtotal + orderIva) / 100).toFixed(2)}. Se quitó o cambió un cargo que venía de la proforma; revísalo en la orden antes de actualizar.`, 409)
  }

  const version = p.version + 1
  await conn.query('UPDATE presupuesto SET subtotal=?, iva=?, total=? WHERE id=?', [totals.subtotal, totals.iva, totals.total, id])
  await conn.query('DELETE FROM presupuesto_detalle WHERE id_presupuesto=?', [id])
  for (const d of totals.detalles) await conn.query('INSERT INTO presupuesto_detalle (id_presupuesto,tipo_linea,descripcion,cantidad,precio_unitario,aplica_iva) VALUES (?,?,?,?,?,?)', [id, d.tipo_linea, d.descripcion, d.cantidad, d.precio_unitario, d.aplica_iva])
  await conn.query('UPDATE proforma_documento SET version=?, mano_obra_global=?, actualizado=CURRENT_TIMESTAMP WHERE id_presupuesto=?', [version, totals.mano_obra_global, id])
  for (const extra of extras) await conn.query('INSERT INTO proforma_cargo_orden (id_orden_servicio, id_presupuesto) VALUES (?, ?)', [extra.id, id])
  const updated = await proformas.read(conn, id)
  const documento = { ...updated, actualizada_desde_orden: orderId }
  delete documento.vehiculo_actual
  await conn.query('INSERT INTO proforma_version (id_presupuesto,version,documento,creado_por,emitida) VALUES (?,?,?,?,UTC_TIMESTAMP())', [id, version, JSON.stringify(documento), user])
  await proformas.audit(conn, user, id, 'editar', `Versión ${version} actualizada desde la orden #${orderId}: ${extras.length} cargo(s) nuevo(s); total C$ ${p.total} -> C$ ${totals.total}`)
  return { ...(await proformas.read(conn, id)), cargos_agregados: extras }
}

module.exports = { pendingCharges, updateFromOrder }
