// backend/src/routes/clientes.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const forms = require('../services/formValidation')
const { detectTipoDocumentoId, ensureMunicipioId } = require('../services/catalogs')

const router = express.Router()

const CLIENTE_SELECT = `
  SELECT
    c.id_cliente AS id,
    c.id_cliente,
    c.nombre,
    c.numero_documento AS cedula,
    c.numero_documento,
    c.id_tipo_documento,
    td.nombre AS tipo_documento,
    c.telefono,
    c.fecha_nacimiento,
    m.nombre AS municipio_residencia,
    c.id_municipio,
    c.direccion,
    c.fecha_creacion
  FROM cliente c
  JOIN municipio m ON m.id_municipio = c.id_municipio
  JOIN tipo_documento td ON td.id_tipo_documento = c.id_tipo_documento
`

// GET /api/clientes/buscar?cedula=
router.get('/buscar', requireAuth, async (req, res) => {
  const { cedula } = req.query
  if (!cedula || cedula.trim() === '') {
    return res.status(400).json({ message: 'La cédula o documento es requerido.' })
  }
  try {
    const normalized = (() => {
      try {
        return require('../services/fieldRules').cedula(cedula)
      } catch {
        return cedula.trim()
      }
    })()
    const [rows] = await pool.query(
      `${CLIENTE_SELECT} WHERE c.numero_documento = ? OR REPLACE(c.numero_documento, '-', '') = REPLACE(?, '-', '') LIMIT 1`,
      [normalized, normalized]
    )
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado.' })
    }
    res.json(rows[0])
  } catch (err) {
    console.error('Error al buscar cliente por cédula:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/clientes/sugerir
router.get('/sugerir', requireAuth, async (req, res) => {
  const { q, modo = 'nombre', fecha_desde, fecha_hasta } = req.query

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'Se necesitan al menos 2 caracteres.' })
  }

  const colMap = {
    nombre: 'c.nombre',
    municipio: 'm.nombre',
    telefono: 'c.telefono',
  }
  const campo = colMap[modo] || 'c.nombre'

  let sql = `${CLIENTE_SELECT} WHERE ${campo} LIKE ?`
  const params = [`%${q.trim()}%`]

  if (fecha_desde) {
    sql += ` AND DATE(c.fecha_creacion) >= ?`
    params.push(fecha_desde)
  }
  if (fecha_hasta) {
    sql += ` AND DATE(c.fecha_creacion) <= ?`
    params.push(fecha_hasta)
  }

  sql += ` ORDER BY c.nombre ASC`

  try {
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('Error al sugerir clientes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/clientes
router.post('/', requireAuth, forms.middleware(forms.client), async (req, res) => {
  const { nombre, cedula, telefono, fecha_nacimiento, municipio_residencia, direccion, id_tipo_documento } = req.body

  if (!nombre || !cedula || !telefono || !municipio_residencia) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [existe] = await conn.query(
      'SELECT id_cliente FROM cliente WHERE numero_documento = ? LIMIT 1',
      [cedula.trim()]
    )
    if (existe.length > 0) {
      await conn.rollback()
      return res.status(409).json({ message: 'Ya existe un cliente con ese documento.' })
    }

    const idMunicipio = await ensureMunicipioId(conn, municipio_residencia)
    const idTipoDoc = detectTipoDocumentoId(cedula, id_tipo_documento)

    const [result] = await conn.query(
      `INSERT INTO cliente
         (id_tipo_documento, numero_documento, nombre, telefono, fecha_nacimiento, id_municipio, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idTipoDoc,
        cedula.trim(),
        nombre.trim(),
        telefono.trim(),
        fecha_nacimiento || null,
        idMunicipio,
        direccion?.trim() || null,
      ]
    )

    await conn.commit()
    const [nuevo] = await pool.query(`${CLIENTE_SELECT} WHERE c.id_cliente = ?`, [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un registro con esa cédula o documento.' })
    }
    console.error('Error al crear cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

module.exports = router