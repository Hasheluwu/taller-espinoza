// backend/src/routes/inventario.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const forms = require('../services/formValidation')
const { ensureUnidadId, unidadToSlug } = require('../services/catalogs')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))

const INVENTARIO_SELECT = `
  SELECT
    v.id_material AS id,
    v.id_material,
    v.id_proveedor,
    v.nombre,
    v.precio_unidad,
    v.stock_actual AS cantidad,
    v.stock_actual,
    v.stock_minimo,
    v.id_unidad,
    v.unidad_medida AS unidad_nombre,
    v.fecha_expiracion,
    p.nombre AS proveedor_nombre,
    p.emite_factura_iva AS proveedor_emite_iva
  FROM vw_stock_material v
  LEFT JOIN proveedor p ON v.id_proveedor = p.id_proveedor
`

function formatMaterialRow(row) {
  return {
    ...row,
    unidad_medida: unidadToSlug(row.unidad_nombre),
  }
}

// GET /api/inventario
router.get('/', requireAuth, async (req, res) => {
  const { proveedor_id, unidad_medida, stock_bajo, expiracion_proxima, q } = req.query

  let sql = `${INVENTARIO_SELECT} WHERE 1=1`
  const params = []

  if (q && q.trim()) {
    sql += ` AND (v.nombre LIKE ? OR p.nombre LIKE ?)`
    params.push(`%${q.trim()}%`, `%${q.trim()}%`)
  }

  if (proveedor_id) {
    sql += ` AND v.id_proveedor = ?`
    params.push(proveedor_id)
  }

  if (stock_bajo === 'true') {
    sql += ` AND v.stock_actual <= v.stock_minimo`
  }

  if (expiracion_proxima === 'true') {
    sql += ` AND v.fecha_expiracion IS NOT NULL AND v.fecha_expiracion <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`
  }

  sql += ` ORDER BY v.nombre ASC`

  try {
    const [rows] = await pool.query(sql, params)
    let formatted = rows.map(formatMaterialRow)
    if (unidad_medida) {
      formatted = formatted.filter(r => r.unidad_medida === unidad_medida.toLowerCase())
    }
    res.json(formatted)
  } catch (err) {
    console.error('Error al obtener inventario:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/inventario
router.post(
  '/',
  requireAuth,
  forms.middleware(b => {
    b.nombre = forms.text(b.nombre, 'Nombre del producto', 150)
  }),
  async (req, res) => {
    const {
      nombre,
      precio_unidad,
      cantidad = 0,
      stock_minimo = 0,
      unidad_medida,
      fecha_expiracion,
      id_proveedor,
      nuevo_proveedor,
    } = req.body

    if (!nombre || !nombre.trim() || precio_unidad === undefined || !unidad_medida) {
      return res.status(400).json({ message: 'Nombre, precio unitario y unidad de medida son obligatorios.' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      let finalProveedorId = id_proveedor || null

      if (!finalProveedorId && nuevo_proveedor && nuevo_proveedor.nombre && nuevo_proveedor.nombre.trim()) {
        const [provResult] = await conn.query(
          `INSERT INTO proveedor (nombre, contacto, emite_factura_iva, fijo) VALUES (?, ?, ?, ?)`,
          [
            nuevo_proveedor.nombre.trim(),
            nuevo_proveedor.contacto ? nuevo_proveedor.contacto.trim() : null,
            Boolean(nuevo_proveedor.emite_factura_iva),
            Boolean(nuevo_proveedor.fijo),
          ]
        )
        finalProveedorId = provResult.insertId
      }

      const idUnidad = await ensureUnidadId(conn, unidad_medida)

      const [result] = await conn.query(
        `INSERT INTO material
           (id_proveedor, nombre, precio_unidad, stock_minimo, id_unidad, fecha_expiracion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          finalProveedorId,
          nombre.trim(),
          Number(precio_unidad),
          Number(stock_minimo),
          idUnidad,
          fecha_expiracion || null,
        ]
      )

      const newId = result.insertId

      if (Number(cantidad) > 0) {
        await conn.query(
          `INSERT INTO ajuste_material (id_material, cantidad, id_usuario, nota)
           VALUES (?, ?, ?, 'Stock inicial registrado')`,
          [newId, Number(cantidad), req.usuario.id]
        )
      }

      await conn.commit()

      const [nuevo] = await pool.query(`${INVENTARIO_SELECT} WHERE v.id_material = ?`, [newId])
      res.status(201).json(formatMaterialRow(nuevo[0]))
    } catch (err) {
      await conn.rollback()
      console.error('Error al crear producto de inventario:', err)
      res.status(500).json({ message: 'Error interno del servidor.' })
    } finally {
      conn.release()
    }
  }
)

// PUT /api/inventario/:id
router.put(
  '/:id',
  requireAuth,
  forms.middleware(b => {
    b.nombre = forms.text(b.nombre, 'Nombre del producto', 150)
  }),
  async (req, res) => {
    const { id } = req.params
    const { nombre, precio_unidad, stock_minimo, unidad_medida, fecha_expiracion, id_proveedor } = req.body

    if (!nombre || !nombre.trim() || precio_unidad === undefined || !unidad_medida) {
      return res.status(400).json({ message: 'Campos requeridos incompletos.' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const idUnidad = await ensureUnidadId(conn, unidad_medida)

      await conn.query(
        `UPDATE material
         SET nombre = ?, precio_unidad = ?, stock_minimo = ?, id_unidad = ?, fecha_expiracion = ?, id_proveedor = ?
         WHERE id_material = ?`,
        [
          nombre.trim(),
          Number(precio_unidad),
          Number(stock_minimo || 0),
          idUnidad,
          fecha_expiracion || null,
          id_proveedor || null,
          id,
        ]
      )

      await conn.commit()
      const [actualizado] = await pool.query(`${INVENTARIO_SELECT} WHERE v.id_material = ?`, [id])
      res.json(formatMaterialRow(actualizado[0]))
    } catch (err) {
      await conn.rollback()
      console.error('Error al editar producto de inventario:', err)
      res.status(500).json({ message: 'Error interno del servidor.' })
    } finally {
      conn.release()
    }
  }
)

// POST /api/inventario/compra
router.post('/compra', requireAuth, async (req, res) => {
  const { id_proveedor, fecha, tiene_factura_iva, items } = req.body

  if (!fecha || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Debe especificar la fecha y al menos un producto a comprar.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const subtotal = items.reduce(
      (sum, item) => sum + Math.round(Number(item.cantidad) * Number(item.precio_unitario) * 100),
      0
    )
    const iva = tiene_factura_iva ? Math.round(subtotal * 0.15) : 0

    const [compraRes] = await conn.query(
      `INSERT INTO compra (id_proveedor, fecha, monto_subtotal, monto_iva)
       VALUES (?, ?, ?, ?)`,
      [id_proveedor || null, fecha, subtotal / 100, iva / 100]
    )
    const compraId = compraRes.insertId

    for (const item of items) {
      const idMat = item.id_material || item.id_inventario
      const cant = Number(item.cantidad)
      const pUnit = Number(item.precio_unitario || 0)

      const [product] = await conn.query('SELECT id_material FROM material WHERE id_material = ? FOR UPDATE', [idMat])
      if (!product.length) {
        const err = new Error('Uno de los productos ya no existe.')
        err.status = 404
        throw err
      }

      await conn.query(
        `INSERT INTO compra_detalle (id_compra, id_material, cantidad, costo_unitario)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad), costo_unitario = VALUES(costo_unitario)`,
        [compraId, idMat, cant, pUnit]
      )

      if (pUnit > 0) {
        await conn.query('UPDATE material SET precio_unidad = ? WHERE id_material = ?', [pUnit, idMat])
      }
    }

    await conn.commit()
    res.status(201).json({ message: 'Compra registrada con éxito.', id_compra: compraId })
  } catch (err) {
    await conn.rollback()
    console.error('Error al registrar compra de inventario:', err)
    res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor al procesar compra.' })
  } finally {
    conn.release()
  }
})

// POST /api/inventario/ajuste
router.post('/ajuste', requireAuth, requireAuth.admin, async (req, res) => {
  const { id_inventario, id_material, tipo_ajuste, cantidad, nota } = req.body
  const idMat = id_material || id_inventario

  if (!idMat || !tipo_ajuste || !cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ message: 'Parámetros de ajuste inválidos.' })
  }

  if (!['incremento', 'decremento'].includes(tipo_ajuste)) {
    return res.status(400).json({ message: 'Tipo de ajuste inválido.' })
  }
  const delta = tipo_ajuste === 'incremento' ? Number(cantidad) : -Number(cantidad)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [stock] = await conn.query('SELECT stock_actual FROM vw_stock_material WHERE id_material = ?', [idMat])
    if (!stock.length || Number(stock[0].stock_actual) + delta < 0) {
      await conn.rollback()
      return res.status(400).json({ message: 'El producto no existe o el ajuste supera las existencias disponibles.' })
    }

    await conn.query(
      `INSERT INTO ajuste_material (id_material, cantidad, id_usuario, nota)
       VALUES (?, ?, ?, ?)`,
      [idMat, delta, req.usuario.id, nota?.trim() || `Ajuste manual (${tipo_ajuste})`]
    )

    await conn.commit()

    const [actualizado] = await pool.query(`${INVENTARIO_SELECT} WHERE v.id_material = ?`, [idMat])
    res.json(formatMaterialRow(actualizado[0]))
  } catch (err) {
    await conn.rollback()
    console.error('Error al realizar ajuste manual:', err)
    res.status(500).json({ message: 'Error al realizar el ajuste manual.' })
  } finally {
    conn.release()
  }
})

// GET /api/inventario/movimientos
router.get('/movimientos', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         mv.id_referencia AS id,
         mv.id_material AS id_inventario,
         mv.id_material,
         mv.tipo,
         ABS(mv.cantidad) AS cantidad,
         mv.cantidad AS cantidad_con_signo,
         mv.fecha,
         mv.id_usuario,
         mv.nota,
         m.nombre AS producto_nombre,
         um.nombre AS unidad_nombre,
         COALESCE(u.nombre, 'Sistema / Compra') AS usuario_nombre
       FROM vw_movimiento_material mv
       JOIN material m ON mv.id_material = m.id_material
       JOIN unidad_medida um ON m.id_unidad = um.id_unidad
       LEFT JOIN usuario u ON mv.id_usuario = u.id_usuario
       ORDER BY mv.fecha DESC
       LIMIT 100`
    )
    res.json(rows.map(r => ({ ...r, unidad_medida: unidadToSlug(r.unidad_nombre) })))
  } catch (err) {
    console.error('Error al obtener movimientos:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router