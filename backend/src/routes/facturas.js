// backend/src/routes/facturas.js
const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const service = require('../services/insuranceInvoices')
const { lockOrder, fail } = require('../services/validation')
const { aseguradoraToSlug } = require('../services/catalogs')

const router = express.Router()
router.use(auth)
router.use((req, res, next) =>
  ['administrador', 'secretaria'].includes(req.usuario.rol)
    ? next()
    : res.status(403).json({ message: 'No tienes permiso para gestionar facturas.' })
)

function run(fn) {
  return async (req, res, next) => {
    let conn
    try {
      conn = await pool.getConnection()
      await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
      await conn.beginTransaction()
      const result = await fn(conn, req)
      await conn.commit()
      res.json(result)
    } catch (e) {
      if (conn) await conn.rollback()
      next(e)
    } finally {
      conn?.release()
    }
  }
}

router.get(
  '/',
  run(async (conn, req) => {
    const state = req.query.estado || 'pendiente'
    if (!['pendiente', 'pagada', 'sin_factura'].includes(state)) fail('Estado de factura inválido.')

    const [missingRows] = await conn.query(`
      SELECT
        o.id_orden,
        o.id_aseguradora,
        o.nombre_aseguradora,
        o.costo_total,
        o.monto_autorizado,
        o.fecha_entrega_real,
        c.nombre AS cliente,
        v.matricula
      FROM vw_totales_orden o
      JOIN vehiculo v ON v.matricula = o.matricula
      JOIN cliente c ON c.id_cliente = v.id_cliente
      WHERE o.estado = 'entregado'
        AND o.id_aseguradora IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM factura_seguro fs WHERE fs.id_orden = o.id_orden)
      ORDER BY o.id_orden DESC
    `)

    const formattedMissing = missingRows.map(r => ({
      id_orden: r.id_orden,
      aseguradora: aseguradoraToSlug(r.id_aseguradora, r.nombre_aseguradora),
      monto_seguro: Number(r.costo_total || r.monto_autorizado || 0),
      fecha_entrega_real: r.fecha_entrega_real,
      cliente: r.cliente,
      matricula: r.matricula,
    }))

    const [fsList] = await conn.query(
      `SELECT fs.numero_factura, fs.id_orden
       FROM factura_seguro fs
       JOIN factura f ON f.numero_factura = fs.numero_factura
       ORDER BY f.fecha_emision DESC, fs.numero_factura DESC`
    )

    const allInvoices = []
    for (const item of fsList) {
      const inv = await service.existing(conn, item.id_orden)
      if (inv) {
        allInvoices.push({
          id: inv.numero_factura,
          numero_factura: inv.numero_factura,
          id_orden: inv.id_orden,
          aseguradora: inv.aseguradora,
          total: inv.total,
          saldo_inicial: inv.saldo_inicial,
          estado: inv.estado,
          fecha_emision: inv.fecha_emision,
          fecha_pago: inv.fecha_pago,
          cliente: inv.documento.cliente,
          matricula: inv.documento.vehiculo.matricula,
        })
      }
    }

    const pendientes = allInvoices.filter(i => i.estado === 'pendiente')
    const pagadas = allInvoices.filter(i => i.estado === 'pagada')

    const rows =
      state === 'sin_factura' ? formattedMissing : state === 'pagada' ? pagadas : pendientes

    return {
      rows,
      totals: {
        pendiente: pendientes.reduce((s, i) => s + Number(i.saldo_inicial || 0), 0),
        pagado: pagadas.reduce((s, i) => s + Number(i.total || 0), 0),
        facturas_pendientes: pendientes.length,
        facturas_pagadas: pagadas.length,
        sin_factura: formattedMissing.length,
      },
    }
  })
)

router.get(
  '/orden/:id',
  run(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id)
    const invoice = await service.existing(conn, order.id_orden)
    return (
      invoice || {
        estado: 'vista_previa',
        id_orden: order.id_orden,
        documento: await service.preview(conn, order),
        puede_emitir: ['listo', 'entregado'].includes(order.estado),
      }
    )
  })
)

router.post('/orden/:id', run((conn, req) => service.issue(conn, req.params.id, req.usuario.id)))
router.post('/orden/:id/pagar', run((conn, req) => service.pay(conn, req.params.id, req.body, req.usuario.id)))

module.exports = router