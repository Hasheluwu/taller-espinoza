// backend/src/routes/ordenes.js
const express     = require('express')
const pool        = require('../db')
const requireAuth = require('../middleware/authMiddleware')

const router = express.Router()

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
        o.costo_total,
        v.matricula,
        c.nombre  AS nombre_cliente,
        c.cedula
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
    res.json(rows)
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
    res.json(rows[0])
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

  const esConSeguro = tipo_pago === 'lafise' || tipo_pago === 'iniser'

  if (esConSeguro && (!numero_tramite || !numero_orden_seguro)) {
    return res.status(400).json({
      message: 'Número de trámite y número de orden de seguro son obligatorios para órdenes con aseguradora.',
    })
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

  try {
    const [result] = await pool.query(
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
         creado_por
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
         ?
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
        monto_seguro  != null ? parseFloat(monto_seguro)  : null,
        monto_cliente != null ? parseFloat(monto_cliente) : null,
        esConSeguro ? (numero_tramite    ?? null) : null,
        esConSeguro ? (numero_orden_seguro ?? null) : null,
        obra_externa      ? 1 : 0,
        obra_interna      ? 1 : 0,
        danos_ocultos_inicial ? 1 : 0,
        id_usuario,
      ]
    )

    // ── devolver la orden recién creada con datos del vehículo ────────────
    const [nueva] = await pool.query(
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
    try {
      await pool.query(
        `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, fecha_hora, detalle)
         VALUES (?, 'orden', ?, 'crear', NOW(), ?)`,
        [
          id_usuario,
          result.insertId,
          `Orden ${tipo} creada para vehículo ${nueva[0].matricula}, tipo_pago: ${tipo_pago}`,
        ]
      )
    } catch (audErr) {
      // la auditoría no debe bloquear la respuesta
      console.error('Error al registrar auditoría:', audErr)
    }

    res.status(201).json(nueva[0])
  } catch (err) {
    console.error('Error al crear orden:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

module.exports = router