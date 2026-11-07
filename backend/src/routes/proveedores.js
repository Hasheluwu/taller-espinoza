// backend/src/routes/proveedores.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// GET /api/proveedores
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_proveedor AS id, id_proveedor, nombre, contacto, emite_factura_iva, fijo FROM proveedor ORDER BY nombre ASC'
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener proveedores:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/proveedores
router.post('/', requireAuth, async (req, res) => {
  const { nombre, contacto, emite_factura_iva, fijo } = req.body

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: 'El nombre del proveedor es obligatorio.' })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO proveedor (nombre, contacto, emite_factura_iva, fijo)
       VALUES (?, ?, ?, ?)`,
      [
        nombre.trim(),
        contacto ? contacto.trim() : null,
        Boolean(emite_factura_iva),
        Boolean(fijo),
      ]
    )

    const [nuevo] = await pool.query(
      'SELECT id_proveedor AS id, id_proveedor, nombre, contacto, emite_factura_iva, fijo FROM proveedor WHERE id_proveedor = ?',
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear proveedor:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router