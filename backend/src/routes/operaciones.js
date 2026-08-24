// backend/src/routes/operaciones.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

// ═══════════════════════════════════════════════════════════
// ORDEN_SERVICIO
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/:id_orden/servicios
router.get('/:id_orden/servicios', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_servicio WHERE id_orden = ? ORDER BY id ASC',
      [req.params.id_orden]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/servicios
router.post('/:id_orden/servicios', requireAuth, async (req, res) => {
  const { descripcion, precio, aplica_iva } = req.body
  if (!descripcion || precio === undefined)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  try {
    const [result] = await pool.query(
      'INSERT INTO orden_servicio (id_orden, descripcion, precio, aplica_iva) VALUES (?, ?, ?, ?)',
      [req.params.id_orden, descripcion.trim(), parseFloat(precio), aplica_iva ? 1 : 0]
    )
    const [nuevo] = await pool.query('SELECT * FROM orden_servicio WHERE id = ?', [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// DELETE /api/operaciones/servicios/:id
router.delete('/servicios/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM orden_servicio WHERE id = ?', [req.params.id])
    res.json({ message: 'Servicio eliminado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// PERSONAL (lectura para selector)
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/personal/lista — lista todo el personal, fijos primero
router.get('/personal/lista', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM personal ORDER BY fijo DESC, nombre ASC'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// POST /api/operaciones/personal — crear nuevo personal
router.post('/personal', requireAuth, async (req, res) => {
  const { nombre, tipo, rol, telefono, fijo } = req.body
  if (!nombre || !tipo || !rol)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  try {
    const [result] = await pool.query(
      'INSERT INTO personal (nombre, tipo, rol, telefono, fijo) VALUES (?, ?, ?, ?, ?)',
      [nombre.trim(), tipo, rol, telefono?.trim() || null, fijo ? 1 : 0]
    )
    const [nuevo] = await pool.query('SELECT * FROM personal WHERE id = ?', [result.insertId])
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// ORDEN_PERSONAL
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/:id_orden/personal
router.get('/:id_orden/personal', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT op.*, p.nombre AS nombre_personal, p.rol, p.tipo
       FROM orden_personal op
       JOIN personal p ON op.id_personal = p.id
       WHERE op.id_orden = ? ORDER BY op.id ASC`,
      [req.params.id_orden]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/personal
router.post('/:id_orden/personal', requireAuth, async (req, res) => {
  const { id_personal, monto_acordado } = req.body
  if (!id_personal || monto_acordado === undefined)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  try {
    const [result] = await pool.query(
      'INSERT INTO orden_personal (id_orden, id_personal, monto_acordado) VALUES (?, ?, ?)',
      [req.params.id_orden, id_personal, parseFloat(monto_acordado)]
    )
    const [nuevo] = await pool.query(
      `SELECT op.*, p.nombre AS nombre_personal, p.rol, p.tipo
       FROM orden_personal op JOIN personal p ON op.id_personal = p.id
       WHERE op.id = ?`,
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// DELETE /api/operaciones/personal-asignado/:id
router.delete('/personal-asignado/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM orden_personal WHERE id = ?', [req.params.id])
    res.json({ message: 'Personal removido.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// INVENTARIO (lectura para selector de materiales)
// ═══════════════════════════════════════════════════════════

router.get('/inventario/lista', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, precio_unidad, cantidad, unidad_medida FROM inventario WHERE cantidad > 0 ORDER BY nombre ASC'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// ORDEN_MATERIAL — con movimiento_inventario atómico
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/:id_orden/materiales
router.get('/:id_orden/materiales', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT om.*, i.nombre AS nombre_material, i.unidad_medida
       FROM orden_material om
       JOIN inventario i ON om.id_material = i.id
       WHERE om.id_orden = ? ORDER BY om.id ASC`,
      [req.params.id_orden]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/materiales
router.post('/:id_orden/materiales', requireAuth, async (req, res) => {
  const { id_material, cantidad_usada } = req.body
  if (!id_material || !cantidad_usada)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // verificar stock disponible
    const [inv] = await conn.query(
      'SELECT cantidad, precio_unidad FROM inventario WHERE id = ? FOR UPDATE',
      [id_material]
    )
    if (inv.length === 0) throw new Error('Material no encontrado.')
    if (parseFloat(inv[0].cantidad) < parseFloat(cantidad_usada))
      throw new Error(`Stock insuficiente. Disponible: ${inv[0].cantidad}`)

    const precio_unitario = inv[0].precio_unidad

    // snapshot en orden_material
    const [result] = await conn.query(
      `INSERT INTO orden_material (id_orden, id_material, cantidad_usada, precio_unitario, registrado_por)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id_orden, id_material, parseFloat(cantidad_usada), precio_unitario, req.usuario.id]
    )

    // movimiento de salida
    await conn.query(
      `INSERT INTO movimiento_inventario (id_inventario, tipo, cantidad, id_usuario, id_orden)
       VALUES (?, 'salida_orden', ?, ?, ?)`,
      [id_material, parseFloat(cantidad_usada), req.usuario.id, req.params.id_orden]
    )

    // descontar inventario
    await conn.query(
      'UPDATE inventario SET cantidad = cantidad - ? WHERE id = ?',
      [parseFloat(cantidad_usada), id_material]
    )

    await conn.commit()

    const [nuevo] = await conn.query(
      `SELECT om.*, i.nombre AS nombre_material, i.unidad_medida
       FROM orden_material om JOIN inventario i ON om.id_material = i.id
       WHERE om.id = ?`,
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error('Error al registrar material:', err)
    res.status(400).json({ message: err.message || 'Error interno.' })
  } finally {
    conn.release()
  }
})

// DELETE /api/operaciones/materiales/:id
router.delete('/materiales/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM orden_material WHERE id = ?', [req.params.id])
    res.json({ message: 'Material eliminado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// REPUESTO_TALLER (lectura para selector)
// ═══════════════════════════════════════════════════════════

router.get('/repuestos/lista', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, marca, modelo, precio, cantidad FROM repuesto_taller WHERE cantidad > 0 ORDER BY nombre ASC'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// ORDEN_REPUESTO
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/:id_orden/repuestos
router.get('/:id_orden/repuestos', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT orep.*, rt.nombre AS nombre_repuesto, rt.marca, rt.modelo
       FROM orden_repuesto orep
       JOIN repuesto_taller rt ON orep.id_repuesto = rt.id
       WHERE orep.id_orden = ? ORDER BY orep.id ASC`,
      [req.params.id_orden]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/repuestos
router.post('/:id_orden/repuestos', requireAuth, async (req, res) => {
  const { id_repuesto, cantidad_usada } = req.body
  if (!id_repuesto || !cantidad_usada)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [rep] = await conn.query(
      'SELECT cantidad, precio FROM repuesto_taller WHERE id = ? FOR UPDATE',
      [id_repuesto]
    )
    if (rep.length === 0) throw new Error('Repuesto no encontrado.')
    if (parseInt(rep[0].cantidad) < parseInt(cantidad_usada))
      throw new Error(`Stock insuficiente. Disponible: ${rep[0].cantidad}`)

    const precio_unitario = rep[0].precio

    const [result] = await conn.query(
      `INSERT INTO orden_repuesto (id_orden, id_repuesto, cantidad_usada, precio_unitario, registrado_por)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id_orden, id_repuesto, parseInt(cantidad_usada), precio_unitario, req.usuario.id]
    )

    await conn.query(
      'UPDATE repuesto_taller SET cantidad = cantidad - ? WHERE id = ?',
      [parseInt(cantidad_usada), id_repuesto]
    )

    await conn.commit()

    const [nuevo] = await conn.query(
      `SELECT orep.*, rt.nombre AS nombre_repuesto, rt.marca, rt.modelo
       FROM orden_repuesto orep JOIN repuesto_taller rt ON orep.id_repuesto = rt.id
       WHERE orep.id = ?`,
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(400).json({ message: err.message || 'Error interno.' })
  } finally {
    conn.release()
  }
})

// ═══════════════════════════════════════════════════════════
// DAÑOS OCULTOS
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/:id_orden/danos
router.get('/:id_orden/danos', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_dano_oculto WHERE id_orden = ? ORDER BY id ASC',
      [req.params.id_orden]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/danos
router.post('/:id_orden/danos', requireAuth, async (req, res) => {
  const { descripcion, costo_adicional, aplica_seguro, monto_cubierto_seguro, monto_extra_cliente } = req.body
  if (!descripcion || costo_adicional === undefined)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO orden_dano_oculto
        (id_orden, descripcion, costo_adicional, aplica_seguro, monto_cubierto_seguro, monto_extra_cliente, estado_aprobacion)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        req.params.id_orden,
        descripcion.trim(),
        parseFloat(costo_adicional),
        aplica_seguro ? 1 : 0,
        monto_cubierto_seguro ? parseFloat(monto_cubierto_seguro) : null,
        monto_extra_cliente   ? parseFloat(monto_extra_cliente)   : null,
      ]
    )

    // marcar danos_ocultos = true en la orden
    await conn.query(
      'UPDATE orden SET danos_ocultos = TRUE WHERE id = ?',
      [req.params.id_orden]
    )

    await conn.commit()

    const [nuevo] = await conn.query(
      'SELECT * FROM orden_dano_oculto WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ message: 'Error interno.' })
  } finally {
    conn.release()
  }
})

module.exports = router
