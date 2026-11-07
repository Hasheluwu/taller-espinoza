// backend/src/routes/vehiculos.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const forms = require('../services/formValidation')
const { ensureModeloId, aseguradoraToId } = require('../services/catalogs')

const router = express.Router()

const VEHICULO_SELECT = `
  SELECT
    v.matricula AS id,
    v.matricula,
    v.id_cliente,
    v.id_modelo,
    ma.id_marca,
    ma.nombre AS marca,
    mo.nombre AS modelo,
    v.anio_fabricacion,
    CASE
      WHEN va.id_aseguradora = 1 THEN 'lafise'
      WHEN va.id_aseguradora = 2 THEN 'iniser'
      ELSE 'ninguna'
    END AS aseguradora,
    v.color,
    v.chasis,
    v.motor
  FROM vehiculo v
  JOIN modelo mo ON mo.id_modelo = v.id_modelo
  JOIN marca ma ON ma.id_marca = mo.id_marca
  LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
`

// GET /api/vehiculos/buscar?matricula=XXXX&id_cliente=N
router.get('/buscar', requireAuth, async (req, res) => {
  const { matricula } = req.query

  if (!matricula || matricula.trim() === '') {
    return res.status(400).json({ message: 'La matrícula es requerida.' })
  }

  try {
    const clean = matricula.trim().toUpperCase().replace(/[\s-]+/g, '')
    const [rows] = await pool.query(
      `${VEHICULO_SELECT}
       WHERE v.matricula = ? OR REPLACE(REPLACE(UPPER(v.matricula), ' ', ''), '-', '') = ?
       LIMIT 1`,
      [matricula.trim(), clean]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' })
    }

    const vehiculo = rows[0]

    const { id_cliente } = req.query
    if (id_cliente && vehiculo.id_cliente !== parseInt(id_cliente, 10)) {
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
      `${VEHICULO_SELECT} WHERE v.id_cliente = ? ORDER BY v.matricula ASC`,
      [req.params.id_cliente]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener vehículos del cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/vehiculos
router.post('/', requireAuth, forms.middleware(forms.vehicle), async (req, res) => {
  const { id_cliente, matricula, marca, modelo, anio_fabricacion, aseguradora, color, chasis, motor } = req.body

  if (!id_cliente || !matricula || !marca || !modelo || !anio_fabricacion || !aseguradora || !color) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [[owner]] = await conn.query('SELECT id_cliente FROM cliente WHERE id_cliente = ?', [id_cliente])
    if (!owner) {
      await conn.rollback()
      return res.status(404).json({ message: 'El cliente seleccionado no existe.' })
    }

    const cleanPlate = matricula.trim().toUpperCase().replace(/[\s-]+/g, '')
    const [existe] = await conn.query(
      `SELECT matricula FROM vehiculo
       WHERE matricula = ? OR REPLACE(REPLACE(UPPER(matricula), ' ', ''), '-', '') = ?
       LIMIT 1`,
      [matricula.trim(), cleanPlate]
    )
    if (existe.length > 0) {
      await conn.rollback()
      return res.status(409).json({ message: 'Ya existe un vehículo con esa matrícula.' })
    }

    const idModelo = await ensureModeloId(conn, marca, modelo)

    await conn.query(
      `INSERT INTO vehiculo
        (matricula, id_cliente, id_modelo, anio_fabricacion, color, chasis, motor)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        matricula.trim(),
        id_cliente,
        idModelo,
        anio_fabricacion,
        color.trim(),
        chasis?.trim() || null,
        motor?.trim() || null,
      ]
    )

    const idAseguradora = aseguradoraToId(aseguradora)
    if (idAseguradora) {
      await conn.query(
        'INSERT INTO vehiculo_aseguradora (matricula, id_aseguradora) VALUES (?, ?)',
        [matricula.trim(), idAseguradora]
      )
    }

    await conn.commit()

    const [nuevo] = await pool.query(`${VEHICULO_SELECT} WHERE v.matricula = ?`, [matricula.trim()])
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un vehículo con esa matrícula o chasis.' })
    }
    console.error('Error al crear vehículo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

module.exports = router