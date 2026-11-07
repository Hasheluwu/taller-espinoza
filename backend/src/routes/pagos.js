// backend/src/routes/pagos.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const { fail, cents, paymentDate, packId, unpackId } = require('../services/validation')
const rules = require('../services/fieldRules')
const { summary, validatePayment, lockOrder } = require('../services/billing')
const { metodoPagoToId, metodoPagoToSlug } = require('../services/catalogs')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))
router.use(requireAuth)

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
    } finally {
      if (conn) conn.release()
    }
  }
}

async function audit(conn, req, table, id, action, detail) {
  await conn.query(
    'INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, ?, ?, ?, ?)',
    [req.usuario.id, table, String(id), action, detail]
  )
}

function allowExcess(req, amount, available) {
  if (cents(amount) <= cents(available)) return ''
  if (
    req.usuario.rol !== 'administrador' ||
    req.body.confirmar_excedente !== true ||
    typeof req.body.motivo_excedente !== 'string' ||
    req.body.motivo_excedente.trim().length < 5 ||
    req.body.motivo_excedente.length > 500
  ) {
    fail(
      `El importe excede el saldo del seguro de C$ ${Number(available).toFixed(2)}. Corrige el cobro o confirma el excedente como administrador con una justificación.`,
      409
    )
  }
  return ` Excedente por conciliar: C$ ${(cents(amount) - cents(available)) / 100}. Motivo: ${req.body.motivo_excedente.trim()}`
}

router.get(
  '/:id_orden/resumen',
  transaction(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id_orden)
    return { data: await summary(conn, order) }
  })
)

router.put(
  '/:id_orden/distribucion',
  transaction(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id_orden, true)
    if (['lafise', 'iniser'].includes(order.tipo_pago)) {
      fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo.', 409)
    }
    return { data: await summary(conn, order) }
  })
)

router.post(
  '/:id_orden/cliente',
  transaction(async (conn, req) => {
    const { monto, fecha, tipo = 'abono', metodo, numero_recibo } = req.body
    if (!['adelanto', 'abono', 'saldo'].includes(tipo)) fail('Tipo de pago inválido.')
    if (!['efectivo', 'transferencia', 'tarjeta', 'otro'].includes(metodo)) fail('Método de pago inválido.')

    const paidAt = paymentDate(fecha, 'Fecha de pago')
    const order = await lockOrder(conn, req.params.id_orden)
    if (['lafise', 'iniser'].includes(order.tipo_pago)) {
      fail('Gestiona el cobro desde la factura del seguro y confirma su pago completo.', 409)
    }

    const amount = validatePayment(order, await summary(conn, order), monto, 'cliente')
    const [[maxRow]] = await conn.query(
      'SELECT COALESCE(MAX(num_pago), 0) + 1 AS next_num FROM pago_cliente WHERE id_orden = ?',
      [order.id_orden]
    )
    const numPago = maxRow.next_num
    const receipt =
      rules.reference(numero_recibo, { label: 'N° de recibo', max: 30 }) ||
      `REC-${order.id_orden}-${String(numPago).padStart(3, '0')}`
    const idMetodo = metodoPagoToId(metodo)

    await conn.query(
      `INSERT INTO pago_cliente (id_orden, num_pago, monto, fecha, id_metodo, numero_recibo, id_usuario)
       VALUES (?, ?, ?, COALESCE(?, NOW()), ?, ?, ?)`,
      [order.id_orden, numPago, amount, paidAt, idMetodo, receipt, req.usuario.id]
    )

    const packedId = packId(order.id_orden, numPago)
    await audit(conn, req, 'pago_cliente', `${order.id_orden}-${numPago}`, 'crear', `Pago ${tipo}: C$ ${amount} por ${metodo}`)

    return {
      status: 201,
      data: {
        id: packedId,
        id_orden: order.id_orden,
        num_pago: numPago,
        monto: amount,
        tipo,
        metodo: metodoPagoToSlug(idMetodo),
        numero_recibo: receipt,
        resumen: await summary(conn, await lockOrder(conn, order.id_orden)),
      },
    }
  })
)

router.post(
  '/:id_orden/seguro',
  transaction(async (conn, req) => {
    const { monto, fecha_recibido, referencia_bancaria, concepto } = req.body
    if (!['pago_principal', 'dano_oculto', 'otro'].includes(concepto)) fail('Concepto inválido.')
    const order = await lockOrder(conn, req.params.id_orden)
    const balance = await summary(conn, order)

    let amount
    let extra = ''
    if (req.body.confirmar_excedente === true) {
      amount = cents(monto, 'Monto', true) / 100
      extra = allowExcess(req, amount, balance.disponible_seguro)
    } else {
      amount = validatePayment(order, balance, monto, 'seguro')
    }

    const [[maxRow]] = await conn.query(
      'SELECT COALESCE(MAX(num_pago), 0) + 1 AS next_num FROM pago_seguro WHERE id_orden = ?',
      [order.id_orden]
    )
    const numPago = maxRow.next_num
    const ref =
      rules.reference(referencia_bancaria, { label: 'Referencia bancaria', max: 100 }) ||
      `TRF-SEG-${order.id_orden}-${numPago}`
    const paidDate = paymentDate(fecha_recibido, 'Fecha de recibido') || new Date().toISOString().slice(0, 10)

    await conn.query(
      `INSERT INTO pago_seguro (id_orden, num_pago, monto, fecha_recibido, referencia_bancaria, concepto)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [order.id_orden, numPago, amount, String(paidDate).slice(0, 10), ref, concepto]
    )

    const packedId = packId(order.id_orden, numPago)
    await audit(conn, req, 'pago_seguro', `${order.id_orden}-${numPago}`, 'crear', `Cobro al seguro: C$ ${amount}.${extra}`)

    return {
      status: 201,
      data: {
        id: packedId,
        id_orden: order.id_orden,
        num_pago: numPago,
        monto: amount,
        estado: 'recibido',
        referencia_bancaria: ref,
        concepto,
        resumen: await summary(conn, await lockOrder(conn, order.id_orden)),
      },
    }
  })
)

for (const [path, table, payer] of [
  ['cliente', 'pago_cliente', 'cliente'],
  ['seguro', 'pago_seguro', 'seguro'],
]) {
  router.delete(
    `/${path}/:id`,
    requireAuth.admin,
    transaction(async (conn, req) => {
      const [id_orden, num_pago] = unpackId(req.params.id, 'Pago')
      const [rows] = await conn.query(`SELECT * FROM ${table} WHERE id_orden = ? AND num_pago = ? FOR UPDATE`, [
        id_orden,
        num_pago,
      ])
      if (!rows.length) fail('Pago no encontrado.', 404)
      const payment = rows[0]

      const order = await lockOrder(conn, id_orden, true)
      const balance = await summary(conn, order)
      if (balance.pagado || (payer === 'cliente' ? balance.cliente_pagado : balance.seguro_pagado)) {
        fail('La cuenta está pagada. No se puede eliminar el pago desde este flujo.', 409)
      }

      await conn.query(`DELETE FROM ${table} WHERE id_orden = ? AND num_pago = ?`, [id_orden, num_pago])
      await audit(
        conn,
        req,
        table,
        `${id_orden}-${num_pago}`,
        'eliminar',
        `Corrección de pago: C$ ${payment.monto}, orden #${order.id_orden}`
      )
      return {
        data: {
          message: 'Pago eliminado.',
          resumen: await summary(conn, await lockOrder(conn, id_orden)),
        },
      }
    })
  )
}

const changeOrderState = require('../handlers/changeOrderState')(pool)
router.patch('/:id_orden/entregar', (req, res) => {
  req.params.id = req.params.id_orden
  req.body = { ...req.body, estado: 'entregado' }
  return changeOrderState(req, res)
})

module.exports = router