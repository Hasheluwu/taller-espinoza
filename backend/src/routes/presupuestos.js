// backend/src/routes/presupuestos.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const { resolveMatricula } = require('../services/catalogs')
const { packId, unpackId } = require('../services/validation')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))

// GET /api/presupuestos?id_vehiculo=X
router.get('/', requireAuth, async (req, res) => {
  const { id_vehiculo } = req.query
  if (!id_vehiculo) return res.status(400).json({ message: 'id_vehiculo es requerido.' })

  try {
    const matricula = await resolveMatricula(pool, id_vehiculo)
    if (!matricula) return res.json([])

    const [rows] = await pool.query(
      `SELECT
         id_presupuesto AS id,
         id_presupuesto,
         matricula AS id_vehiculo,
         matricula,
         fecha,
         estado,
         subtotal,
         iva,
         total,
         observaciones
       FROM vw_totales_presupuesto
       WHERE matricula = ?
       ORDER BY fecha DESC, id_presupuesto DESC`,
      [matricula]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener presupuestos:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/presupuestos
router.post('/', requireAuth, async (req, res) => {
  const { id_vehiculo, observaciones } = req.body
  if (!id_vehiculo) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  try {
    const matricula = await resolveMatricula(pool, id_vehiculo)
    if (!matricula) return res.status(404).json({ message: 'Vehículo no encontrado.' })

    const [result] = await pool.query(
      `INSERT INTO presupuesto (matricula, fecha, estado, observaciones)
       VALUES (?, CURDATE(), 'pendiente', ?)`,
      [matricula, observaciones?.trim() || null]
    )
    const [nuevo] = await pool.query(
      `SELECT id_presupuesto AS id, id_presupuesto, matricula AS id_vehiculo, matricula, fecha, estado, subtotal, iva, total, observaciones
       FROM vw_totales_presupuesto WHERE id_presupuesto = ?`,
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear presupuesto:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// PATCH /api/presupuestos/:id/estado
router.patch('/:id/estado', requireAuth, async (req, res) => {
  const { estado } = req.body
  const validEstados = ['pendiente', 'aprobado', 'rechazado']
  if (!validEstados.includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido.' })
  }

  try {
    await pool.query('UPDATE presupuesto SET estado = ? WHERE id_presupuesto = ?', [estado, req.params.id])
    const [updated] = await pool.query(
      `SELECT id_presupuesto AS id, id_presupuesto, matricula AS id_vehiculo, matricula, fecha, estado, subtotal, iva, total, observaciones
       FROM vw_totales_presupuesto WHERE id_presupuesto = ?`,
      [req.params.id]
    )
    res.json(updated[0])
  } catch (err) {
    console.error('Error al actualizar estado:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/presupuestos/:id/detalles
router.get('/:id/detalles', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM presupuesto_detalle WHERE id_presupuesto = ? ORDER BY num_linea ASC',
      [req.params.id]
    )
    res.json(
      rows.map(r => ({
        ...r,
        id: packId(r.id_presupuesto, r.num_linea),
        aplica_iva: Boolean(r.aplica_iva),
      }))
    )
  } catch (err) {
    console.error('Error al obtener detalles:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/presupuestos/:id/detalles
router.post('/:id/detalles', requireAuth, async (req, res) => {
  const { tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva } = req.body

  if (!tipo_linea || !descripcion || cantidad === undefined || precio_unitario === undefined) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  try {
    const [[maxRow]] = await pool.query(
      'SELECT COALESCE(MAX(num_linea), 0) + 1 AS next_linea FROM presupuesto_detalle WHERE id_presupuesto = ?',
      [req.params.id]
    )
    const numLinea = maxRow.next_linea

    await pool.query(
      `INSERT INTO presupuesto_detalle
        (id_presupuesto, num_linea, tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        numLinea,
        tipo_linea,
        descripcion.trim(),
        parseFloat(cantidad),
        parseFloat(precio_unitario),
        aplica_iva ? 1 : 0,
      ]
    )
    const [nuevo] = await pool.query(
      'SELECT * FROM presupuesto_detalle WHERE id_presupuesto = ? AND num_linea = ?',
      [req.params.id, numLinea]
    )
    res.status(201).json({
      ...nuevo[0],
      id: packId(nuevo[0].id_presupuesto, nuevo[0].num_linea),
      aplica_iva: Boolean(nuevo[0].aplica_iva),
    })
  } catch (err) {
    console.error('Error al crear detalle:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// DELETE /api/presupuestos/detalles/:id
router.delete('/detalles/:id', requireAuth, async (req, res) => {
  try {
    const [idPres, numLinea] = unpackId(req.params.id, 'Detalle de presupuesto')
    await pool.query('DELETE FROM presupuesto_detalle WHERE id_presupuesto = ? AND num_linea = ?', [idPres, numLinea])
    res.json({ message: 'Detalle eliminado.' })
  } catch (err) {
    console.error('Error al eliminar detalle:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router