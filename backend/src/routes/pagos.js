const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const { fail, cents, paymentDate } = require('../services/validation')
const rules = require('../services/fieldRules')
const { summary, validatePayment, lockOrder } = require('../services/billing')
const router = express.Router()
router.use(require('../middleware/validateNumbers'))
router.use(requireAuth)

// All payment writes lock the same order before reading balances, so concurrent
// abonos cannot both spend the last available balance.
function transaction(action) {
  return async (req, res, next) => {
    let conn
    try {
      conn = await pool.getConnection()
      await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
      await conn.beginTransaction()
      const result = await action(conn, req)
      await conn.commit()
      res.status(result.status || 200).json(result.data)
    } catch (err) {
      if (conn) await conn.rollback()
      next(err)
    } finally { if (conn) conn.release() }
  }
}
async function audit(conn, req, table, id, action, detail) {
  await conn.query('INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, ?, ?, ?, ?)', [req.usuario.id, table, id, action, detail])
}
async function findPayment(conn, table, id) {
  const [rows] = await conn.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
  if (!rows.length) fail('Pago no encontrado.', 404)
  return rows[0]
}
function allowExcess(req, amount, available) {
  if (cents(amount) <= cents(available)) return ''
  if (req.usuario.rol !== 'administrador' || req.body.confirmar_excedente !== true || typeof req.body.motivo_excedente !== 'string' || req.body.motivo_excedente.trim().length < 5 || req.body.motivo_excedente.length > 500) fail(`El importe excede el saldo del seguro de C$ ${Number(available).toFixed(2)}. Corrige el cobro o confirma el excedente como administrador con una justificación.`, 409)
  return ` Excedente por conciliar: C$ ${(cents(amount)-cents(available))/100}. Motivo: ${req.body.motivo_excedente.trim()}`
}
router.get('/:id_orden/resumen', transaction(async (conn, req) => {
  const order = await lockOrder(conn, req.params.id_orden)
  return { data: await summary(conn, order) }
}))

router.put('/:id_orden/distribucion', transaction(async (conn, req) => {
  const order = await lockOrder(conn, req.params.id_orden, true)
  if (['lafise','iniser'].includes(order.tipo_pago)) fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo. Los registros anteriores son de consulta.',409)
  if (Number(order.pagador_unico) === 1) fail('Esta orden tiene un único pagador: la aseguradora.',409)
  if (!['lafise', 'iniser'].includes(order.tipo_pago)) fail('Esta orden no tiene aseguradora.')
  const client = cents(req.body.monto_cliente, 'Parte del cliente')
  const insurance = cents(req.body.monto_seguro, 'Parte del seguro')
  if (order.costo_total == null || client + insurance !== cents(order.costo_total)) fail('Cliente y seguro deben sumar exactamente el total de la orden.')
  const balance = await summary(conn, order)
  if (client < cents(balance.total_cliente) || insurance < cents(balance.total_seguro)) fail('La distribución no puede ser menor que los pagos o cobros ya registrados.', 409)
  await conn.query('UPDATE orden SET monto_cliente = ?, monto_seguro = ? WHERE id = ?', [client / 100, insurance / 100, order.id])
  await audit(conn, req, 'orden', order.id, 'editar', `Distribución: cliente ${client / 100}, seguro ${insurance / 100}`)
  return { data: await summary(conn, { ...order, monto_cliente: client / 100, monto_seguro: insurance / 100 }) }
}))

router.post('/:id_orden/cliente', transaction(async (conn, req) => {
  const { monto, fecha, tipo, metodo, numero_recibo } = req.body
  if (!['adelanto', 'abono', 'saldo'].includes(tipo)) fail('Tipo de pago inválido.')
  if (!['efectivo', 'transferencia', 'otro'].includes(metodo)) fail('Método de pago inválido.')
  const paidAt = paymentDate(fecha, 'Fecha de pago')
  const receipt = rules.reference(numero_recibo, { label: 'N° de recibo', max: 30 })
  const order = await lockOrder(conn, req.params.id_orden)
  if (['lafise','iniser'].includes(order.tipo_pago)) fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo. Los registros anteriores son de consulta.',409)
  const amount = validatePayment(order, await summary(conn, order), monto, 'cliente')
  const [result] = await conn.query(
    'INSERT INTO pago_cliente (id_orden, monto, fecha, tipo, metodo, numero_recibo, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [order.id, amount, paidAt || new Date(), tipo, metodo, receipt || null, req.usuario.id]
  )
  await audit(conn, req, 'pago_cliente', result.insertId, 'crear', `Pago ${tipo}: C$ ${amount} por ${metodo}`)
  const payment = await findPayment(conn, 'pago_cliente', result.insertId)
  return { status: 201, data: { ...payment, resumen: await summary(conn, order) } }
}))

router.post('/:id_orden/seguro', transaction(async (conn, req) => {
  const { monto, fecha_esperada, fecha_recibido, referencia_bancaria, concepto, estado = 'pendiente' } = req.body
  if (!['pago_principal', 'dano_oculto', 'otro'].includes(concepto)) fail('Concepto inválido.')
  if (!['pendiente', 'recibido'].includes(estado)) fail('Estado inválido.')
  const order = await lockOrder(conn, req.params.id_orden)
  if (['lafise','iniser'].includes(order.tipo_pago)) fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo. Los registros anteriores son de consulta.',409)
  const balance = await summary(conn, order)
  let amount, extra = ''
  if (req.body.confirmar_excedente === true) {
    if (!balance.configurado || order.estado === 'cancelado' || !['lafise','iniser'].includes(order.tipo_pago)) fail('Revisa el estado y distribución de la orden.',409)
    amount = cents(monto, 'Monto', true) / 100
    extra = allowExcess(req, amount, balance.disponible_seguro)
  } else amount = validatePayment(order, balance, monto, 'seguro')
  const [result] = await conn.query(
    'INSERT INTO pago_seguro (id_orden, monto, fecha_esperada, fecha_recibido, estado, referencia_bancaria, concepto) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [order.id, amount, paymentDate(fecha_esperada, 'Fecha esperada', { future: true }), estado === 'recibido' ? (paymentDate(fecha_recibido, 'Fecha de recibido') || new Date()) : null, estado, rules.reference(referencia_bancaria, { label: 'Referencia bancaria', max: 100 }) || null, concepto]
  )
  await audit(conn, req, 'pago_seguro', result.insertId, 'crear', `Cobro al seguro: C$ ${amount}, ${estado}.${extra}`)
  const payment = await findPayment(conn, 'pago_seguro', result.insertId)
  return { status: 201, data: { ...payment, resumen: await summary(conn, order) } }
}))

router.patch('/seguro/:id/estado', transaction(async (conn, req) => {
  if (req.body.estado !== 'recibido') fail('Solo se permite confirmar un cobro pendiente como recibido.')
  const reference = await findPayment(conn, 'pago_seguro', req.params.id)
  const order = await lockOrder(conn, reference.id_orden)
  if (['lafise','iniser'].includes(order.tipo_pago)) fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo. Los registros anteriores son de consulta.',409)
  const payment = await findPayment(conn, 'pago_seguro', req.params.id)
  const balance = await summary(conn, order)
  if (payment.estado !== 'recibido') {
    if (order.estado === 'cancelado' || !balance.configurado) fail('Revisa el estado y la distribución de la orden.', 409)
    const extra = allowExcess(req, payment.monto, balance.saldo_seguro)
    await conn.query('UPDATE pago_seguro SET estado = ?, fecha_recibido = ?, referencia_bancaria = ? WHERE id = ?',
      ['recibido', paymentDate(req.body.fecha_recibido, 'Fecha de recibido') || new Date(), rules.reference(req.body.referencia_bancaria, { label: 'Referencia bancaria', max: 100 }) || null, payment.id])
    await audit(conn, req, 'pago_seguro', payment.id, 'cambio_estado', 'Cobro confirmado como recibido.' + extra)
  }
  return { data: { ...await findPayment(conn, 'pago_seguro', payment.id), resumen: await summary(conn, order) } }
}))

router.put('/seguro/:id/pendiente', requireAuth.admin, transaction(async (conn,req) => {
  const reference = await findPayment(conn,'pago_seguro',req.params.id)
  const order = await lockOrder(conn,reference.id_orden)
  if (['lafise','iniser'].includes(order.tipo_pago)) fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo. Los registros anteriores son de consulta.',409)
  const payment = await findPayment(conn,'pago_seguro',req.params.id)
  if(payment.estado !== 'pendiente' || order.estado === 'cancelado') fail('Solo se puede corregir un cobro pendiente de una orden no cancelada.',409)
  const amount = cents(req.body.monto,'Monto',true)/100
  if(typeof req.body.motivo !== 'string' || req.body.motivo.trim().length < 5 || req.body.motivo.length > 500) fail('Describe el motivo de la corrección.')
  const balance = await summary(conn,order)
  const available = Math.max(0,Number(balance.saldo_seguro)-Number(balance.seguro_pendiente)+Number(payment.monto))
  if(!balance.configurado || amount > available) fail('El monto corregido supera el saldo disponible del seguro.',409)
  await conn.query('UPDATE pago_seguro SET monto = ? WHERE id = ?',[amount,payment.id])
  await audit(conn,req,'pago_seguro',payment.id,'editar',`Corrección de pendiente de C$ ${payment.monto} a C$ ${amount}: ${req.body.motivo.trim()}`)
  return {data:{...await findPayment(conn,'pago_seguro',payment.id),resumen:await summary(conn,order)}}
}))

// Removing an erroneous payment is restricted to administrators and unpaid,
// editable orders. Paid receipts remain in history and can still be printed.
for (const [path, table, payer] of [['cliente', 'pago_cliente', 'cliente'], ['seguro', 'pago_seguro', 'seguro']]) {
  router.delete(`/${path}/:id`, requireAuth.admin, transaction(async (conn, req) => {
    const reference = await findPayment(conn, table, req.params.id)
    const order = await lockOrder(conn, reference.id_orden, true)
  if (['lafise','iniser'].includes(order.tipo_pago)) fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo. Los registros anteriores son de consulta.',409)
    const payment = await findPayment(conn, table, req.params.id)
    const balance = await summary(conn, order)
    if (balance.pagado || (payer === 'cliente' ? balance.cliente_pagado : balance.seguro_pagado)) fail('La cuenta está pagada. No se puede eliminar el pago desde este flujo.', 409)
    await conn.query(`DELETE FROM ${table} WHERE id = ?`, [payment.id])
    await audit(conn, req, table, payment.id, 'eliminar', `Corrección de pago: C$ ${payment.monto}, orden #${order.id}`)
    return { data: { message: 'Pago eliminado.', resumen: await summary(conn, order) } }
  }))
}

// Both entry points use exactly the same status and audit logic.
const changeOrderState = require('../handlers/changeOrderState')(pool)
router.patch('/:id_orden/entregar', (req, res) => {
  req.params.id = req.params.id_orden
  req.body = { ...req.body, estado: 'entregado' }
  return changeOrderState(req, res)
})
module.exports = router




