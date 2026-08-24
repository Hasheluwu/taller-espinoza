// backend/src/routes/presupuestos.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

const IVA_RATE = 0.15 // IVA Nicaragua 15%

// GET /api/presupuestos?id_vehiculo=N
// Todos los presupuestos de un vehículo
router.get('/', requireAuth, async (req, res) => {
  const { id_vehiculo } = req.query
  if (!id_vehiculo) return res.status(400).json({ message: 'id_vehiculo es requerido.' })

  try {
    const [rows] = await pool.query(
      'SELECT * FROM presupuesto WHERE id_vehiculo = ? ORDER BY fecha DESC, id DESC',
      [id_vehiculo]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener presupuestos:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/presupuestos
// Crear presupuesto — fecha y estado los pone el backend
router.post('/', requireAuth, async (req, res) => {
  const { id_vehiculo, subtotal, observaciones } = req.body

  if (!id_vehiculo || subtotal === undefined || subtotal === '') {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  const sub   = parseFloat(subtotal)
  const iva   = parseFloat((sub * IVA_RATE).toFixed(2))
  const total = parseFloat((sub + iva).toFixed(2))

  try {
    const [result] = await pool.query(
      `INSERT INTO presupuesto (id_vehiculo, fecha, estado, subtotal, iva, total, observaciones)
       VALUES (?, CURDATE(), 'pendiente', ?, ?, ?, ?)`,
      [id_vehiculo, sub, iva, total, observaciones?.trim() || null]
    )
    const [nuevo] = await pool.query('SELECT * FROM presupuesto WHERE id = ?', [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear presupuesto:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// PATCH /api/presupuestos/:id/estado
// Cambiar estado: aprobado | rechazado | pendiente
router.patch('/:id/estado', requireAuth, async (req, res) => {
  const { estado } = req.body
  const validEstados = ['pendiente', 'aprobado', 'rechazado']
  if (!validEstados.includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido.' })
  }

  try {
    await pool.query('UPDATE presupuesto SET estado = ? WHERE id = ?', [estado, req.params.id])
    const [updated] = await pool.query('SELECT * FROM presupuesto WHERE id = ?', [req.params.id])
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
      'SELECT * FROM presupuesto_detalle WHERE id_presupuesto = ? ORDER BY id ASC',
      [req.params.id]
    )
    res.json(rows)
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
    const [result] = await pool.query(
      `INSERT INTO presupuesto_detalle
        (id_presupuesto, tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        tipo_linea,
        descripcion.trim(),
        parseFloat(cantidad),
        parseFloat(precio_unitario),
        aplica_iva ? 1 : 0,
      ]
    )
    const [nuevo] = await pool.query(
      'SELECT * FROM presupuesto_detalle WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear detalle:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// DELETE /api/presupuestos/detalles/:id
router.delete('/detalles/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM presupuesto_detalle WHERE id = ?', [req.params.id])
    res.json({ message: 'Detalle eliminado.' })
  } catch (err) {
    console.error('Error al eliminar detalle:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router