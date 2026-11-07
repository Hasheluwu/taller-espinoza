const forms = require('../services/formValidation')
// backend/src/routes/inventario.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))

// ─── GET /api/inventario ──────────────────────────────────────────────────────
// Obtener productos de inventario con filtros y datos de proveedor
router.get('/', requireAuth, async (req, res) => {
  const { proveedor_id, unidad_medida, stock_bajo, expiracion_proxima, q } = req.query

  let sql = `
    SELECT i.*, p.nombre AS proveedor_nombre, p.emite_factura_iva AS proveedor_emite_iva
    FROM inventario i
    LEFT JOIN proveedor p ON i.id_proveedor = p.id
    WHERE 1=1
  `
  const params = []

  if (q && q.trim()) {
    sql += ` AND (i.nombre LIKE ? OR p.nombre LIKE ?)`
    params.push(`%${q.trim()}%`, `%${q.trim()}%`)
  }

  if (proveedor_id) {
    sql += ` AND i.id_proveedor = ?`
    params.push(proveedor_id)
  }

  if (unidad_medida) {
    sql += ` AND i.unidad_medida = ?`
    params.push(unidad_medida)
  }

  if (stock_bajo === 'true') {
    sql += ` AND i.cantidad <= i.stock_minimo`
  }

  if (expiracion_proxima === 'true') {
    // Expiración dentro de los próximos 30 días o ya expirados
    sql += ` AND i.fecha_expiracion IS NOT NULL AND i.fecha_expiracion <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`
  }

  sql += ` ORDER BY i.nombre ASC`

  try {
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener inventario:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── POST /api/inventario ─────────────────────────────────────────────────────
// Crear producto en inventario. Soporta proveedor existente o nuevo inline.
router.post('/', requireAuth, forms.middleware(b => { b.nombre = forms.text(b.nombre, 'Nombre del producto', 150) }), async (req, res) => {
  const {
    nombre,
    precio_unidad,
    cantidad = 0,
    stock_minimo = 0,
    unidad_medida,
    fecha_expiracion,
    id_proveedor,
    nuevo_proveedor
  } = req.body

  if (!nombre || !nombre.trim() || precio_unidad === undefined || !unidad_medida) {
    return res.status(400).json({ message: 'Nombre, precio unitario y unidad de medida son obligatorios.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    let finalProveedorId = id_proveedor || null

    // Si enviaron un nuevo proveedor inline
    if (!finalProveedorId && nuevo_proveedor && nuevo_proveedor.nombre && nuevo_proveedor.nombre.trim()) {
      const [provResult] = await conn.query(
        `INSERT INTO proveedor (nombre, contacto, emite_factura_iva, fijo) VALUES (?, ?, ?, ?)`,
        [
          nuevo_proveedor.nombre.trim(),
          nuevo_proveedor.contacto ? nuevo_proveedor.contacto.trim() : null,
          Boolean(nuevo_proveedor.emite_factura_iva),
          Boolean(nuevo_proveedor.fijo)
        ]
      )
      finalProveedorId = provResult.insertId
    }

    const [result] = await conn.query(
      `INSERT INTO inventario
         (id_proveedor, nombre, precio_unidad, cantidad, stock_minimo, unidad_medida, fecha_expiracion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        finalProveedorId,
        nombre.trim(),
        Number(precio_unidad),
        Number(cantidad),
        Number(stock_minimo),
        unidad_medida,
        fecha_expiracion || null
      ]
    )

    const newId = result.insertId

    // Si se inicializó con cantidad > 0, registrar un movimiento inicial
    if (Number(cantidad) > 0) {
      await conn.query(
        `INSERT INTO movimiento_inventario (id_inventario, tipo, cantidad, id_usuario, nota)
         VALUES (?, 'ajuste_manual', ?, ?, 'Stock inicial registrado')`,
        [newId, Number(cantidad), req.usuario.id]
      )
    }

    await conn.commit()

    const [nuevo] = await pool.query(
      `SELECT i.*, p.nombre AS proveedor_nombre
       FROM inventario i LEFT JOIN proveedor p ON i.id_proveedor = p.id
       WHERE i.id = ?`,
      [newId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al crear producto de inventario:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// ─── PUT /api/inventario/:id ──────────────────────────────────────────────────
// Editar producto de inventario
router.put('/:id', requireAuth, forms.middleware(b => { b.nombre = forms.text(b.nombre, 'Nombre del producto', 150) }), async (req, res) => {
  const { id } = req.params
  const { nombre, precio_unidad, stock_minimo, unidad_medida, fecha_expiracion, id_proveedor } = req.body

  if (!nombre || !nombre.trim() || precio_unidad === undefined || !unidad_medida) {
    return res.status(400).json({ message: 'Campos requeridos incompletos.' })
  }

  try {
    await pool.query(
      `UPDATE inventario
       SET nombre = ?, precio_unidad = ?, stock_minimo = ?, unidad_medida = ?, fecha_expiracion = ?, id_proveedor = ?
       WHERE id = ?`,
      [
        nombre.trim(),
        Number(precio_unidad),
        Number(stock_minimo || 0),
        unidad_medida,
        fecha_expiracion || null,
        id_proveedor || null,
        id
      ]
    )

    const [actualizado] = await pool.query(
      `SELECT i.*, p.nombre AS proveedor_nombre
       FROM inventario i LEFT JOIN proveedor p ON i.id_proveedor = p.id
       WHERE i.id = ?`,
      [id]
    )
    res.json(actualizado[0])
  } catch (err) {
    console.error('Error al editar producto de inventario:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── POST /api/inventario/compra ─────────────────────────────────────────────
// Registrar una compra de inventario y actualizar stock / movimientos
router.post('/compra', requireAuth, async (req, res) => {
  const { id_proveedor, fecha, tiene_factura_iva, items } = req.body

  if (!fecha || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Debe especificar la fecha y al menos un producto a comprar.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const subtotal = items.reduce((sum, item) => sum + Math.round(Number(item.cantidad) * Number(item.precio_unitario) * 100), 0)
    const iva = tiene_factura_iva ? Math.round(subtotal * 0.15) : 0
    // Totales calculados por el servidor a partir de las líneas.
    // 1. Insertar en compra_inventario
    const [compraRes] = await conn.query(
      `INSERT INTO compra_inventario (id_proveedor, fecha, monto_subtotal, monto_iva, monto_total, tiene_factura_iva)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_proveedor || null,
        fecha,
        subtotal / 100,
        iva / 100,
        (subtotal + iva) / 100,
        Boolean(tiene_factura_iva)
      ]
    )
    const compraId = compraRes.insertId

    // 2. Procesar cada ítem
    for (const item of items) {
      const cant = Number(item.cantidad)
      const pUnit = Number(item.precio_unitario || 0)

      const [product] = await conn.query('SELECT id FROM inventario WHERE id = ? FOR UPDATE', [item.id_inventario])
      if (!product.length) { const err = new Error('Uno de los productos ya no existe.'); err.status = 404; throw err }

      // Actualizar stock de inventario y precio unitario si aplica
      await conn.query(
        `UPDATE inventario
         SET cantidad = cantidad + ?,
             precio_unidad = CASE WHEN ? > 0 THEN ? ELSE precio_unidad END
         WHERE id = ?`,
        [cant, pUnit, pUnit, item.id_inventario]
      )

      // Registrar movimiento de entrada por compra
      await conn.query(
        `INSERT INTO movimiento_inventario (id_inventario, tipo, cantidad, id_usuario, id_compra, nota)
         VALUES (?, 'entrada_compra', ?, ?, ?, 'Entrada por compra de mercadería')`,
        [item.id_inventario, cant, req.usuario.id, compraId]
      )
    }

    await conn.commit()
    res.status(201).json({ message: 'Compra registrada con éxito.', id_compra: compraId })
  } catch (err) {
    await conn.rollback()
    console.error('Error al registrar compra de inventario:', err)
    res.status(500).json({ message: 'Error interno del servidor al procesar compra.' })
  } finally {
    conn.release()
  }
})

// ─── POST /api/inventario/ajuste ─────────────────────────────────────────────
// Registrar ajuste manual de inventario
router.post('/ajuste', requireAuth, requireAuth.admin, async (req, res) => {
  const { id_inventario, tipo_ajuste, cantidad, nota } = req.body

  if (!id_inventario || !tipo_ajuste || !cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ message: 'Parámetros de ajuste inválidos.' })
  }

  if (!['incremento', 'decremento'].includes(tipo_ajuste)) return res.status(400).json({ message: 'Tipo de ajuste inválido.' })
  const delta = tipo_ajuste === 'incremento' ? Number(cantidad) : -Number(cantidad)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [stock] = await conn.query('SELECT cantidad FROM inventario WHERE id = ? FOR UPDATE', [id_inventario])
    if (!stock.length || Number(stock[0].cantidad) + delta < 0) {
      await conn.rollback()
      return res.status(400).json({ message: 'El producto no existe o el ajuste supera las existencias disponibles.' })
    }
    // El movimiento coincide exactamente con la variación de existencias.
    await conn.query(
      `UPDATE inventario
       SET cantidad = cantidad + ?
       WHERE id = ?`,
      [delta, id_inventario]
    )

    // Registrar movimiento
    await conn.query(
      `INSERT INTO movimiento_inventario (id_inventario, tipo, cantidad, id_usuario, nota)
       VALUES (?, 'ajuste_manual', ?, ?, ?)`,
      [id_inventario, delta, req.usuario.id, nota || `Ajuste manual (${tipo_ajuste})`]
    )

    await conn.commit()

    const [actualizado] = await pool.query('SELECT * FROM inventario WHERE id = ?', [id_inventario])
    res.json(actualizado[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al realizar ajuste manual:', err)
    res.status(500).json({ message: 'Error al realizar el ajuste manual.' })
  } finally {
    conn.release()
  }
})

// ─── GET /api/inventario/movimientos ─────────────────────────────────────────
// Consultar historial de movimientos de inventario
router.get('/movimientos', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, i.nombre AS producto_nombre, i.unidad_medida, u.nombre AS usuario_nombre
       FROM movimiento_inventario m
       JOIN inventario i ON m.id_inventario = i.id
       JOIN usuario u ON m.id_usuario = u.id
       ORDER BY m.fecha DESC
       LIMIT 100`
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener movimientos:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router



