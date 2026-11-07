// backend/src/routes/dashboard.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// ─── GET /api/dashboard/metricas ─────────────────────────────────────────────
// 4 números para las cards superiores: activas, listas, recibidas hoy, cobros pendientes.
router.get('/metricas', requireAuth, async (req, res) => {
  try {
    const [[{ activas }]] = await pool.query(
      `SELECT COUNT(*) AS activas FROM orden
       WHERE estado NOT IN ('entregado', 'cancelado')`
    )
    const [[{ listas }]] = await pool.query(
      `SELECT COUNT(*) AS listas FROM orden WHERE estado = 'listo'`
    )
    const [[{ hoy }]] = await pool.query(
      `SELECT COUNT(*) AS hoy FROM orden WHERE DATE(fecha_ingreso) = CURDATE()`
    )
    const [[{ cobros_pendientes }]] = await pool.query(
      `SELECT COALESCE(SUM(saldo_inicial), 0) AS cobros_pendientes FROM factura_seguro WHERE estado='pendiente'`
    )
    const [[{ facturas_pendientes }]] = await pool.query(
      `SELECT COUNT(*) AS facturas_pendientes FROM factura_seguro WHERE estado='pendiente'`
    )
    const [[{ sin_factura }]] = await pool.query(
      `SELECT COUNT(*) AS sin_factura FROM orden o WHERE o.estado='entregado' AND o.tipo_pago IN ('lafise','iniser')
       AND NOT EXISTS (SELECT 1 FROM factura_seguro f WHERE f.id_orden=o.id)`
    )
    res.json({ activas, listas, hoy, cobros_pendientes, facturas_pendientes, sin_factura })
  } catch (err) {
    console.error('Error en /dashboard/metricas:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/dashboard/breakdown-estados ────────────────────────────────────
// Conteo de órdenes agrupado por estado para el bloque visual de estado del taller.
router.get('/breakdown-estados', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT o.*,
      (SELECT f.estado FROM factura_seguro f WHERE f.id_orden=o.id) estado_factura,
      (SELECT COALESCE(SUM(monto),0) FROM pago_cliente WHERE id_orden=o.id) abonado_cliente,
      (SELECT COALESCE(SUM(monto),0) FROM pago_seguro WHERE id_orden=o.id AND estado='recibido') abonado_seguro
      FROM orden o`)
    const resultado = {recibido:0,en_proceso:0,listo:0,entregado:0,pagado:0,cancelado:0}
    for (const row of rows) {
      const paid = row.estado_factura ? row.estado_factura==='pagada' : require('../services/billing').calculateSummary(row,[{monto:row.abonado_cliente}],[{monto:row.abonado_seguro,estado:'recibido'}]).pagado
      const key = row.estado==='entregado' && paid ? 'pagado' : row.estado
      resultado[key]=(resultado[key] || 0)+1
    }
    res.json(resultado)
  } catch (err) {
    console.error('Error en /dashboard/breakdown-estados:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/dashboard/ordenes-recientes ────────────────────────────────────
// Últimas 8 órdenes activas (excluye entregado y cancelado), de más reciente a más antigua.
router.get('/ordenes-recientes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         o.id,
         o.tipo,
         o.estado,
         o.tipo_pago,
         o.fecha_ingreso,
         o.fecha_entrega_estimada,
         v.matricula,
         c.nombre AS nombre_cliente
       FROM orden o
       JOIN vehiculo v ON v.id = o.id_vehiculo
       JOIN cliente  c ON c.id = v.id_cliente
       WHERE o.estado NOT IN ('entregado', 'cancelado')
       ORDER BY o.fecha_ingreso DESC
       LIMIT 8`
    )
    res.json(rows)
  } catch (err) {
    console.error('Error en /dashboard/ordenes-recientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/dashboard/cobros-pendientes ────────────────────────────────────
// Cobros de aseguradora con estado = pendiente, con matrícula y tipo de pago de la orden.
router.get('/cobros-pendientes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id,f.id_orden,f.saldo_inicial AS monto,'factura_seguro' AS concepto,f.fecha_emision AS fecha_esperada,o.tipo_pago,v.matricula
       FROM factura_seguro f JOIN orden o ON o.id=f.id_orden JOIN vehiculo v ON v.id=o.id_vehiculo
       WHERE f.estado='pendiente' ORDER BY f.fecha_emision ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error('Error en /dashboard/cobros-pendientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/dashboard/stock-bajo ───────────────────────────────────────────
// Materiales donde cantidad <= stock_minimo. Incluye nombre del proveedor si tiene.
router.get('/stock-bajo', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         i.id,
         i.nombre,
         i.cantidad,
         i.stock_minimo,
         i.unidad_medida,
         p.nombre AS nombre_proveedor
       FROM inventario i
       LEFT JOIN proveedor p ON p.id = i.id_proveedor
       WHERE i.cantidad <= i.stock_minimo
       ORDER BY (i.cantidad / NULLIF(i.stock_minimo, 0)) ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error('Error en /dashboard/stock-bajo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/dashboard/liquidaciones-pendientes ─────────────────────────────
// Personal con montos en orden_personal que no están en ninguna liquidacion_personal pagada.
router.get('/liquidaciones-pendientes', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         pe.id                    AS id_personal,
         pe.nombre,
         pe.rol,
         COUNT(op.id)             AS ordenes_sin_liquidar,
         SUM(op.monto_acordado)   AS total_pendiente
       FROM orden_personal op
       JOIN personal pe ON pe.id = op.id_personal
       WHERE op.id NOT IN (
         SELECT ld.id_orden_personal
         FROM liquidacion_detalle ld
         JOIN liquidacion_personal lp ON lp.id = ld.id_liquidacion
         WHERE lp.pagado = TRUE
       )
       GROUP BY pe.id, pe.nombre, pe.rol
       HAVING total_pendiente > 0
       ORDER BY total_pendiente DESC`
    )
    res.json(rows)
  } catch (err) {
    console.error('Error en /dashboard/liquidaciones-pendientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router