// backend/src/routes/operaciones.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const { lockOrder, fail, money, number, packId, unpackId } = require('../services/validation')
const {
  validatePersonal,
  normalizeWorkers,
  assignWorkers,
  requireTeamMember,
} = require('../services/workers')
const {
  especialidadToId,
  especialidadToSlug,
  unidadToSlug,
} = require('../services/catalogs')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))

const ESTADOS_EDITABLES = ['recibido', 'en_proceso']

async function recalcularTotalesOrden(conn, id_orden) {
  const order = await lockOrder(conn, id_orden)
  const [[tot]] = await conn.query('SELECT * FROM vw_totales_orden WHERE id_orden = ?', [id_orden])
  const subtotal = Number(tot.subtotal || 0)
  const iva = Number(tot.iva || 0)
  const costo_total = Number(tot.costo_total || 0)

  const paid = Number(tot.abonado_cliente || 0) + Number(tot.abonado_seguro || 0)
  if (costo_total > 0 && Math.round(paid * 100) > Math.round(costo_total * 100) && order.costo_total != null) {
    fail(
      'El total no puede quedar por debajo de los pagos aplicados a la reparación. Revisa los cargos de la orden.',
      409
    )
  }

  return { subtotal, iva, costo_total }
}

// POST /api/operaciones/:id_orden/recalcular
router.post('/:id_orden/recalcular', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
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

// ─── ORDEN_SERVICIO ──────────────────────────────────────────────────────────

router.get('/:id_orden/servicios', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_servicio WHERE id_orden = ? ORDER BY num_linea ASC',
      [req.params.id_orden]
    )
    res.json(
      rows.map(r => ({
        ...r,
        id: packId(r.id_orden, r.num_linea),
        aplica_iva: Boolean(r.aplica_iva),
        tipo_linea: 'servicio',
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.post('/:id_orden/servicios', requireAuth, async (req, res) => {
  const { descripcion, precio, aplica_iva, tipo_linea = 'servicio' } = req.body
  if (!['servicio', 'repuesto', 'material'].includes(tipo_linea)) {
    return res.status(400).json({ message: 'Tipo de cargo inválido.' })
  }
  if (!descripcion || precio === undefined) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await lockOrder(conn, req.params.id_orden, true)

    const [[maxRow]] = await conn.query(
      'SELECT COALESCE(MAX(num_linea), 0) + 1 AS next_linea FROM orden_servicio WHERE id_orden = ?',
      [req.params.id_orden]
    )
    const numLinea = maxRow.next_linea

    await conn.query(
      'INSERT INTO orden_servicio (id_orden, num_linea, descripcion, precio, aplica_iva) VALUES (?, ?, ?, ?, ?)',
      [req.params.id_orden, numLinea, descripcion.trim(), parseFloat(precio), aplica_iva ? 1 : 0]
    )
    const [nuevo] = await conn.query(
      'SELECT * FROM orden_servicio WHERE id_orden = ? AND num_linea = ?',
      [req.params.id_orden, numLinea]
    )
    await recalcularTotalesOrden(conn, req.params.id_orden)
    await conn.commit()

    res.status(201).json({
      ...nuevo[0],
      id: packId(nuevo[0].id_orden, nuevo[0].num_linea),
      aplica_iva: Boolean(nuevo[0].aplica_iva),
      tipo_linea,
    })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

router.delete('/servicios/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [id_orden, num_linea] = unpackId(req.params.id, 'Servicio')

    const [rows] = await conn.query(
      'SELECT id_orden FROM orden_servicio WHERE id_orden = ? AND num_linea = ? FOR UPDATE',
      [id_orden, num_linea]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Servicio no encontrado.' })
    }

    const order = await lockOrder(conn, id_orden)
    if (!ESTADOS_EDITABLES.includes(order.estado)) {
      await conn.rollback()
      return res.status(400).json({
        message: `No se puede eliminar una línea en una orden con estado "${order.estado}".`,
      })
    }

    await conn.query('DELETE FROM orden_servicio WHERE id_orden = ? AND num_linea = ?', [id_orden, num_linea])
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

// ─── PERSONAL ────────────────────────────────────────────────────────────────

const PERSONAL_SELECT = `
  SELECT
    p.id_personal AS id,
    p.id_personal,
    p.nombre,
    p.telefono,
    p.tipo,
    p.fijo,
    p.activo,
    (SELECT pe.id_especialidad FROM personal_especialidad pe WHERE pe.id_personal = p.id_personal ORDER BY pe.id_especialidad ASC LIMIT 1) AS id_especialidad,
    (SELECT COUNT(*) FROM orden_personal op WHERE op.id_personal = p.id_personal) AS trabajos,
    (SELECT COALESCE(SUM(op.monto_acordado), 0) FROM orden_personal op WHERE op.id_personal = p.id_personal) AS total_acordado,
    (
      SELECT COALESCE(SUM(op.monto_acordado), 0)
      FROM orden_personal op
      WHERE op.id_personal = p.id_personal
        AND NOT EXISTS (
          SELECT 1
          FROM liquidacion_detalle ld
          JOIN liquidacion l ON l.id_liquidacion = ld.id_liquidacion
          WHERE ld.id_orden = op.id_orden
            AND ld.id_personal = op.id_personal
            AND l.fecha_pago IS NOT NULL
        )
    ) AS pendiente
  FROM personal p
`

function formatPersonalRow(r) {
  return {
    ...r,
    rol: especialidadToSlug(r.id_especialidad),
  }
}

router.get('/personal/lista', requireAuth, async (req, res) => {
  try {
    const all = req.query.todos === '1'
    const sql = all
      ? `${PERSONAL_SELECT} ORDER BY p.activo DESC, p.fijo DESC, p.nombre ASC`
      : `${PERSONAL_SELECT} WHERE p.activo = 1 ORDER BY p.fijo DESC, p.nombre ASC`
    const [rows] = await pool.query(sql)
    res.json(rows.map(formatPersonalRow))
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.post('/personal', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const p = validatePersonal(req.body)
    await conn.beginTransaction()

    const [[same]] = await conn.query(
      'SELECT id_personal FROM personal WHERE LOWER(nombre) = LOWER(?) AND activo = 1',
      [p.nombre]
    )
    if (same) fail('Ya existe un trabajador activo con ese nombre.', 409)

    const [result] = await conn.query(
      'INSERT INTO personal (nombre, telefono, tipo, fijo, activo) VALUES (?, ?, ?, ?, TRUE)',
      [p.nombre, p.telefono, p.tipo, p.fijo]
    )
    const idEsp = especialidadToId(p.rol)
    await conn.query(
      'INSERT INTO personal_especialidad (id_personal, id_especialidad) VALUES (?, ?)',
      [result.insertId, idEsp]
    )

    await conn.commit()
    const [nuevo] = await pool.query(`${PERSONAL_SELECT} WHERE p.id_personal = ?`, [result.insertId])
    res.status(201).json(formatPersonalRow(nuevo[0]))
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

router.put('/personal/:id', requireAuth, requireAuth.admin, async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const id = number(req.params.id, 'Trabajador', { positive: true, integer: true })
    const p = validatePersonal(req.body)
    await conn.beginTransaction()

    const [[same]] = await conn.query(
      'SELECT id_personal FROM personal WHERE LOWER(nombre) = LOWER(?) AND activo = 1 AND id_personal <> ?',
      [p.nombre, id]
    )
    if (same) fail('Ya existe otro trabajador activo con ese nombre.', 409)

    const [result] = await conn.query(
      'UPDATE personal SET nombre = ?, tipo = ?, telefono = ?, fijo = ? WHERE id_personal = ?',
      [p.nombre, p.tipo, p.telefono, p.fijo, id]
    )
    if (!result.affectedRows) fail('Trabajador no encontrado.', 404)

    await conn.query('DELETE FROM personal_especialidad WHERE id_personal = ?', [id])
    await conn.query(
      'INSERT INTO personal_especialidad (id_personal, id_especialidad) VALUES (?, ?)',
      [id, especialidadToId(p.rol)]
    )

    await conn.query(
      "INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, 'personal', ?, 'editar', ?)",
      [req.usuario.id, String(id), `Datos actualizados: ${p.nombre}, ${p.rol}, ${p.tipo}`]
    )
    await conn.commit()

    const [[row]] = await pool.query(`${PERSONAL_SELECT} WHERE p.id_personal = ?`, [id])
    res.json(formatPersonalRow(row))
  } catch (err) {
    await conn.rollback()
    next(err)
  } finally {
    conn.release()
  }
})

router.patch('/personal/:id/activo', requireAuth, requireAuth.admin, async (req, res, next) => {
  try {
    const id = number(req.params.id, 'Trabajador', { positive: true, integer: true })
    if (typeof req.body?.activo !== 'boolean') fail('Indica si el trabajador queda activo o de baja.')
    const [result] = await pool.query('UPDATE personal SET activo = ? WHERE id_personal = ?', [
      req.body.activo ? 1 : 0,
      id,
    ])
    if (!result.affectedRows) fail('Trabajador no encontrado.', 404)
    await pool.query(
      "INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, 'personal', ?, 'editar', ?)",
      [req.usuario.id, String(id), req.body.activo ? 'Trabajador reactivado' : 'Trabajador dado de baja']
    )
    const [[row]] = await pool.query(`${PERSONAL_SELECT} WHERE p.id_personal = ?`, [id])
    res.json(formatPersonalRow(row))
  } catch (err) {
    next(err)
  }
})

// ─── ORDEN_PERSONAL ──────────────────────────────────────────────────────────

router.get('/:id_orden/personal', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         op.*,
         p.nombre AS nombre_personal,
         p.tipo,
         p.activo,
         (SELECT pe.id_especialidad FROM personal_especialidad pe WHERE pe.id_personal = p.id_personal LIMIT 1) AS id_especialidad,
         EXISTS (
           SELECT 1 FROM liquidacion_detalle ld
           WHERE ld.id_orden = op.id_orden AND ld.id_personal = op.id_personal
         ) AS liquidado
       FROM orden_personal op
       JOIN personal p ON op.id_personal = p.id_personal
       WHERE op.id_orden = ?
       ORDER BY op.id_personal ASC`,
      [req.params.id_orden]
    )
    res.json(
      rows.map(r => ({
        ...r,
        id: packId(r.id_orden, r.id_personal),
        rol: especialidadToSlug(r.id_especialidad),
        liquidado: Boolean(r.liquidado),
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.post('/:id_orden/personal', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const workers = normalizeWorkers(req.body, { requireAmount: true })
    if (!workers.length) fail('Elige al menos un trabajador y su monto acordado.')
    await conn.beginTransaction()
    await lockOrder(conn, req.params.id_orden, true)
    await assignWorkers(conn, req.params.id_orden, workers)

    const [nuevos] = await conn.query(
      `SELECT
         op.*,
         p.nombre AS nombre_personal,
         p.tipo,
         (SELECT pe.id_especialidad FROM personal_especialidad pe WHERE pe.id_personal = p.id_personal LIMIT 1) AS id_especialidad
       FROM orden_personal op
       JOIN personal p ON op.id_personal = p.id_personal
       WHERE op.id_orden = ? AND op.id_personal IN (?)
       ORDER BY op.id_personal ASC`,
      [req.params.id_orden, workers.map(w => w.id_personal)]
    )
    await conn.commit()

    const formatted = nuevos.map(r => ({
      ...r,
      id: packId(r.id_orden, r.id_personal),
      rol: especialidadToSlug(r.id_especialidad),
    }))
    res.status(201).json(Array.isArray(req.body.trabajadores) ? formatted : formatted[0])
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

router.put('/personal-asignado/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const [id_orden, id_personal] = unpackId(req.params.id, 'Asignación')
    const amount = req.body?.monto_acordado
    if (amount === undefined || amount === null || amount === '') fail('Escribe el monto acordado.')
    await conn.beginTransaction()

    const [[row]] = await conn.query(
      `SELECT op.*, p.nombre, p.tipo,
         (SELECT pe.id_especialidad FROM personal_especialidad pe WHERE pe.id_personal = p.id_personal LIMIT 1) AS id_especialidad
       FROM orden_personal op
       JOIN personal p ON p.id_personal = op.id_personal
       WHERE op.id_orden = ? AND op.id_personal = ? FOR UPDATE`,
      [id_orden, id_personal]
    )
    if (!row) fail('Asignación de personal no encontrada.', 404)
    await lockOrder(conn, row.id_orden, true)

    const [settled] = await conn.query(
      'SELECT id_liquidacion FROM liquidacion_detalle WHERE id_orden = ? AND id_personal = ? FOR UPDATE',
      [id_orden, id_personal]
    )
    if (settled.length) {
      fail(`El trabajo de ${row.nombre} ya está en una liquidación. Su monto no se puede cambiar.`, 409)
    }

    await conn.query('UPDATE orden_personal SET monto_acordado = ? WHERE id_orden = ? AND id_personal = ?', [
      Number(amount),
      id_orden,
      id_personal,
    ])
    await conn.query(
      "INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, 'orden_personal', ?, 'editar', ?)",
      [
        req.usuario.id,
        `${id_orden}-${id_personal}`,
        `Monto de ${row.nombre} en orden #${row.id_orden}: C$ ${row.monto_acordado} -> C$ ${Number(amount).toFixed(2)}`,
      ]
    )
    await conn.commit()

    res.json({
      ...row,
      id: packId(id_orden, id_personal),
      monto_acordado: Number(amount),
      nombre_personal: row.nombre,
      rol: especialidadToSlug(row.id_especialidad),
      liquidado: 0,
    })
  } catch (err) {
    await conn.rollback()
    if (!err.status) console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

router.delete('/personal-asignado/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const [id_orden, id_personal] = unpackId(req.params.id, 'Asignación')
    await conn.beginTransaction()

    const [rows] = await conn.query(
      `SELECT op.id_orden, o.estado
       FROM orden_personal op
       JOIN orden o ON o.id_orden = op.id_orden
       WHERE op.id_orden = ? AND op.id_personal = ? FOR UPDATE`,
      [id_orden, id_personal]
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

    const [settled] = await conn.query(
      'SELECT id_liquidacion FROM liquidacion_detalle WHERE id_orden = ? AND id_personal = ?',
      [id_orden, id_personal]
    )
    if (settled.length) {
      fail('El trabajador ya tiene una liquidación para este trabajo. Conserva su registro.', 409)
    }

    await conn.query('DELETE FROM orden_personal WHERE id_orden = ? AND id_personal = ?', [id_orden, id_personal])
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

// ─── INVENTARIO Y ORDEN_MATERIAL ─────────────────────────────────────────────

router.get('/inventario/lista', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id_material AS id,
         id_material,
         nombre,
         precio_unidad,
         stock_actual AS cantidad,
         unidad_medida AS unidad_nombre
       FROM vw_stock_material
       WHERE stock_actual > 0
         AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURRENT_DATE())
       ORDER BY nombre ASC`
    )
    res.json(rows.map(r => ({ ...r, unidad_medida: unidadToSlug(r.unidad_nombre) })))
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.get('/:id_orden/materiales', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         om.*,
         m.nombre AS nombre_material,
         u.nombre AS unidad_nombre
       FROM orden_material om
       JOIN material m ON om.id_material = m.id_material
       JOIN unidad_medida u ON m.id_unidad = u.id_unidad
       WHERE om.id_orden = ?
       ORDER BY om.id_material ASC`,
      [req.params.id_orden]
    )
    res.json(
      rows.map(r => ({
        ...r,
        id: packId(r.id_orden, r.id_material),
        unidad_medida: unidadToSlug(r.unidad_nombre),
        registrado_por: r.id_usuario,
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.post('/:id_orden/materiales', requireAuth, async (req, res) => {
  const { id_material, cantidad_usada } = req.body
  if (!id_material || !cantidad_usada) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await lockOrder(conn, req.params.id_orden, true)

    money(cantidad_usada, 'Cantidad', true)
    await requireTeamMember(
      conn,
      req.params.id_orden,
      req.body.id_personal ?? req.body.trabajadores?.[0]?.id_personal
    )

    const [inv] = await conn.query(
      `SELECT stock_actual AS cantidad, precio_unidad, (fecha_expiracion < CURRENT_DATE()) AS vencido
       FROM vw_stock_material WHERE id_material = ?`,
      [id_material]
    )
    if (inv.length === 0) throw new Error('Material no encontrado.')
    if (Number(inv[0].vencido) === 1) fail('Este material está vencido. No se permite su consumo.')
    if (parseFloat(inv[0].cantidad) < parseFloat(cantidad_usada)) {
      throw new Error(`Stock insuficiente. Disponible: ${inv[0].cantidad}`)
    }

    const precio_unitario = inv[0].precio_unidad

    await conn.query(
      `INSERT INTO orden_material (id_orden, id_material, cantidad_usada, precio_unitario, id_usuario)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad_usada = cantidad_usada + VALUES(cantidad_usada)`,
      [req.params.id_orden, id_material, parseFloat(cantidad_usada), precio_unitario, req.usuario.id]
    )

    await recalcularTotalesOrden(conn, req.params.id_orden)
    await conn.commit()

    const [nuevo] = await pool.query(
      `SELECT om.*, m.nombre AS nombre_material, u.nombre AS unidad_nombre
       FROM orden_material om
       JOIN material m ON om.id_material = m.id_material
       JOIN unidad_medida u ON m.id_unidad = u.id_unidad
       WHERE om.id_orden = ? AND om.id_material = ?`,
      [req.params.id_orden, id_material]
    )
    res.status(201).json({
      ...nuevo[0],
      id: packId(nuevo[0].id_orden, nuevo[0].id_material),
      unidad_medida: unidadToSlug(nuevo[0].unidad_nombre),
    })
  } catch (err) {
    await conn.rollback()
    console.error('Error al registrar material:', err)
    res.status(err.status || 400).json({ message: err.message || 'Error interno.' })
  } finally {
    conn.release()
  }
})

router.delete('/materiales/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [id_orden, id_material] = unpackId(req.params.id, 'Material de orden')

    const [rows] = await conn.query(
      'SELECT id_orden, id_material, cantidad_usada FROM orden_material WHERE id_orden = ? AND id_material = ? FOR UPDATE',
      [id_orden, id_material]
    )
    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Material no encontrado.' })
    }

    const order = await lockOrder(conn, id_orden)
    if (!ESTADOS_EDITABLES.includes(order.estado)) {
      await conn.rollback()
      return res.status(400).json({
        message: `No se puede eliminar un material en una orden con estado "${order.estado}".`,
      })
    }

    await conn.query('DELETE FROM orden_material WHERE id_orden = ? AND id_material = ?', [id_orden, id_material])
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

// ─── REPUESTO_TALLER Y ORDEN_REPUESTO ────────────────────────────────────────

router.get('/repuestos/lista', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id_repuesto AS id,
         id_repuesto,
         nombre,
         marca,
         modelo,
         precio,
         stock_disponible AS cantidad
       FROM vw_stock_repuesto_taller
       WHERE stock_disponible > 0
       ORDER BY nombre ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.get('/:id_orden/repuestos', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         orep.*,
         rt.nombre AS nombre_repuesto,
         ma.nombre AS marca,
         mo.nombre AS modelo
       FROM orden_repuesto orep
       JOIN repuesto_taller rt ON orep.id_repuesto = rt.id_repuesto
       JOIN modelo mo ON mo.id_modelo = rt.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       WHERE orep.id_orden = ?
       ORDER BY orep.id_repuesto ASC`,
      [req.params.id_orden]
    )
    res.json(
      rows.map(r => ({
        ...r,
        id: packId(r.id_orden, r.id_repuesto),
        registrado_por: r.id_usuario,
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.post('/:id_orden/repuestos', requireAuth, async (req, res) => {
  const { id_repuesto, cantidad_usada } = req.body
  if (!Number.isSafeInteger(Number(cantidad_usada)) || Number(cantidad_usada) <= 0) {
    return res.status(400).json({ message: 'La cantidad de repuestos debe ser un entero positivo.' })
  }
  if (!id_repuesto || !cantidad_usada) {
    return res.status(400).json({ message: 'Faltan campos obligatorios.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await lockOrder(conn, req.params.id_orden, true)

    const [rep] = await conn.query(
      'SELECT stock_disponible AS cantidad, precio FROM vw_stock_repuesto_taller WHERE id_repuesto = ?',
      [id_repuesto]
    )
    if (rep.length === 0) throw new Error('Repuesto no encontrado.')
    if (parseInt(rep[0].cantidad, 10) < parseInt(cantidad_usada, 10)) {
      throw new Error(`Stock insuficiente. Disponible: ${rep[0].cantidad}`)
    }

    const precio_unitario = rep[0].precio

    await conn.query(
      `INSERT INTO orden_repuesto (id_orden, id_repuesto, cantidad_usada, precio_unitario, id_usuario)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad_usada = cantidad_usada + VALUES(cantidad_usada)`,
      [req.params.id_orden, id_repuesto, parseInt(cantidad_usada, 10), precio_unitario, req.usuario.id]
    )

    await recalcularTotalesOrden(conn, req.params.id_orden)
    await conn.commit()

    const [nuevo] = await pool.query(
      `SELECT orep.*, rt.nombre AS nombre_repuesto, ma.nombre AS marca, mo.nombre AS modelo
       FROM orden_repuesto orep
       JOIN repuesto_taller rt ON orep.id_repuesto = rt.id_repuesto
       JOIN modelo mo ON mo.id_modelo = rt.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       WHERE orep.id_orden = ? AND orep.id_repuesto = ?`,
      [req.params.id_orden, id_repuesto]
    )
    res.status(201).json({
      ...nuevo[0],
      id: packId(nuevo[0].id_orden, nuevo[0].id_repuesto),
    })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(400).json({ message: err.message || 'Error interno.' })
  } finally {
    conn.release()
  }
})

// ─── DAÑOS OCULTOS ───────────────────────────────────────────────────────────

router.get('/:id_orden/danos', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         d.*,
         dr.aprobado,
         dr.monto_cubierto_seguro,
         dr.fecha_respuesta
       FROM dano_oculto d
       LEFT JOIN dano_oculto_respuesta dr ON dr.id_orden = d.id_orden AND dr.num_dano = d.num_dano
       WHERE d.id_orden = ?
       ORDER BY d.num_dano ASC`,
      [req.params.id_orden]
    )
    res.json(
      rows.map(r => ({
        ...r,
        id: packId(r.id_orden, r.num_dano),
        aplica_seguro: true,
        estado_aprobacion:
          r.aprobado === null || r.aprobado === undefined
            ? 'pendiente'
            : r.aprobado
              ? 'aprobado'
              : 'rechazado',
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  }
})

router.post('/:id_orden/danos', requireAuth, async (req, res) => {
  const { descripcion, costo_adicional, monto_cubierto_seguro } = req.body
  if (
    typeof descripcion !== 'string' ||
    !descripcion.trim() ||
    costo_adicional === undefined ||
    costo_adicional === ''
  ) {
    return res.status(400).json({ message: 'Escribe la descripción y el costo adicional del daño.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const order = await lockOrder(conn, req.params.id_orden)

    // Asegurar que la orden tenga registro en orden_seguro para cumplir la FK de dano_oculto
    const [segRow] = await conn.query('SELECT id_orden FROM orden_seguro WHERE id_orden = ?', [order.id_orden])
    if (segRow.length === 0) {
      await conn.query(
        'INSERT INTO orden_seguro (id_orden, id_aseguradora, monto_autorizado) VALUES (?, 1, 0)',
        [order.id_orden]
      )
    }

    const [[maxRow]] = await conn.query(
      'SELECT COALESCE(MAX(num_dano), 0) + 1 AS next_dano FROM dano_oculto WHERE id_orden = ?',
      [order.id_orden]
    )
    const numDano = maxRow.next_dano

    await conn.query(
      `INSERT INTO dano_oculto (id_orden, num_dano, descripcion, costo_adicional)
       VALUES (?, ?, ?, ?)`,
      [order.id_orden, numDano, descripcion.trim(), parseFloat(costo_adicional)]
    )

    if (monto_cubierto_seguro !== undefined && monto_cubierto_seguro !== null && monto_cubierto_seguro !== '') {
      await conn.query(
        `INSERT INTO dano_oculto_respuesta (id_orden, num_dano, aprobado, monto_cubierto_seguro)
         VALUES (?, ?, TRUE, ?)`,
        [order.id_orden, numDano, parseFloat(monto_cubierto_seguro)]
      )
    }

    await conn.commit()

    res.status(201).json({
      id: packId(order.id_orden, numDano),
      id_orden: order.id_orden,
      num_dano: numDano,
      descripcion: descripcion.trim(),
      costo_adicional: parseFloat(costo_adicional),
      estado_aprobacion: 'pendiente',
    })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno.' })
  } finally {
    conn.release()
  }
})

module.exports = router