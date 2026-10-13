// backend/src/routes/operaciones.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const { lockOrder, fail, money } = require('../services/validation')
const router = express.Router()
router.use(require('../middleware/validateNumbers'))

// Estados en los que se permite eliminar/modificar líneas de una orden
const ESTADOS_EDITABLES = ['recibido', 'en_proceso']

// ═══════════════════════════════════════════════════════════
// RECÁLCULO DE TOTALES DE LA ORDEN
// Suma servicios + materiales + repuestos y actualiza
// subtotal, iva y costo_total en la tabla orden.
// Se llama internamente después de cada write y también
// está expuesto como POST para el recálculo al cargar la página.
// ═══════════════════════════════════════════════════════════

async function recalcularTotalesOrden(conn, id_orden) {
  const order = await lockOrder(conn, id_orden)
  if (!ESTADOS_EDITABLES.includes(order.estado)) return { subtotal: order.subtotal, iva: order.iva, costo_total: order.costo_total }
  // servicios — precio con o sin IVA (15%)
  const [servicios] = await conn.query(
    `SELECT precio, aplica_iva FROM orden_servicio WHERE id_orden = ?`,
    [id_orden]
  )

  // materiales — precio snapshot × cantidad
  const [materiales] = await conn.query(
    `SELECT precio_unitario, cantidad_usada FROM orden_material WHERE id_orden = ?`,
    [id_orden]
  )

  // repuestos — precio snapshot × cantidad
  const [repuestos] = await conn.query(
    `SELECT precio_unitario, cantidad_usada FROM orden_repuesto WHERE id_orden = ?`,
    [id_orden]
  )

  let subtotal = 0
  let iva      = 0

  for (const s of servicios) {
    const base = parseFloat(s.precio)
    subtotal += base
    if (s.aplica_iva) iva += base * 0.15
  }

  for (const m of materiales) {
    subtotal += parseFloat(m.precio_unitario) * parseFloat(m.cantidad_usada)
    // materiales no generan IVA en la orden (ya se capturó en la compra)
  }

  for (const r of repuestos) {
    subtotal += parseFloat(r.precio_unitario) * parseInt(r.cantidad_usada)
  }

  subtotal = Math.round(subtotal * 100) / 100
  iva = Math.round(iva * 100) / 100
  const costo_total = Math.round((subtotal + iva) * 100) / 100
  const [[paid]] = await conn.query(`SELECT
    (SELECT COALESCE(SUM(monto), 0) FROM pago_cliente WHERE id_orden = ?) +
    (SELECT COALESCE(SUM(monto), 0) FROM pago_seguro WHERE id_orden = ? AND estado = 'recibido') AS total`, [id_orden, id_orden])
  // A separately acknowledged overpayment must not force an increase in sales.
  const appliedPaid = order.costo_total == null ? Number(paid.total) : Math.min(Number(paid.total), Number(order.costo_total))
  if (Math.round(appliedPaid * 100) > Math.round(costo_total * 100)) fail('El total no puede quedar por debajo de los pagos aplicados a la reparación. Revisa los cargos de la orden.', 409)

  await conn.query(
    `UPDATE orden SET subtotal = ?, iva = ?, costo_total = ? WHERE id = ?`,
    [subtotal, iva, costo_total, id_orden]
  )

  return { subtotal, iva, costo_total }
}

// POST /api/operaciones/:id_orden/recalcular
// Llamado por el frontend al montar la página de Operaciones.
router.post('/:id_orden/recalcular', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))
    const totales = await recalcularTotalesOrden(conn, req.params.id_orden)
    await conn.commit()
    res.json(totales)
  } catch (err) {
    await conn.rollback()
    console.error('Error al recalcular totales:', err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/servicios
router.post('/:id_orden/servicios', requireAuth, async (req, res) => {
  const { descripcion, precio, aplica_iva } = req.body
  if (!descripcion || precio === undefined)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))
    const [result] = await conn.query(
      'INSERT INTO orden_servicio (id_orden, descripcion, precio, aplica_iva) VALUES (?, ?, ?, ?)',
      [req.params.id_orden, descripcion.trim(), parseFloat(precio), aplica_iva ? 1 : 0]
    )
    const [nuevo] = await conn.query('SELECT * FROM orden_servicio WHERE id = ?', [result.insertId])
    await recalcularTotalesOrden(conn, req.params.id_orden)
    await conn.commit()
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

// DELETE /api/operaciones/servicios/:id
router.delete('/servicios/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))
    // obtener id_orden antes de borrar
    const [rows] = await conn.query(
      'SELECT id_orden FROM orden_servicio WHERE id = ? FOR UPDATE',
      [req.params.id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Servicio no encontrado.' })
    }
    const id_orden = rows[0].id_orden

    // verificar estado de la orden — solo permitir en recibido o en_proceso
    const [orden] = await conn.query(
      'SELECT estado FROM orden WHERE id = ? FOR UPDATE',
      [id_orden]
    )
    if (!ESTADOS_EDITABLES.includes(orden[0].estado)) {
      await conn.rollback()
      return res.status(400).json({
        message: `No se puede eliminar una línea en una orden con estado "${orden[0].estado}".`,
      })
    }

    await conn.query('DELETE FROM orden_servicio WHERE id = ?', [req.params.id])
    await recalcularTotalesOrden(conn, id_orden)
    await conn.commit()
    res.json({ message: 'Servicio eliminado.' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/personal
router.post('/:id_orden/personal', requireAuth, async (req, res) => {
  const { id_personal, monto_acordado } = req.body
  if (!id_personal || monto_acordado === undefined)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await lockOrder(conn, req.params.id_orden, true)
    const [result] = await conn.query(
      'INSERT INTO orden_personal (id_orden, id_personal, monto_acordado) VALUES (?, ?, ?)',
      [req.params.id_orden, id_personal, parseFloat(monto_acordado)]
    )
    const [nuevo] = await conn.query(
      `SELECT op.*, p.nombre AS nombre_personal, p.rol, p.tipo
       FROM orden_personal op JOIN personal p ON op.id_personal = p.id
       WHERE op.id = ?`,
      [result.insertId]
    )
    await conn.commit()
    res.status(201).json(nuevo[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally { conn.release() }
})

// DELETE /api/operaciones/personal-asignado/:id
// FIX: ahora verifica que la orden esté en estado editable antes de borrar.
router.delete('/personal-asignado/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))

    // Obtener id_orden del registro antes de borrar
    const [rows] = await conn.query(
      'SELECT op.id_orden, o.estado FROM orden_personal op JOIN orden o ON o.id = op.id_orden WHERE op.id = ? FOR UPDATE',
      [req.params.id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Asignación de personal no encontrada.' })
    }

    const { estado } = rows[0]
    if (!ESTADOS_EDITABLES.includes(estado)) {
      await conn.rollback()
      return res.status(400).json({
        message: `No se puede eliminar personal en una orden con estado "${estado}".`,
      })
    }

    const [settled] = await conn.query('SELECT id FROM liquidacion_detalle WHERE id_orden_personal=?', [req.params.id])
    if (settled.length) fail('El trabajador ya tiene una liquidación para este trabajo. Conserva su registro.', 409)
    await conn.query('DELETE FROM orden_personal WHERE id = ?', [req.params.id])
    await conn.commit()
    res.json({ message: 'Personal removido.' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

// ═══════════════════════════════════════════════════════════
// ORDEN_MATERIAL — con movimiento_inventario atómico
// ═══════════════════════════════════════════════════════════

// GET /api/operaciones/:id_orden/materiales
router.get('/:id_orden/materiales', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT om.*, i.nombre AS nombre_material, i.unidad_medida, p.nombre AS responsable, cr.nota
       FROM orden_material om
       JOIN inventario i ON om.id_material = i.id
       LEFT JOIN consumo_responsable cr ON cr.id_material_orden=om.id
       LEFT JOIN personal p ON p.id=cr.id_personal
       WHERE om.id_orden = ? ORDER BY om.id ASC`,
      [req.params.id_orden]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/materiales
router.post('/:id_orden/materiales', requireAuth, async (req, res) => {
  const { id_material, cantidad_usada, id_personal, nota, monto_acordado } = req.body
  if (!id_material || !cantidad_usada)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))

    // verificar stock disponible
    money(cantidad_usada, 'Cantidad', true)
    if (!id_personal && monto_acordado !== undefined && monto_acordado !== '') fail('Selecciona el trabajador para registrar su monto acordado.')
    if (id_personal) {
      const [[person]] = await conn.query('SELECT id FROM personal WHERE id=?', [id_personal])
      if (!person) fail('Trabajador no encontrado.', 404)
    }
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
    if (id_personal) {
      await conn.query('INSERT INTO consumo_responsable (id_material_orden,id_personal,nota) VALUES (?,?,?)', [result.insertId,id_personal,String(nota || '').slice(0,500)])
      // Optional labor charge is part of the same transaction as the material.
      if (monto_acordado !== undefined && monto_acordado !== '') await conn.query('INSERT INTO orden_personal (id_orden,id_personal,monto_acordado) VALUES (?,?,?)', [req.params.id_orden,id_personal,money(monto_acordado,'Monto acordado')])
    }

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

    await recalcularTotalesOrden(conn, req.params.id_orden)
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
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))

    // obtener datos del registro antes de borrar
    const [rows] = await conn.query(
      'SELECT id_orden, id_material, cantidad_usada FROM orden_material WHERE id = ? FOR UPDATE',
      [req.params.id]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Material no encontrado.' })
    }
    const { id_orden, id_material, cantidad_usada } = rows[0]

    // verificar estado de la orden
    const [orden] = await conn.query(
      'SELECT estado FROM orden WHERE id = ? FOR UPDATE',
      [id_orden]
    )
    if (!ESTADOS_EDITABLES.includes(orden[0].estado)) {
      await conn.rollback()
      return res.status(400).json({
        message: `No se puede eliminar un material en una orden con estado "${orden[0].estado}".`,
      })
    }

    // borrar el registro de orden_material
    await conn.query('DELETE FROM orden_material WHERE id = ?', [req.params.id])

    // Preserve the original outgoing movement and record an explicit reversal.
    await conn.query(
      `INSERT INTO movimiento_inventario (id_inventario, tipo, cantidad, id_usuario, id_orden, nota)
       VALUES (?, 'ajuste_manual', ?, ?, ?, ?)`,
      [id_material, Number(cantidad_usada), req.usuario.id, id_orden, `Devolución por eliminación de material #${req.params.id}`]
    )
    // devolver la cantidad al inventario
    await conn.query(
      'UPDATE inventario SET cantidad = cantidad + ? WHERE id = ?',
      [parseFloat(cantidad_usada), id_material]
    )

    await recalcularTotalesOrden(conn, id_orden)
    await conn.commit()
    res.json({ message: 'Material eliminado y stock revertido.' })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

// POST /api/operaciones/:id_orden/repuestos
router.post('/:id_orden/repuestos', requireAuth, async (req, res) => {
  const { id_repuesto, cantidad_usada } = req.body
  if (!Number.isSafeInteger(Number(cantidad_usada)) || Number(cantidad_usada) <= 0) return res.status(400).json({ message: 'La cantidad de repuestos debe ser un entero positivo.' })
  if (!id_repuesto || !cantidad_usada)
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))

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

    await recalcularTotalesOrden(conn, req.params.id_orden)
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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
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
    if (req.params.id_orden) await lockOrder(conn, req.params.id_orden, !req.path.endsWith('/recalcular'))

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
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

module.exports = router




