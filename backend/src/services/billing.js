const { cents, fail, lockOrder } = require('./validation')
const sum = rows => rows.reduce((total, p) => total + cents(p.monto), 0)
function calculateSummary(order, client = [], insurance = []) {
  const total = order.costo_total == null ? null : cents(order.costo_total, 'Total de la orden')
  const insured = ['lafise', 'iniser'].includes(order.tipo_pago)
  const clientDue = insured ? (order.monto_cliente == null ? null : cents(order.monto_cliente)) : total
  const insuranceDue = insured ? (order.monto_seguro == null ? null : cents(order.monto_seguro)) : 0
  const configured = total !== null && total > 0 && clientDue !== null && insuranceDue !== null && clientDue + insuranceDue === total
  const clientPaid = sum(client)
  const insurancePaid = sum(insurance.filter(p => p.estado === 'recibido'))
  const insurancePending = sum(insurance.filter(p => p.estado === 'pendiente'))
  const remainingClient = clientDue == null ? null : Math.max(0, clientDue - clientPaid)
  const remainingInsurance = insuranceDue == null ? null : Math.max(0, insuranceDue - insurancePaid)
  const paid = configured && remainingClient === 0 && remainingInsurance === 0
  const excess = configured ? Math.max(0, clientPaid - clientDue) + Math.max(0, insurancePaid - insuranceDue) : 0
  return {
    pagos_cliente: client, pagos_seguro: insurance,
    total_cliente: clientPaid / 100, total_seguro: (insurancePaid + insurancePending) / 100,
    seguro_recibido: insurancePaid / 100, seguro_pendiente: insurancePending / 100,
    gran_total: (clientPaid + insurancePaid) / 100,
    total_orden: total == null ? null : total / 100,
    monto_cliente: clientDue == null ? null : clientDue / 100,
    monto_seguro: insuranceDue == null ? null : insuranceDue / 100,
    saldo_cliente: remainingClient == null ? null : remainingClient / 100,
    saldo_seguro: remainingInsurance == null ? null : remainingInsurance / 100,
    saldo_total: configured ? (remainingClient + remainingInsurance) / 100 : total == null ? null : Math.max(0, total - clientPaid - insurancePaid) / 100,
    aplicado_a_deuda: configured ? (Math.min(clientPaid,clientDue) + Math.min(insurancePaid,insuranceDue))/100 : 0,
    disponible_seguro: remainingInsurance == null ? null : Math.max(0, remainingInsurance - insurancePending) / 100,
    configurado: configured, pagado: paid, excedente: excess / 100,
    excedente_cliente: configured ? Math.max(0,clientPaid-clientDue)/100 : 0,
    excedente_seguro: configured ? Math.max(0,insurancePaid-insuranceDue)/100 : 0,
    cliente_pagado: configured && remainingClient === 0,
    seguro_pagado: configured && remainingInsurance === 0,
    puede_cobrar_cliente: configured && order.estado !== 'cancelado' && remainingClient > 0,
    puede_cobrar_seguro: configured && insured && order.estado !== 'cancelado' && remainingInsurance > insurancePending,
  }
}
async function summary(conn, order) {
  const [client] = await conn.query('SELECT * FROM pago_cliente WHERE id_orden = ? ORDER BY fecha ASC, id ASC', [order.id])
  const [insurance] = await conn.query('SELECT * FROM pago_seguro WHERE id_orden = ? ORDER BY id ASC', [order.id])
  return calculateSummary(order, client, insurance)
}
function validatePayment(order, balance, amount, payer) {
  const value = cents(amount, 'Monto', true)
  if (order.estado === 'cancelado') fail('No se pueden registrar pagos en una orden cancelada.', 409)
  if (!balance.configurado) fail('Define el total de la orden y la distribución entre cliente y seguro antes de cobrar.', 409)
  if (payer === 'seguro' && !['lafise', 'iniser'].includes(order.tipo_pago)) fail('Esta orden no tiene aseguradora.')
  const available = cents(payer === 'cliente' ? balance.saldo_cliente : balance.disponible_seguro)
  if (available === 0) fail('No hay saldo disponible para registrar otro pago.', 409)
  if (value > available) fail(`El pago supera el saldo disponible de C$ ${(available / 100).toFixed(2)}.`, 409)
  return value / 100
}
module.exports = { calculateSummary, summary, validatePayment, lockOrder }
