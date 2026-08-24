// backend/src/routes/vehiculos.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// GET /api/vehiculos/buscar?matricula=XXXX&id_cliente=N
// (se mantiene, no hace conflicto)
router.get('/buscar', requireAuth, async (req, res) => {
  const { matricula } = req.query

  if (!matricula || matricula.trim() === '') {
    return res.status(400).json({ message: 'La matrícula es requerida.' })
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM vehiculo WHERE matricula = ? LIMIT 1',
      [matricula.trim()]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' })
    }

    const vehiculo = rows[0]

    const { id_cliente } = req.query
    if (id_cliente && vehiculo.id_cliente !== parseInt(id_cliente)) {
      return res.status(403).json({ message: 'Este vehículo no pertenece al cliente seleccionado.' })
    }

    res.json(vehiculo)
  } catch (err) {
    console.error('Error al buscar vehículo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/vehiculos/por-cliente/:id_cliente
router.get('/por-cliente/:id_cliente', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM vehiculo WHERE id_cliente = ? ORDER BY id ASC',
      [req.params.id_cliente]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener vehículos del cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/vehiculos
router.post('/', requireAuth, async (req, res) => {
  const {
    id_cliente, matricula, marca, modelo,
    anio_fabricacion, aseguradora, color,
    chasis, motor,
  } = req.body

  if (!id_cliente || !matricula || !marca || !modelo || !anio_fabricacion || !aseguradora || !color) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  try {
    const [existe] = await pool.query(
      'SELECT id FROM vehiculo WHERE matricula = ? LIMIT 1',
      [matricula.trim()]
    )
    if (existe.length > 0) {
      return res.status(409).json({ message: 'Ya existe un vehículo con esa matrícula.' })
    }

    const [result] = await pool.query(
      `INSERT INTO vehiculo
        (id_cliente, matricula, marca, modelo, anio_fabricacion, aseguradora, color, chasis, motor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_cliente,
        matricula.trim(),
        marca.trim(),
        modelo.trim(),
        anio_fabricacion,
        aseguradora,
        color.trim(),
        chasis?.trim() || null,
        motor?.trim()  || null,
      ]
    )

    const [nuevo] = await pool.query(
      'SELECT * FROM vehiculo WHERE id = ?',
      [result.insertId]
    )

    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear vehículo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router