// backend/src/routes/repuestos.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))

// ─── GET /api/repuestos/taller ────────────────────────────────────────────────
// Listar repuestos del taller con filtros
router.get('/taller', requireAuth, async (req, res) => {
  const { q, estado, origen } = req.query

  let sql = `SELECT * FROM repuesto_taller WHERE 1=1`
  const params = []

  if (q && q.trim()) {
    sql += ` AND (nombre LIKE ? OR marca LIKE ? OR modelo LIKE ? OR modelo_compatible LIKE ?)`
    const queryStr = `%${q.trim()}%`
    params.push(queryStr, queryStr, queryStr, queryStr)
  }

  if (estado) {
    sql += ` AND estado = ?`
    params.push(estado)
  }

  if (origen) {
    sql += ` AND origen = ?`
    params.push(origen)
  }

  sql += ` ORDER BY id DESC`

  try {
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener repuestos del taller:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── POST /api/repuestos/taller ───────────────────────────────────────────────
// Crear repuesto en el taller
router.post('/taller', requireAuth, async (req, res) => {
  const { nombre, marca, modelo, modelo_compatible, precio, cantidad = 1, estado, origen = 'comprado' } = req.body

  if (cantidad !== undefined && (!Number.isSafeInteger(Number(cantidad)) || Number(cantidad) < 0)) return res.status(400).json({ message: 'La cantidad debe ser un entero no negativo.' })
  if (!nombre || !marca || !modelo || precio === undefined || !estado) {
    return res.status(400).json({ message: 'Nombre, marca, modelo, precio y estado son requeridos.' })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO repuesto_taller
         (nombre, marca, modelo, modelo_compatible, precio, cantidad, estado, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre.trim(),
        marca.trim(),
        modelo.trim(),
        modelo_compatible ? modelo_compatible.trim() : null,
        Number(precio),
        Number(cantidad),
        estado,
        origen
      ]
    )

    const [nuevo] = await pool.query('SELECT * FROM repuesto_taller WHERE id = ?', [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error('Error al crear repuesto de taller:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── PUT /api/repuestos/taller/:id ────────────────────────────────────────────
// Editar repuesto del taller
router.put('/taller/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { nombre, marca, modelo, modelo_compatible, precio, cantidad, estado, origen } = req.body

  if (cantidad !== undefined && (!Number.isSafeInteger(Number(cantidad)) || Number(cantidad) < 0)) return res.status(400).json({ message: 'La cantidad debe ser un entero no negativo.' })
  if (!nombre || !marca || !modelo || precio === undefined || !estado) {
    return res.status(400).json({ message: 'Nombre, marca, modelo, precio y estado son requeridos.' })
  }

  try {
    await pool.query(
      `UPDATE repuesto_taller
       SET nombre = ?, marca = ?, modelo = ?, modelo_compatible = ?, precio = ?, cantidad = ?, estado = ?, origen = ?
       WHERE id = ?`,
      [
        nombre.trim(),
        marca.trim(),
        modelo.trim(),
        modelo_compatible ? modelo_compatible.trim() : null,
        Number(precio),
        Number(cantidad),
        estado,
        origen || 'comprado',
        id
      ]
    )

    const [actualizado] = await pool.query('SELECT * FROM repuesto_taller WHERE id = ?', [id])
    res.json(actualizado[0])
  } catch (err) {
    console.error('Error al editar repuesto de taller:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── DELETE /api/repuestos/taller/:id ─────────────────────────────────────────
// Eliminar repuesto de taller
router.delete('/taller/:id', requireAuth, requireAuth.admin, async (req, res) => {
  const { id } = req.params
  try {
    const [result] = await pool.query('DELETE FROM repuesto_taller WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Repuesto no encontrado.' })
    }
    res.json({ message: 'Repuesto de taller eliminado exitosamente.' })
  } catch (err) {
    console.error('Error al eliminar repuesto de taller:', err)
    res.status(500).json({ message: 'No se puede eliminar el repuesto porque está referenciado en órdenes u otros registros.' })
  }
})

// ─── GET /api/repuestos/cliente ───────────────────────────────────────────────
// Listar repuestos traídos por clientes (con join a orden, cliente y matrícula)
router.get('/cliente', requireAuth, async (req, res) => {
  const { q, estado } = req.query

  let sql = `
    SELECT rc.*,
           o.id AS orden_id, o.estado AS orden_estado,
           v.matricula, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo,
           c.nombre AS cliente_nombre
    FROM repuesto_cliente rc
    JOIN orden o ON rc.id_orden = o.id
    JOIN vehiculo v ON o.id_vehiculo = v.id
    JOIN cliente c ON v.id_cliente = c.id
    WHERE 1=1
  `
  const params = []

  if (q && q.trim()) {
    sql += ` AND (rc.nombre LIKE ? OR rc.marca LIKE ? OR c.nombre LIKE ? OR v.matricula LIKE ?)`
    const queryStr = `%${q.trim()}%`
    params.push(queryStr, queryStr, queryStr, queryStr)
  }

  if (estado) {
    sql += ` AND rc.estado = ?`
    params.push(estado)
  }

  sql += ` ORDER BY rc.id DESC`

  try {
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener repuestos de cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── PATCH /api/repuestos/cliente/:id/estado ─────────────────────────────────
// Cambiar estado de repuesto_cliente. Si pasa a 'transferido_a_taller',
// crea de forma atómica un registro en repuesto_taller.
router.patch('/cliente/:id/estado', requireAuth, async (req, res) => {
  const { id } = req.params
  const { nuevo_estado, precio_asignado = 0 } = req.body

  const estadosValidos = ['en_taller', 'devuelto', 'transferido_a_taller']
  if (!nuevo_estado || !estadosValidos.includes(nuevo_estado)) {
    return res.status(400).json({ message: 'Estado no válido.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Obtener repuesto_cliente actual
    const [rows] = await conn.query('SELECT * FROM repuesto_cliente WHERE id = ? FOR UPDATE', [id])
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Repuesto de cliente no encontrado.' })
    }

    const rc = rows[0]
    if (rc.estado === 'transferido_a_taller') {
      await conn.rollback()
      return res.status(409).json({ message: 'El repuesto ya fue transferido al taller y no puede volver a transferirse.' })
    }

    if (rc.estado === nuevo_estado) {
      await conn.rollback()
      return res.status(400).json({ message: `El repuesto ya se encuentra en estado '${nuevo_estado}'.` })
    }

    // 2. Actualizar estado en repuesto_cliente
    await conn.query('UPDATE repuesto_cliente SET estado = ? WHERE id = ?', [nuevo_estado, id])

    // 3. Si pasa a 'transferido_a_taller', crear registro en repuesto_taller
    if (nuevo_estado === 'transferido_a_taller') {
      await conn.query(
        `INSERT INTO repuesto_taller
           (nombre, marca, modelo, modelo_compatible, precio, cantidad, estado, origen)
         VALUES (?, ?, ?, ?, ?, ?, 'usado_bueno', 'proveniente_de_cliente')`,
        [
          rc.nombre,
          rc.marca,
          rc.modelo,
          `Transferido de orden #${rc.id_orden}`,
          Number(precio_asignado || 0),
          rc.cantidad || 1
        ]
      )
    }

    await conn.commit()

    const [actualizado] = await pool.query('SELECT * FROM repuesto_cliente WHERE id = ?', [id])
    res.json(actualizado[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al cambiar estado de repuesto de cliente:', err)
    res.status(500).json({ message: 'Error interno al actualizar estado del repuesto.' })
  } finally {
    conn.release()
  }
})

module.exports = router




