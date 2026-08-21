// backend/src/routes/clientes.js
const express    = require('express')
const pool       = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// GET /api/clientes/buscar?cedula=XXXX
router.get('/buscar', requireAuth, async (req, res) => {
  const { cedula } = req.query

  if (!cedula || cedula.trim() === '') {
    return res.status(400).json({ message: 'La cédula es requerida.' })
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM cliente WHERE cedula = ? LIMIT 1',
      [cedula.trim()]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado.' })
    }

    res.json(rows[0])
  } catch (err) {
    console.error('Error al buscar cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/clientes
router.post('/', requireAuth, async (req, res) => {
  const {
    nombre,
    cedula,
    telefono,
    fecha_nacimiento,      // nullable
    municipio_residencia,
    direccion,             // nullable
  } = req.body

  if (!nombre || !cedula || !telefono || !municipio_residencia) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  try {
    // Verificar que la cédula no exista ya
    const [existe] = await pool.query(
      'SELECT id FROM cliente WHERE cedula = ? LIMIT 1',
      [cedula.trim()]
    )
    if (existe.length > 0) {
      return res.status(409).json({ message: 'Ya existe un cliente con esa cédula.' })
    }

    const [result] = await pool.query(
      `INSERT INTO cliente
        (nombre, cedula, telefono, fecha_nacimiento, municipio_residencia, direccion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nombre.trim(),
        cedula.trim(),
        telefono.trim(),
        fecha_nacimiento || null,
        municipio_residencia.trim(),
        direccion?.trim() || null,
      ]
    )

    const [nuevo] = await pool.query(
      'SELECT * FROM cliente WHERE id = ?',
      [result.insertId]
    )

    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router