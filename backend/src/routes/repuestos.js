// backend/src/routes/repuestos.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const {
  ensureModeloId,
  condicionRepuestoToId,
  condicionRepuestoToSlug,
} = require('../services/catalogs')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))

const REPUESTO_TALLER_SELECT = `
  SELECT
    v.id_repuesto AS id,
    v.id_repuesto,
    v.nombre,
    v.marca,
    v.modelo,
    (
      SELECT GROUP_CONCAT(CONCAT(ma2.nombre, ' ', mo2.nombre) SEPARATOR ', ')
      FROM compatibilidad_repuesto cr2
      JOIN modelo mo2 ON mo2.id_modelo = cr2.id_modelo
      JOIN marca ma2 ON ma2.id_marca = mo2.id_marca
      WHERE cr2.id_repuesto = v.id_repuesto
    ) AS modelo_compatible,
    v.precio,
    v.stock_disponible AS cantidad,
    v.cantidad_ingresada,
    v.id_condicion,
    CASE
      WHEN EXISTS (SELECT 1 FROM transferencia_repuesto tr WHERE tr.id_repuesto = v.id_repuesto)
        THEN 'proveniente_de_cliente'
      ELSE 'comprado'
    END AS origen,
    v.fecha_ingreso
  FROM vw_stock_repuesto_taller v
`

const REPUESTO_CLIENTE_SELECT = `
  SELECT
    CONCAT(rc.id_orden, '-', rc.num_item) AS id,
    rc.id_orden,
    rc.num_item,
    rc.nombre,
    ma.nombre AS marca,
    mo.nombre AS modelo,
    rc.cantidad,
    CASE
      WHEN tr.id_repuesto IS NOT NULL THEN 'transferido_a_taller'
      ELSE rc.estado
    END AS estado,
    rc.descripcion,
    o.id_orden AS orden_id,
    o.estado AS orden_estado,
    v.matricula,
    vma.nombre AS vehiculo_marca,
    vmo.nombre AS vehiculo_modelo,
    c.nombre AS cliente_nombre
  FROM repuesto_cliente rc
  JOIN modelo mo ON mo.id_modelo = rc.id_modelo
  JOIN marca ma ON ma.id_marca = mo.id_marca
  LEFT JOIN transferencia_repuesto tr ON tr.id_orden = rc.id_orden AND tr.num_item = rc.num_item
  JOIN orden o ON rc.id_orden = o.id_orden
  JOIN vehiculo v ON o.matricula = v.matricula
  JOIN modelo vmo ON vmo.id_modelo = v.id_modelo
  JOIN marca vma ON vma.id_marca = vmo.id_marca
  JOIN cliente c ON v.id_cliente = c.id_cliente
`

function formatRepuestoRow(row) {
  return {
    ...row,
    estado: condicionRepuestoToSlug(row.id_condicion),
  }
}

// GET /api/repuestos/taller
router.get('/taller', requireAuth, async (req, res) => {
  const { q, estado, origen } = req.query

  let sql = `${REPUESTO_TALLER_SELECT} WHERE 1=1`
  const params = []

  if (q && q.trim()) {
    sql += ` AND (v.nombre LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ?)`
    const queryStr = `%${q.trim()}%`
    params.push(queryStr, queryStr, queryStr)
  }

  if (estado) {
    sql += ` AND v.id_condicion = ?`
    params.push(condicionRepuestoToId(estado))
  }

  if (origen) {
    if (origen === 'proveniente_de_cliente') {
      sql += ` AND EXISTS (SELECT 1 FROM transferencia_repuesto tr WHERE tr.id_repuesto = v.id_repuesto)`
    } else {
      sql += ` AND NOT EXISTS (SELECT 1 FROM transferencia_repuesto tr WHERE tr.id_repuesto = v.id_repuesto)`
    }
  }

  sql += ` ORDER BY v.id_repuesto DESC`

  try {
    const [rows] = await pool.query(sql, params)
    res.json(rows.map(formatRepuestoRow))
  } catch (err) {
    console.error('Error al obtener repuestos del taller:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/repuestos/taller
router.post('/taller', requireAuth, async (req, res) => {
  const { nombre, marca, modelo, precio, cantidad = 1, estado } = req.body

  if (cantidad !== undefined && (!Number.isSafeInteger(Number(cantidad)) || Number(cantidad) <= 0)) {
    return res.status(400).json({ message: 'La cantidad ingresada debe ser un entero positivo.' })
  }
  if (!nombre || !marca || !modelo || precio === undefined || !estado) {
    return res.status(400).json({ message: 'Nombre, marca, modelo, precio y estado son requeridos.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const idModelo = await ensureModeloId(conn, marca, modelo)
    const idCondicion = condicionRepuestoToId(estado)

    const [result] = await conn.query(
      `INSERT INTO repuesto_taller
         (nombre, id_modelo, precio, cantidad_ingresada, id_condicion, fecha_ingreso)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [nombre.trim(), idModelo, Number(precio), Number(cantidad), idCondicion]
    )

    await conn.query(
      'INSERT IGNORE INTO compatibilidad_repuesto (id_repuesto, id_modelo) VALUES (?, ?)',
      [result.insertId, idModelo]
    )

    await conn.commit()

    const [nuevo] = await pool.query(`${REPUESTO_TALLER_SELECT} WHERE v.id_repuesto = ?`, [result.insertId])
    res.status(201).json(formatRepuestoRow(nuevo[0]))
  } catch (err) {
    await conn.rollback()
    console.error('Error al crear repuesto de taller:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// PUT /api/repuestos/taller/:id
router.put('/taller/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { nombre, marca, modelo, precio, cantidad, estado } = req.body

  if (cantidad !== undefined && (!Number.isSafeInteger(Number(cantidad)) || Number(cantidad) <= 0)) {
    return res.status(400).json({ message: 'La cantidad debe ser un entero positivo.' })
  }
  if (!nombre || !marca || !modelo || precio === undefined || !estado) {
    return res.status(400).json({ message: 'Nombre, marca, modelo, precio y estado son requeridos.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const idModelo = await ensureModeloId(conn, marca, modelo)
    const idCondicion = condicionRepuestoToId(estado)

    await conn.query(
      `UPDATE repuesto_taller
       SET nombre = ?, id_modelo = ?, precio = ?, cantidad_ingresada = COALESCE(?, cantidad_ingresada), id_condicion = ?
       WHERE id_repuesto = ?`,
      [nombre.trim(), idModelo, Number(precio), cantidad !== undefined ? Number(cantidad) : null, idCondicion, id]
    )

    await conn.query(
      'INSERT IGNORE INTO compatibilidad_repuesto (id_repuesto, id_modelo) VALUES (?, ?)',
      [id, idModelo]
    )

    await conn.commit()

    const [actualizado] = await pool.query(`${REPUESTO_TALLER_SELECT} WHERE v.id_repuesto = ?`, [id])
    res.json(formatRepuestoRow(actualizado[0]))
  } catch (err) {
    await conn.rollback()
    console.error('Error al editar repuesto de taller:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// DELETE /api/repuestos/taller/:id
router.delete('/taller/:id', requireAuth, requireAuth.admin, async (req, res) => {
  const { id } = req.params
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('DELETE FROM compatibilidad_repuesto WHERE id_repuesto = ?', [id])
    const [result] = await conn.query('DELETE FROM repuesto_taller WHERE id_repuesto = ?', [id])
    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Repuesto no encontrado.' })
    }
    await conn.commit()
    res.json({ message: 'Repuesto de taller eliminado exitosamente.' })
  } catch (err) {
    await conn.rollback()
    console.error('Error al eliminar repuesto de taller:', err)
    res.status(500).json({
      message: 'No se puede eliminar el repuesto porque está referenciado en órdenes u otros registros.',
    })
  } finally {
    conn.release()
  }
})

// GET /api/repuestos/cliente
router.get('/cliente', requireAuth, async (req, res) => {
  const { q, estado } = req.query

  let sql = `${REPUESTO_CLIENTE_SELECT} WHERE 1=1`
  const params = []

  if (q && q.trim()) {
    sql += ` AND (rc.nombre LIKE ? OR ma.nombre LIKE ? OR c.nombre LIKE ? OR v.matricula LIKE ?)`
    const queryStr = `%${q.trim()}%`
    params.push(queryStr, queryStr, queryStr, queryStr)
  }

  sql += ` ORDER BY rc.id_orden DESC, rc.num_item ASC`

  try {
    const [rows] = await pool.query(sql, params)
    const filtered = estado ? rows.filter(r => r.estado === estado) : rows
    res.json(filtered)
  } catch (err) {
    console.error('Error al obtener repuestos de cliente:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/repuestos/cliente
// Registrar un repuesto traído o dejado por el cliente asociado a una orden
router.post('/cliente', requireAuth, async (req, res) => {
  const {
    id_orden,
    nombre,
    marca,
    modelo,
    cantidad = 1,
    estado = 'en_taller',
    descripcion,
  } = req.body

  const idOrden = parseInt(id_orden, 10)
  if (!Number.isSafeInteger(idOrden) || idOrden <= 0) {
    return res.status(400).json({ message: 'Debes seleccionar una orden de trabajo válida.' })
  }
  if (!nombre || !String(nombre).trim() || String(nombre).trim().length > 150) {
    return res.status(400).json({ message: 'El nombre del repuesto es obligatorio (máximo 150 caracteres).' })
  }
  const cant = Number(cantidad)
  if (!Number.isSafeInteger(cant) || cant <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser un número entero mayor a cero.' })
  }
  if (!['en_taller', 'devuelto'].includes(estado)) {
    return res.status(400).json({ message: 'El estado inicial debe ser "en_taller" o "devuelto".' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1. Verificar que la orden exista y obtener el modelo del vehículo por defecto
    const [ordenRows] = await conn.query(
      `SELECT o.id_orden, o.estado, o.matricula, v.id_modelo
       FROM orden o
       JOIN vehiculo v ON v.matricula = o.matricula
       WHERE o.id_orden = ? FOR UPDATE`,
      [idOrden]
    )
    if (ordenRows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'La orden seleccionada no existe.' })
    }
    if (ordenRows[0].estado === 'cancelado') {
      await conn.rollback()
      return res.status(409).json({ message: 'No se pueden asociar repuestos a una orden cancelada.' })
    }

    // 2. Determinar id_modelo (si envió marca y modelo los normaliza, si no usa el del vehículo de la orden)
    let idModelo = ordenRows[0].id_modelo
    if (marca && String(marca).trim() && modelo && String(modelo).trim()) {
      idModelo = await ensureModeloId(conn, marca.trim(), modelo.trim())
    }

    // 3. Calcular el siguiente num_item correlativo para esta orden
    const [[maxItem]] = await conn.query(
      'SELECT COALESCE(MAX(num_item), 0) + 1 AS next_item FROM repuesto_cliente WHERE id_orden = ?',
      [idOrden]
    )
    const numItem = maxItem.next_item

    // 4. Insertar en repuesto_cliente
    await conn.query(
      `INSERT INTO repuesto_cliente
         (id_orden, num_item, nombre, id_modelo, cantidad, estado, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idOrden,
        numItem,
        String(nombre).trim(),
        idModelo,
        cant,
        estado,
        descripcion && String(descripcion).trim() ? String(descripcion).trim() : null,
      ]
    )

    // 5. Registrar en auditoría
    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
       VALUES (?, 'repuesto_cliente', ?, 'crear', ?)`,
      [
        req.usuario.id,
        `${idOrden}-${numItem}`,
        `Repuesto de cliente registrado en orden #${idOrden}: ${String(nombre).trim()} (x${cant})`,
      ]
    )

    await conn.commit()

    const [nuevo] = await pool.query(
      `${REPUESTO_CLIENTE_SELECT} WHERE rc.id_orden = ? AND rc.num_item = ?`,
      [idOrden, numItem]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al crear repuesto de cliente:', err)
    res.status(500).json({ message: 'Error interno al registrar el repuesto del cliente.' })
  } finally {
    conn.release()
  }
})

// PATCH /api/repuestos/cliente/:id/estado
router.patch('/cliente/:id/estado', requireAuth, async (req, res) => {
  const { id } = req.params
  const { nuevo_estado, precio_asignado = 0 } = req.body

  const estadosValidos = ['en_taller', 'devuelto', 'transferido_a_taller']
  if (!nuevo_estado || !estadosValidos.includes(nuevo_estado)) {
    return res.status(400).json({ message: 'Estado no válido.' })
  }

  const [idOrdenStr, numItemStr] = String(id).split('-')
  const idOrden = parseInt(idOrdenStr, 10)
  const numItem = parseInt(numItemStr || '1', 10)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rows] = await conn.query(
      `SELECT rc.*, tr.id_repuesto AS transferido_id
       FROM repuesto_cliente rc
       LEFT JOIN transferencia_repuesto tr ON tr.id_orden = rc.id_orden AND tr.num_item = rc.num_item
       WHERE rc.id_orden = ? AND rc.num_item = ? FOR UPDATE`,
      [idOrden, numItem]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Repuesto de cliente no encontrado.' })
    }

    const rc = rows[0]
    if (rc.transferido_id) {
      await conn.rollback()
      return res.status(409).json({
        message: 'El repuesto ya fue transferido al taller y no puede volver a transferirse.',
      })
    }

    if (nuevo_estado === 'transferido_a_taller') {
      await conn.query(
        'UPDATE repuesto_cliente SET estado = ? WHERE id_orden = ? AND num_item = ?',
        ['en_taller', idOrden, numItem]
      )
      const [repRes] = await conn.query(
        `INSERT INTO repuesto_taller
           (nombre, id_modelo, precio, cantidad_ingresada, id_condicion, fecha_ingreso)
         VALUES (?, ?, ?, ?, 2, CURDATE())`,
        [rc.nombre, rc.id_modelo, Number(precio_asignado || 0), rc.cantidad || 1]
      )
      await conn.query(
        'INSERT IGNORE INTO compatibilidad_repuesto (id_repuesto, id_modelo) VALUES (?, ?)',
        [repRes.insertId, rc.id_modelo]
      )
      await conn.query(
        'INSERT INTO transferencia_repuesto (id_orden, num_item, id_repuesto) VALUES (?, ?, ?)',
        [idOrden, numItem, repRes.insertId]
      )
    } else {
      await conn.query(
        'UPDATE repuesto_cliente SET estado = ? WHERE id_orden = ? AND num_item = ?',
        [nuevo_estado, idOrden, numItem]
      )
    }

    await conn.commit()
    res.json({ id, id_orden: idOrden, num_item: numItem, estado: nuevo_estado })
  } catch (err) {
    await conn.rollback()
    console.error('Error al cambiar estado de repuesto de cliente:', err)
    res.status(500).json({ message: 'Error interno al actualizar estado del repuesto.' })
  } finally {
    conn.release()
  }
})

module.exports = router