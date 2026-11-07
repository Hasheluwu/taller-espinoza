// backend/src/services/billing.js
const { cents, fail, lockOrder, packId } = require('./validation')
const { metodoPagoToSlug } = require('./catalogs')

const sum = rows => rows.reduce((total, p) => total + cents(p.monto), 0)

function calculateSummary(order, client = [], insurance = []) {
  const total = order.costo_total == null ? null : cents(order.costo_total, 'Total de la orden')
  const insured = ['lafise', 'iniser'].includes(order.tipo_pago)
  const single = Number(order.pagador_unico ?? 1) === 1
  const clientDue =
    insured && single ? 0 : insured ? (order.monto_cliente == null ? 0 : cents(order.monto_cliente)) : total
  const insuranceDue =
    insured && single ? total : insured ? (order.monto_seguro == null ? total : cents(order.monto_seguro)) : 0
  const configured =
    total !== null && total > 0 && clientDue !== null && insuranceDue !== null && clientDue + insuranceDue === total

  const clientPaid = sum(client)
  const insurancePaid = sum(insurance.filter(p => (p.estado || 'recibido') === 'recibido'))
  const insurancePending = sum(insurance.filter(p => p.estado === 'pendiente'))
  const remainingClient = clientDue == null ? null : Math.max(0, clientDue - clientPaid)
  const remainingInsurance = insuranceDue == null ? null : Math.max(0, insuranceDue - insurancePaid)
  const paid = configured && remainingClient === 0 && remainingInsurance === 0
  const excess = configured ? Math.max(0, clientPaid - clientDue) + Math.max(0, insurancePaid - insuranceDue) : 0

  return {
    pagador_unico: single,
    pagos_cliente: client,
    pagos_seguro: insurance,
    total_cliente: clientPaid / 100,
    total_seguro: (insurancePaid + insurancePending) / 100,
    seguro_recibido: insurancePaid / 100,
    seguro_pendiente: insurancePending / 100,
    gran_total: (clientPaid + insurancePaid) / 100,
    total_orden: total == null ? null : total / 100,
    monto_cliente: clientDue == null ? null : clientDue / 100,
    monto_seguro: insuranceDue == null ? null : insuranceDue / 100,
    saldo_cliente: remainingClient == null ? null : remainingClient / 100,
    saldo_seguro: remainingInsurance == null ? null : remainingInsurance / 100,
    saldo_total: configured
      ? (remainingClient + remainingInsurance) / 100
      : total == null
        ? null
        : Math.max(0, total - clientPaid - insurancePaid) / 100,
    aplicado_a_deuda: configured ? (Math.min(clientPaid, clientDue) + Math.min(insurancePaid, insuranceDue)) / 100 : 0,
    disponible_seguro: remainingInsurance == null ? null : Math.max(0, remainingInsurance - insurancePending) / 100,
    configurado: configured,
    pagado: paid,
    excedente: excess / 100,
    excedente_cliente: configured ? Math.max(0, clientPaid - clientDue) / 100 : 0,
    excedente_seguro: configured ? Math.max(0, insurancePaid - insuranceDue) / 100 : 0,
    cliente_pagado: configured && remainingClient === 0,
    seguro_pagado: configured && remainingInsurance === 0,
    puede_cobrar_cliente: configured && order.estado !== 'cancelado' && remainingClient > 0,
    puede_cobrar_seguro: configured && insured && order.estado !== 'cancelado' && remainingInsurance > insurancePending,
  }
}

async function summary(conn, order) {
  const orderId = order.id_orden || order.id
  const [clientRows] = await conn.query(
    `SELECT pc.*, mp.nombre AS metodo_nombre
     FROM pago_cliente pc
     JOIN metodo_pago mp ON mp.id_metodo = pc.id_metodo
     WHERE pc.id_orden = ?
     ORDER BY pc.fecha ASC, pc.num_pago ASC`,
    [orderId]
  )
  const client = clientRows.map(r => ({
    ...r,
    id: packId(r.id_orden, r.num_pago),
    tipo: 'abono',
    metodo: metodoPagoToSlug(r.id_metodo, r.metodo_nombre),
    registrado_por: r.id_usuario,
  }))

  const [insRows] = await conn.query(
    `SELECT * FROM pago_seguro WHERE id_orden = ? ORDER BY num_pago ASC`,
    [orderId]
  )
  const insurance = insRows.map(r => ({
    ...r,
    id: packId(r.id_orden, r.num_pago),
    estado: 'recibido',
    fecha_esperada: r.fecha_recibido,
  }))

  const base = calculateSummary(order, client, insurance)
  if (!['lafise', 'iniser'].includes(order.tipo_pago)) return base

  const invoice = await require('./insuranceInvoices').existing(conn, orderId)
  if (!invoice) return { ...base, puede_cobrar_cliente: false, puede_cobrar_seguro: false }

  const total = Number(invoice.total)
  const remaining = invoice.estado === 'pagada' ? 0 : Math.max(0, Number(invoice.saldo_inicial))
  return {
    ...base,
    factura_id: invoice.id,
    pagador_unico: true,
    configurado: true,
    total_orden: total,
    monto_cliente: 0,
    monto_seguro: total,
    saldo_cliente: 0,
    saldo_seguro: remaining,
    saldo_total: remaining,
    pagado: invoice.estado === 'pagada',
    cliente_pagado: true,
    seguro_pagado: invoice.estado === 'pagada',
    aplicado_a_deuda: total - remaining,
    gran_total: Number(invoice.monto_recibido) + Number(base.total_cliente),
    seguro_recibido: Number(invoice.monto_recibido),
    seguro_pendiente: remaining,
    puede_cobrar_cliente: false,
    puede_cobrar_seguro: false,
  }
}

function validatePayment(order, balance, amount, payer) {
  const value = cents(amount, 'Monto', true)
  if (order.estado === 'cancelado') fail('No se pueden registrar pagos en una orden cancelada.', 409)
  if (!balance.configurado) {
    fail('Define el total de la orden y los cargos en Operaciones antes de cobrar.', 409)
  }
  if (payer === 'seguro' && !['lafise', 'iniser'].includes(order.tipo_pago)) {
    fail('Esta orden no tiene aseguradora.')
  }
  const available = cents(payer === 'cliente' ? balance.saldo_cliente : balance.disponible_seguro)
  if (available === 0) fail('No hay saldo disponible para registrar otro pago.', 409)
  if (value > available) {
    fail(`El pago supera el saldo disponible de C$ ${(available / 100).toFixed(2)}.`, 409)
  }
  return value / 100
}

module.exports = { calculateSummary, summary, validatePayment, lockOrder }