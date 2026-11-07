const { validateDates, requestKey, claim } = require('../services/orderCreation')
// backend/src/routes/ordenes.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const { calculateSummary, summary } = require('../services/billing')
const privateWork = require('../services/privateWork')
const initialActivities = require('../services/initialActivities')
const router = express.Router()
router.use(require('../middleware/validateNumbers'))
const changeOrderState = require('../handlers/changeOrderState')(pool)
router.put('/:id/estado', requireAuth, changeOrderState)

// ─── GET /api/ordenes ─────────────────────────────────────────────────────────
// Lista todas las órdenes con filtros opcionales via query params.
// Usado por VerOrdenes.jsx
router.get('/', requireAuth, async (req, res) => {
  const {
    q,
    estado,
    tipo,
    tipo_pago,
    es_garantia,
    obra_externa,
    obra_interna,
    danos_ocultos,
    fecha_desde,
    fecha_hasta,
    orden_costo,
    solo_activas,
  } = req.query

  try {
    let sql = `
      SELECT
        o.id,
        o.tipo,
        o.estado,
        o.tipo_pago,
        o.es_garantia,
        o.obra_externa,
        o.obra_interna,
        o.danos_ocultos,
        o.fecha_ingreso,
        o.fecha_entrega_estimada,
        o.id_presupuesto, o.costo_total, o.monto_cliente, o.monto_seguro, o.pagador_unico,
        (SELECT f.estado FROM factura_seguro f WHERE f.id_orden=o.id) AS estado_factura,
        (SELECT COALESCE(SUM(pc.monto), 0) FROM pago_cliente pc WHERE pc.id_orden = o.id) AS abonado_cliente,
        (SELECT COALESCE(SUM(ps.monto), 0) FROM pago_seguro ps WHERE ps.id_orden = o.id AND ps.estado = 'recibido') AS abonado_seguro,
        v.matricula,
        c.nombre  AS nombre_cliente,
        c.cedula, c.telefono
      FROM orden o
      JOIN vehiculo v ON v.id = o.id_vehiculo
      JOIN cliente  c ON c.id = v.id_cliente
      WHERE 1=1
    `
    const params = []

    if (solo_activas === 'true') {
      sql += ` AND o.estado NOT IN ('entregado', 'cancelado')`
    }
    if (estado) {
      sql += ` AND o.estado = ?`
      params.push(estado)
    }
    if (tipo) {
      sql += ` AND o.tipo = ?`
      params.push(tipo)
    }
    if (tipo_pago) {
      sql += ` AND o.tipo_pago = ?`
      params.push(tipo_pago)
    }
    if (es_garantia !== undefined && es_garantia !== '') {
      sql += ` AND o.es_garantia = ?`
      params.push(es_garantia === 'true' ? 1 : 0)
    }
    if (obra_externa !== undefined && obra_externa !== '') {
      sql += ` AND o.obra_externa = ?`
      params.push(obra_externa === 'true' ? 1 : 0)
    }
    if (obra_interna !== undefined && obra_interna !== '') {
      sql += ` AND o.obra_interna = ?`
      params.push(obra_interna === 'true' ? 1 : 0)
    }
    if (danos_ocultos !== undefined && danos_ocultos !== '') {
      sql += ` AND o.danos_ocultos = ?`
      params.push(danos_ocultos === 'true' ? 1 : 0)
    }
    if (fecha_desde) {
      sql += ` AND DATE(o.fecha_ingreso) >= ?`
      params.push(fecha_desde)
    }
    if (fecha_hasta) {
      sql += ` AND DATE(o.fecha_ingreso) <= ?`
      params.push(fecha_hasta)
    }
    if (q && q.trim().length >= 2) {
      sql += ` AND (c.cedula LIKE ? OR c.nombre LIKE ? OR v.matricula LIKE ?)`
      const like = `%${q.trim()}%`
      params.push(like, like, like)
    }

    if (orden_costo === 'asc' || orden_costo === 'desc') {
      sql += ` ORDER BY o.costo_total ${orden_costo.toUpperCase()}`
    } else {
      sql += ` ORDER BY o.fecha_ingreso ASC`
    }

    const [rows] = await pool.query(sql, params)
    res.json(rows.map(o => ({ ...o, pagado: o.estado_factura ? o.estado_factura === 'pagada' : calculateSummary(o, [{ monto: o.abonado_cliente }], [{ monto: o.abonado_seguro, estado: 'recibido' }]).pagado })))
  } catch (err) {
    console.error('Error al listar órdenes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/ordenes/por-vehiculo/:id_vehiculo ───────────────────────────────
// Todas las órdenes de un vehículo concreto, ordenadas de más reciente a más antigua.
// Usado por el selector de orden de origen en el paso 4.
// Excluye canceladas. Sin límite — un vehículo no tendrá cientos de órdenes.
router.get('/por-vehiculo/:id_vehiculo', requireAuth, async (req, res) => {
  const id_vehiculo = parseInt(req.params.id_vehiculo, 10)
  if (isNaN(id_vehiculo)) {
    return res.status(400).json({ message: 'id_vehiculo inválido.' })
  }
  try {
    const [rows] = await pool.query(
      `SELECT
         o.id,
         v.matricula,
         o.tipo,
         o.estado,
         o.tipo_pago,
         o.fecha_ingreso,
         o.es_garantia
       FROM orden o
       JOIN vehiculo v ON v.id = o.id_vehiculo
       WHERE o.id_vehiculo = ?
         AND o.estado != 'cancelado'
       ORDER BY o.id DESC`,
      [id_vehiculo]
    )
    res.json(rows)
  } catch (err) {
    console.error('Error al obtener órdenes por vehículo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/ordenes/buscar?q=XXXX ───────────────────────────────────────────
// Búsqueda libre por matrícula o ID. Queda disponible para uso general futuro
// (Ver Órdenes, Linker LAFISE, etc.) aunque el paso 4 ya no lo usa.
router.get('/buscar', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'El parámetro de búsqueda debe tener al menos 2 caracteres.' })
  }

  const termino      = q.trim()
  const esBusquedaId = termino.startsWith('#')
  const idBuscado    = esBusquedaId ? parseInt(termino.slice(1), 10) : NaN

  try {
    let rows
    if (esBusquedaId && !isNaN(idBuscado)) {
      ;[rows] = await pool.query(
        `SELECT o.id, v.matricula, o.tipo, o.estado, o.tipo_pago, o.fecha_ingreso,
                c.nombre AS nombre_cliente
         FROM orden o
         JOIN vehiculo v ON v.id = o.id_vehiculo
         JOIN cliente  c ON c.id = v.id_cliente
         WHERE o.id = ? AND o.estado != 'cancelado'
         LIMIT 8`,
        [idBuscado]
      )
    } else {
      ;[rows] = await pool.query(
        `SELECT o.id, v.matricula, o.tipo, o.estado, o.tipo_pago, o.fecha_ingreso,
                c.nombre AS nombre_cliente
         FROM orden o
         JOIN vehiculo v ON v.id = o.id_vehiculo
         JOIN cliente  c ON c.id = v.id_cliente
         WHERE v.matricula LIKE ? AND o.estado != 'cancelado'
         ORDER BY o.id DESC
         LIMIT 8`,
        [`%${termino}%`]
      )
    }
    res.json(rows)
  } catch (err) {
    console.error('Error al buscar órdenes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── GET /api/ordenes/:id ─────────────────────────────────────────────────────
// Detalle completo de una orden.
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         o.*,
         v.matricula, v.marca, v.modelo, v.anio_fabricacion, v.color,
         v.aseguradora AS aseguradora_vehiculo,
         c.nombre AS nombre_cliente, c.cedula, c.telefono
       FROM orden o
       JOIN vehiculo v ON v.id = o.id_vehiculo
       JOIN cliente  c ON c.id = v.id_cliente
       WHERE o.id = ?`,
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Orden no encontrada.' })
    const balance = await summary(pool, rows[0])
    const [[document]] = await pool.query('SELECT detalle, observaciones FROM orden_particular_documento WHERE id_orden=?', [req.params.id])
    res.json({ ...rows[0], pagado: balance.pagado, detalle_particular: document ? { ...(typeof document.detalle === 'string' ? JSON.parse(document.detalle) : document.detalle), observaciones: document.observaciones } : null })
  } catch (err) {
    console.error('Error al obtener orden:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// ─── POST /api/ordenes ────────────────────────────────────────────────────────
// Crea una orden nueva. El estado arranca en 'recibido', danos_ocultos en false.
// creado_por se toma del token JWT. fecha_creacion la pone MySQL con CURRENT_TIMESTAMP.
router.post('/', requireAuth, async (req, res) => {
  const {
    id_vehiculo,
    id_presupuesto,
    id_orden_origen,
    tipo,
    fecha_ingreso,
    fecha_entrega_estimada,
    es_garantia,
    fecha_vencimiento_garantia,
    tipo_pago,
    numero_tramite,
    numero_orden_seguro,
    monto_seguro,
    monto_cliente,
    obra_externa,
    obra_interna,
    danos_ocultos_inicial,   // true solo si la orden viene de daño oculto particular
  } = req.body

  // ── validaciones básicas ──────────────────────────────────────────────────
  if (!id_vehiculo || !tipo || !fecha_ingreso || !tipo_pago) {
    return res.status(400).json({ message: 'Faltan campos obligatorios (id_vehiculo, tipo, fecha_ingreso, tipo_pago).' })
  }

  const tiposValidos   = ['pintura', 'mecanica', 'mantenimiento']
  const pagosValidos   = ['particular', 'lafise', 'iniser']

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ message: 'Tipo de orden inválido.' })
  }
  if (!pagosValidos.includes(tipo_pago)) {
    return res.status(400).json({ message: 'Tipo de pago inválido.' })
  }

  try { requestKey(req.body.solicitud); validateDates(req.body) }
  catch (error) { return res.status(error.status || 400).json({ message: error.message }) }

  const esConSeguro = tipo_pago === 'lafise' || tipo_pago === 'iniser'

  if (esConSeguro && monto_cliente != null && Number(monto_cliente) !== 0) return res.status(400).json({ message: 'El total de la orden corresponde a la aseguradora.' })

  let tramiteValidado = null
  if (esConSeguro) {
    try { tramiteValidado = require('../services/fieldRules').claim(numero_tramite, { label: tipo_pago === 'iniser' ? 'Número de reclamo de INISER' : 'Número de trámite de LAFISE' }) }
    catch (error) { return res.status(400).json({ message: error.message }) }
  }

  if (id_presupuesto) {
    const [managed] = await pool.query('SELECT id_presupuesto FROM proforma_documento WHERE id_presupuesto=?', [id_presupuesto])
    if (managed.length) return res.status(409).json({ message: 'Crea la orden desde la proforma aprobada para trasladar sus cargos una sola vez.' })
    const [budget] = await pool.query('SELECT id, id_vehiculo, estado FROM presupuesto WHERE id = ?', [id_presupuesto])
    if (!budget.length || Number(budget[0].id_vehiculo) !== Number(id_vehiculo) || budget[0].estado === 'rechazado') {
      return res.status(400).json({ message: 'El presupuesto debe pertenecer al vehículo y no estar rechazado.' })
    }
  }
  // si tiene id_orden_origen, verificar que esa orden exista
  if (id_orden_origen) {
    try {
      const [check] = await pool.query('SELECT id FROM orden WHERE id = ?', [id_orden_origen])
      if (check.length === 0) {
        return res.status(400).json({ message: 'La orden de origen indicada no existe.' })
      }
    } catch (err) {
      console.error('Error al verificar orden de origen:', err)
      return res.status(500).json({ message: 'Error interno del servidor.' })
    }
  }

  // ── insert ────────────────────────────────────────────────────────────────
  const id_usuario = req.usuario.id   // viene del middleware JWT (req.usuario según authMiddleware)

  let conn
  try {
    const initial = !esConSeguro ? (req.body.detalle_particular ? privateWork(req.body.detalle_particular) : initialActivities(req.body.actividades)) : null
    conn = await pool.getConnection()
    await conn.beginTransaction()
    const previous = await claim(conn, id_usuario, req.body)
    if (previous) { await conn.commit(); return res.status(200).json(previous) }
    const [result] = await conn.query(
      `INSERT INTO orden (
         id_vehiculo,
         id_presupuesto,
         id_orden_origen,
         tipo,
         fecha_ingreso,
         fecha_entrega_estimada,
         fecha_entrega_real,
         estado,
         es_garantia,
         fecha_vencimiento_garantia,
         tipo_pago,
         subtotal,
         iva,
         costo_total,
         monto_seguro,
         monto_cliente,
         numero_tramite,
         numero_orden_seguro,
         numero_factura_fisica,
         obra_externa,
         obra_interna,
         danos_ocultos,
         fecha_creacion,
         creado_por,
         pagador_unico
       ) VALUES (
         ?, ?, ?, ?, ?, ?, NULL,
         'recibido',
         ?, ?,
         ?,
         NULL, NULL, NULL,
         ?, ?,
         ?, ?,
         NULL,
         ?, ?,
         ?,
         CURRENT_TIMESTAMP,
         ?, TRUE
       )`,
      [
        id_vehiculo,
        id_presupuesto  ?? null,
        id_orden_origen ?? null,
        tipo,
        fecha_ingreso,
        fecha_entrega_estimada ?? null,
        es_garantia ? 1 : 0,
        (es_garantia && fecha_vencimiento_garantia) ? fecha_vencimiento_garantia : null,
        tipo_pago,
        null,
        esConSeguro ? 0 : null,
        esConSeguro ? tramiteValidado : null,
        esConSeguro ? (numero_orden_seguro ?? null) : null,
        obra_externa      ? 1 : 0,
        obra_interna      ? 1 : 0,
        danos_ocultos_inicial ? 1 : 0,
        id_usuario,
      ]
    )

    if (initial) {
      for (const activity of initial.activities) {
        await conn.query('INSERT INTO orden_servicio (id_orden, descripcion, precio, aplica_iva) VALUES (?, ?, ?, ?)',
          [result.insertId, activity.descripcion, activity.precio, activity.aplica_iva])
      }
      await conn.query('UPDATE orden SET subtotal=?, iva=?, costo_total=?, monto_cliente=?, monto_seguro=0 WHERE id=?',
        [initial.subtotal, initial.iva, initial.total, initial.total, result.insertId])
    }

    if (initial && req.body.detalle_particular) {
      await conn.query('INSERT INTO orden_particular_documento (id_orden,detalle,observaciones) VALUES (?,?,?)',
        [result.insertId, JSON.stringify({ detalles: initial.detalles, mano_obra_global: initial.mano_obra_global }), initial.observaciones])
      // The agreed concepts already include materials and parts; consumption only changes stock/cost.
      await conn.query('UPDATE orden SET cargos_desde_proforma=TRUE WHERE id=?', [result.insertId])
    }

    // ── devolver la orden recién creada con datos del vehículo ────────────
    const [nueva] = await conn.query(
      `SELECT
         o.*,
         v.matricula, v.marca, v.modelo, v.anio_fabricacion,
         c.nombre AS nombre_cliente, c.cedula
       FROM orden o
       JOIN vehiculo v ON v.id = o.id_vehiculo
       JOIN cliente  c ON c.id = v.id_cliente
       WHERE o.id = ?`,
      [result.insertId]
    )

    // ── registrar en auditoría ────────────────────────────────────────────
    {
      await conn.query(
        `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, fecha_hora, detalle)
         VALUES (?, 'orden', ?, 'crear', NOW(), ?)`,
        [
          id_usuario,
          result.insertId,
          `Orden ${tipo} creada para vehículo ${nueva[0].matricula}, tipo_pago: ${tipo_pago}`,
        ]
      )
    }

    await conn.query('UPDATE orden_solicitud SET respuesta=? WHERE id_usuario=? AND solicitud=?', [JSON.stringify(nueva[0]), id_usuario, req.body.solicitud])
    await conn.commit()
    res.status(201).json(nueva[0])
  } catch (err) {
    if (conn) await conn.rollback()
    console.error('Error al crear orden:', err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno del servidor.' })
  } finally {
    conn?.release()
  }
})

module.exports = router



