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
      `SELECT COALESCE(SUM(ps.monto), 0) AS cobros_pendientes
       FROM pago_seguro ps
       WHERE ps.estado = 'pendiente'`
    )
    res.json({ activas, listas, hoy, cobros_pendientes })
  } catch (err) {
    console.error('Error en /dashboard/metricas:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/dashboard/breakdown-estados ────────────────────────────────────
// Conteo de órdenes agrupado por estado para el bloque visual de estado del taller.
router.get('/breakdown-estados', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT estado, COUNT(*) AS total FROM orden GROUP BY estado`
    )
    const resultado = {
      recibido: 0, en_proceso: 0, listo: 0, entregado: 0, cancelado: 0,
    }
    rows.forEach(r => { resultado[r.estado] = r.total })
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
      `SELECT
         ps.id,
         ps.monto,
         ps.concepto,
         ps.fecha_esperada,
         o.tipo_pago,
         v.matricula
       FROM pago_seguro ps
       JOIN orden    o ON o.id = ps.id_orden
       JOIN vehiculo v ON v.id = o.id_vehiculo
       WHERE ps.estado = 'pendiente'
       ORDER BY ps.fecha_esperada ASC`
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