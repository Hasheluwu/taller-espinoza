// backend/src/routes/dashboard.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const {
  tipoOrdenToSlug,
  aseguradoraToSlug,
  unidadToSlug,
  especialidadToSlug,
} = require('../services/catalogs')
const { calculateSummary } = require('../services/billing')

const router = express.Router()

// GET /api/dashboard/metricas
router.get('/metricas', requireAuth, async (req, res) => {
  try {
    const [[{ activas }]] = await pool.query(
      `SELECT COUNT(*) AS activas FROM orden WHERE estado NOT IN ('entregado', 'cancelado')`
    )
    const [[{ listas }]] = await pool.query(`SELECT COUNT(*) AS listas FROM orden WHERE estado = 'listo'`)
    const [[{ hoy }]] = await pool.query(
      `SELECT COUNT(*) AS hoy FROM orden WHERE DATE(fecha_ingreso) = CURDATE()`
    )

    const [fsRows] = await pool.query(
      `SELECT
         fs.id_orden,
         (f.subtotal + f.iva) AS total_factura,
         COALESCE((SELECT SUM(ps.monto) FROM pago_seguro ps WHERE ps.id_orden = fs.id_orden), 0) AS pagado_seguro
       FROM factura_seguro fs
       JOIN factura f ON f.numero_factura = fs.numero_factura`
    )

    let cobros_pendientes = 0
    let facturas_pendientes = 0
    for (const r of fsRows) {
      const saldo = Math.max(0, Number(r.total_factura) - Number(r.pagado_seguro))
      if (saldo > 0) {
        cobros_pendientes += saldo
        facturas_pendientes += 1
      }
    }

    const [[{ sin_factura }]] = await pool.query(
      `SELECT COUNT(*) AS sin_factura
       FROM vw_totales_orden o
       WHERE o.estado = 'entregado'
         AND o.id_aseguradora IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM factura_seguro f WHERE f.id_orden = o.id_orden)`
    )

    res.json({
      activas: Number(activas),
      listas: Number(listas),
      hoy: Number(hoy),
      cobros_pendientes: Math.round(cobros_pendientes * 100) / 100,
      facturas_pendientes,
      sin_factura: Number(sin_factura),
    })
  } catch (err) {
    console.error('Error en /dashboard/metricas:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/dashboard/breakdown-estados
router.get('/breakdown-estados', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_totales_orden')
    const resultado = { recibido: 0, en_proceso: 0, listo: 0, entregado: 0, pagado: 0, cancelado: 0 }

    for (const row of rows) {
      const asegSlug = aseguradoraToSlug(row.id_aseguradora, row.nombre_aseguradora)
      const tipoPago = asegSlug === 'ninguna' ? 'particular' : asegSlug
      const esSeguro = tipoPago !== 'particular'
      const costoTotal = Number(row.costo_total || 0)
      const orderObj = {
        ...row,
        tipo_pago: tipoPago,
        costo_total: costoTotal,
        monto_seguro: esSeguro ? costoTotal : 0,
        monto_cliente: esSeguro ? 0 : costoTotal,
        pagador_unico: 1,
      }
      const paid = calculateSummary(
        orderObj,
        [{ monto: Number(row.abonado_cliente || 0) }],
        [{ monto: Number(row.abonado_seguro || 0), estado: 'recibido' }]
      ).pagado

      const key = row.estado === 'entregado' && paid ? 'pagado' : row.estado
      resultado[key] = (resultado[key] || 0) + 1
    }
    res.json(resultado)
  } catch (err) {
    console.error('Error en /dashboard/breakdown-estados:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/dashboard/ordenes-recientes
router.get('/ordenes-recientes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         o.id_orden AS id,
         o.id_orden,
         o.id_tipo_orden,
         o.estado,
         o.id_aseguradora,
         o.nombre_aseguradora,
         o.fecha_ingreso,
         o.fecha_entrega_estimada,
         v.matricula,
         c.nombre AS nombre_cliente
       FROM vw_totales_orden o
       JOIN vehiculo v ON v.matricula = o.matricula
       JOIN cliente c ON c.id_cliente = v.id_cliente
       WHERE o.estado NOT IN ('entregado', 'cancelado')
       ORDER BY o.fecha_ingreso DESC
       LIMIT 8`
    )
    res.json(
      rows.map(r => {
        const aseg = aseguradoraToSlug(r.id_aseguradora, r.nombre_aseguradora)
        return {
          ...r,
          tipo: tipoOrdenToSlug(r.id_tipo_orden),
          tipo_pago: aseg === 'ninguna' ? 'particular' : aseg,
        }
      })
    )
  } catch (err) {
    console.error('Error en /dashboard/ordenes-recientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/dashboard/cobros-pendientes
router.get('/cobros-pendientes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         fs.numero_factura AS id,
         fs.id_orden,
         (f.subtotal + f.iva) AS total_factura,
         f.fecha_emision AS fecha_esperada,
         o.id_aseguradora,
         o.nombre_aseguradora,
         o.matricula,
         COALESCE((SELECT SUM(ps.monto) FROM pago_seguro ps WHERE ps.id_orden = fs.id_orden), 0) AS pagado_seguro
       FROM factura_seguro fs
       JOIN factura f ON f.numero_factura = fs.numero_factura
       JOIN vw_totales_orden o ON o.id_orden = fs.id_orden
       ORDER BY f.fecha_emision ASC`
    )

    const pendientes = []
    for (const r of rows) {
      const saldo = Math.max(0, Number(r.total_factura) - Number(r.pagado_seguro))
      if (saldo > 0) {
        pendientes.push({
          id: r.id,
          id_orden: r.id_orden,
          monto: Math.round(saldo * 100) / 100,
          concepto: 'factura_seguro',
          fecha_esperada: r.fecha_esperada,
          tipo_pago: aseguradoraToSlug(r.id_aseguradora, r.nombre_aseguradora),
          matricula: r.matricula,
        })
      }
    }
    res.json(pendientes)
  } catch (err) {
    console.error('Error en /dashboard/cobros-pendientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/dashboard/stock-bajo
router.get('/stock-bajo', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         v.id_material AS id,
         v.id_material,
         v.nombre,
         v.stock_actual AS cantidad,
         v.stock_minimo,
         v.unidad_medida AS unidad_nombre,
         p.nombre AS nombre_proveedor
       FROM vw_stock_material v
       LEFT JOIN proveedor p ON p.id_proveedor = v.id_proveedor
       WHERE v.stock_actual <= v.stock_minimo
       ORDER BY (v.stock_actual / NULLIF(v.stock_minimo, 0)) ASC`
    )
    res.json(rows.map(r => ({ ...r, unidad_medida: unidadToSlug(r.unidad_nombre) })))
  } catch (err) {
    console.error('Error en /dashboard/stock-bajo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/dashboard/liquidaciones-pendientes
router.get('/liquidaciones-pendientes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         pe.id_personal,
         pe.nombre,
         (SELECT esp.id_especialidad FROM personal_especialidad esp WHERE esp.id_personal = pe.id_personal LIMIT 1) AS id_especialidad,
         COUNT(op.id_orden) AS ordenes_sin_liquidar,
         SUM(op.monto_acordado) AS total_pendiente
       FROM orden_personal op
       JOIN personal pe ON pe.id_personal = op.id_personal
       WHERE NOT EXISTS (
         SELECT 1
         FROM liquidacion_detalle ld
         JOIN liquidacion l ON l.id_liquidacion = ld.id_liquidacion
         WHERE ld.id_orden = op.id_orden
           AND ld.id_personal = op.id_personal
           AND l.fecha_pago IS NOT NULL
       )
       GROUP BY pe.id_personal, pe.nombre
       HAVING total_pendiente > 0
       ORDER BY total_pendiente DESC`
    )
    res.json(
      rows.map(r => ({
        ...r,
        rol: especialidadToSlug(r.id_especialidad),
      }))
    )
  } catch (err) {
    console.error('Error en /dashboard/liquidaciones-pendientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router