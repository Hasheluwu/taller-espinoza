// backend/src/routes/ordenes.js
const express = require('express')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const { validateDates, requestKey, claim, saveClaimResponse } = require('../services/orderCreation')
const { calculateSummary, summary } = require('../services/billing')
const { lockOrder } = require('../services/validation')
const privateWork = require('../services/privateWork')
const initialActivities = require('../services/initialActivities')
const {
  resolveMatricula,
  tipoOrdenToId,
  tipoOrdenToSlug,
  aseguradoraToId,
  aseguradoraToSlug,
} = require('../services/catalogs')

const router = express.Router()
router.use(require('../middleware/validateNumbers'))
const changeOrderState = require('../handlers/changeOrderState')(pool)
router.put('/:id/estado', requireAuth, changeOrderState)

function mapOrderRow(o) {
  const asegSlug = aseguradoraToSlug(o.id_aseguradora, o.nombre_aseguradora)
  const tipoPago = asegSlug === 'ninguna' ? 'particular' : asegSlug
  const costoTotal = Number(o.costo_total || 0)
  const esSeguro = tipoPago !== 'particular'
  const montoSeguro = esSeguro ? (costoTotal > 0 ? costoTotal : Number(o.monto_autorizado || 0)) : 0
  const montoCliente = esSeguro ? 0 : costoTotal
  const esGarantia = Boolean(o.es_reclamo_garantia || o.tiene_garantia)

  const row = {
    ...o,
    id: o.id_orden,
    id_orden: o.id_orden,
    id_vehiculo: o.matricula,
    tipo: tipoOrdenToSlug(o.id_tipo_orden),
    tipo_pago: tipoPago,
    es_garantia: esGarantia,
    obra_interna: Boolean(o.obra_interna),
    obra_externa: Boolean(o.obra_externa),
    danos_ocultos: Boolean(o.danos_ocultos),
    subtotal: Number(o.subtotal || 0),
    iva: Number(o.iva || 0),
    costo_total: costoTotal,
    monto_seguro: montoSeguro,
    monto_cliente: montoCliente,
    abonado_cliente: Number(o.abonado_cliente || 0),
    abonado_seguro: Number(o.abonado_seguro || 0),
    pagador_unico: 1,
  }

  row.pagado = calculateSummary(
    row,
    [{ monto: row.abonado_cliente }],
    [{ monto: row.abonado_seguro, estado: 'recibido' }]
  ).pagado

  return row
}

// GET /api/ordenes
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
        o.*,
        ma.nombre AS marca,
        mo.nombre AS modelo,
        v.anio_fabricacion,
        v.color,
        c.nombre AS nombre_cliente,
        c.numero_documento AS cedula,
        c.telefono
      FROM vw_totales_orden o
      JOIN vehiculo v ON v.matricula = o.matricula
      JOIN modelo mo ON mo.id_modelo = v.id_modelo
      JOIN marca ma ON ma.id_marca = mo.id_marca
      JOIN cliente c ON c.id_cliente = v.id_cliente
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
    if (fecha_desde) {
      sql += ` AND DATE(o.fecha_ingreso) >= ?`
      params.push(fecha_desde)
    }
    if (fecha_hasta) {
      sql += ` AND DATE(o.fecha_ingreso) <= ?`
      params.push(fecha_hasta)
    }
    if (q && q.trim().length >= 2) {
      sql += ` AND (c.numero_documento LIKE ? OR c.nombre LIKE ? OR v.matricula LIKE ?)`
      const like = `%${q.trim()}%`
      params.push(like, like, like)
    }

    if (orden_costo === 'asc' || orden_costo === 'desc') {
      sql += ` ORDER BY o.costo_total ${orden_costo.toUpperCase()}`
    } else {
      sql += ` ORDER BY o.fecha_ingreso ASC`
    }

    const [rows] = await pool.query(sql, params)
    let mapped = rows.map(mapOrderRow)

    if (tipo) mapped = mapped.filter(r => r.tipo === tipo)
    if (tipo_pago) mapped = mapped.filter(r => r.tipo_pago === tipo_pago)
    if (es_garantia !== undefined && es_garantia !== '') {
      mapped = mapped.filter(r => r.es_garantia === (es_garantia === 'true'))
    }
    if (obra_externa !== undefined && obra_externa !== '') {
      mapped = mapped.filter(r => r.obra_externa === (obra_externa === 'true'))
    }
    if (obra_interna !== undefined && obra_interna !== '') {
      mapped = mapped.filter(r => r.obra_interna === (obra_interna === 'true'))
    }
    if (danos_ocultos !== undefined && danos_ocultos !== '') {
      mapped = mapped.filter(r => r.danos_ocultos === (danos_ocultos === 'true'))
    }

    res.json(mapped)
  } catch (err) {
    console.error('Error al listar órdenes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/ordenes/por-vehiculo/:id_vehiculo
router.get('/por-vehiculo/:id_vehiculo', requireAuth, async (req, res) => {
  try {
    const matricula = await resolveMatricula(pool, req.params.id_vehiculo)
    if (!matricula) return res.json([])

    const [rows] = await pool.query(
      `SELECT * FROM vw_totales_orden
       WHERE matricula = ? AND estado != 'cancelado'
       ORDER BY id_orden DESC`,
      [matricula]
    )
    res.json(rows.map(mapOrderRow))
  } catch (err) {
    console.error('Error al obtener órdenes por vehículo:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/ordenes/buscar?q=XXXX
router.get('/buscar', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'El parámetro de búsqueda debe tener al menos 2 caracteres.' })
  }

  const termino = q.trim()
  const esBusquedaId = termino.startsWith('#')
  const idBuscado = esBusquedaId ? parseInt(termino.slice(1), 10) : NaN

  try {
    let rows
    if (esBusquedaId && !isNaN(idBuscado)) {
      ;[rows] = await pool.query(
        `SELECT o.*, c.nombre AS nombre_cliente
         FROM vw_totales_orden o
         JOIN vehiculo v ON v.matricula = o.matricula
         JOIN cliente c ON c.id_cliente = v.id_cliente
         WHERE o.id_orden = ? AND o.estado != 'cancelado'
         LIMIT 8`,
        [idBuscado]
      )
    } else {
      ;[rows] = await pool.query(
        `SELECT o.*, c.nombre AS nombre_cliente
         FROM vw_totales_orden o
         JOIN vehiculo v ON v.matricula = o.matricula
         JOIN cliente c ON c.id_cliente = v.id_cliente
         WHERE o.matricula LIKE ? AND o.estado != 'cancelado'
         ORDER BY o.id_orden DESC
         LIMIT 8`,
        [`%${termino}%`]
      )
    }
    res.json(rows.map(mapOrderRow))
  } catch (err) {
    console.error('Error al buscar órdenes:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// GET /api/ordenes/:id
router.get('/:id', requireAuth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const order = await lockOrder(conn, req.params.id)
    const [[veh]] = await conn.query(
      `SELECT
         v.matricula,
         ma.nombre AS marca,
         mo.nombre AS modelo,
         v.anio_fabricacion,
         v.color,
         va.id_aseguradora,
         c.nombre AS nombre_cliente,
         c.numero_documento AS cedula,
         c.telefono
       FROM vehiculo v
       JOIN modelo mo ON mo.id_modelo = v.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       JOIN cliente c ON c.id_cliente = v.id_cliente
       LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
       WHERE v.matricula = ?`,
      [order.matricula]
    )
    const balance = await summary(conn, order)
    res.json({
      ...order,
      ...veh,
      aseguradora_vehiculo: aseguradoraToSlug(veh?.id_aseguradora),
      pagado: balance.pagado,
      detalle_particular: null,
    })
  } catch (err) {
    console.error('Error al obtener orden:', err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno del servidor.' })
  } finally {
    conn.release()
  }
})

// POST /api/ordenes
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
    danos_ocultos_inicial,
  } = req.body

  if (!id_vehiculo || !tipo || !fecha_ingreso || !tipo_pago) {
    return res
      .status(400)
      .json({ message: 'Faltan campos obligatorios (id_vehiculo, tipo, fecha_ingreso, tipo_pago).' })
  }

  const tiposValidos = ['pintura', 'mecanica', 'mantenimiento']
  const pagosValidos = ['particular', 'lafise', 'iniser']

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ message: 'Tipo de orden inválido.' })
  }
  if (!pagosValidos.includes(tipo_pago)) {
    return res.status(400).json({ message: 'Tipo de pago inválido.' })
  }

  try {
    requestKey(req.body.solicitud)
    validateDates(req.body)
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message })
  }

  const esConSeguro = tipo_pago === 'lafise' || tipo_pago === 'iniser'
  if (esConSeguro && monto_cliente != null && Number(monto_cliente) !== 0) {
    return res.status(400).json({ message: 'El total de la orden corresponde a la aseguradora.' })
  }

  let tramiteValidado = null
  if (esConSeguro) {
    try {
      tramiteValidado = require('../services/fieldRules').claim(numero_tramite, {
        label: tipo_pago === 'iniser' ? 'Número de reclamo de INISER' : 'Número de trámite de LAFISE',
      })
    } catch (error) {
      return res.status(400).json({ message: error.message })
    }
  }

  const id_usuario = req.usuario.id
  let conn
  try {
    const initial = !esConSeguro
      ? req.body.detalle_particular
        ? privateWork(req.body.detalle_particular)
        : req.body.actividades
          ? initialActivities(req.body.actividades)
          : null
      : null

    conn = await pool.getConnection()
    await conn.beginTransaction()

    const previous = await claim(conn, id_usuario, req.body)
    if (previous) {
      await conn.commit()
      return res.status(200).json(previous)
    }

    const matricula = await resolveMatricula(conn, id_vehiculo)
    if (!matricula) {
      await conn.rollback()
      return res.status(404).json({ message: 'Vehículo no encontrado.' })
    }

    if (id_presupuesto) {
      const [budget] = await conn.query(
        'SELECT id_presupuesto, matricula, estado FROM presupuesto WHERE id_presupuesto = ?',
        [id_presupuesto]
      )
      if (!budget.length || budget[0].matricula !== matricula || budget[0].estado === 'rechazado') {
        await conn.rollback()
        return res.status(400).json({ message: 'El presupuesto debe pertenecer al vehículo y no estar rechazado.' })
      }
    }

    if (id_orden_origen) {
      const [check] = await conn.query('SELECT id_orden FROM orden WHERE id_orden = ?', [id_orden_origen])
      if (check.length === 0) {
        await conn.rollback()
        return res.status(400).json({ message: 'La orden de origen indicada no existe.' })
      }
    }

    const idTipoOrden = tipoOrdenToId(tipo)
    const [result] = await conn.query(
      `INSERT INTO orden
         (matricula, id_tipo_orden, estado, fecha_ingreso, fecha_entrega_estimada, id_usuario)
       VALUES (?, ?, 'recibido', ?, ?, ?)`,
      [matricula, idTipoOrden, fecha_ingreso, fecha_entrega_estimada || null, id_usuario]
    )
    const orderId = result.insertId

    if (id_presupuesto) {
      await conn.query('INSERT INTO orden_presupuesto (id_orden, id_presupuesto) VALUES (?, ?)', [
        orderId,
        id_presupuesto,
      ])
    }

    if (esConSeguro) {
      const idAseg = aseguradoraToId(tipo_pago)
      await conn.query(
        `INSERT INTO orden_seguro (id_orden, id_aseguradora, numero_tramite, numero_orden_seguro, monto_autorizado)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, idAseg, tramiteValidado, numero_orden_seguro || null, Number(monto_seguro || 0)]
      )
    }

    if (es_garantia && fecha_vencimiento_garantia) {
      await conn.query('INSERT INTO garantia (id_orden, num_garantia, fecha_vencimiento) VALUES (?, 1, ?)', [
        orderId,
        fecha_vencimiento_garantia,
      ])
    }

    if (id_orden_origen) {
      if (es_garantia) {
        const [garOrig] = await conn.query(
          'SELECT num_garantia FROM garantia WHERE id_orden = ? ORDER BY num_garantia ASC LIMIT 1',
          [id_orden_origen]
        )
        let numGar = garOrig[0]?.num_garantia
        if (!numGar) {
          await conn.query(
            'INSERT INTO garantia (id_orden, num_garantia, fecha_vencimiento) VALUES (?, 1, DATE_ADD(CURDATE(), INTERVAL 90 DAY))',
            [id_orden_origen]
          )
          numGar = 1
        }
        await conn.query(
          'INSERT INTO reclamo_garantia (id_orden, id_orden_origen, num_garantia) VALUES (?, ?, ?)',
          [orderId, id_orden_origen, numGar]
        )
      } else if (danos_ocultos_inicial) {
        await conn.query('INSERT INTO orden_dano_particular (id_orden, id_orden_origen) VALUES (?, ?)', [
          orderId,
          id_orden_origen,
        ])
      }
    }

    if (initial) {
      let numLinea = 1
      for (const activity of initial.activities) {
        await conn.query(
          'INSERT INTO orden_servicio (id_orden, num_linea, descripcion, precio, aplica_iva) VALUES (?, ?, ?, ?, ?)',
          [orderId, numLinea, activity.descripcion, activity.precio, activity.aplica_iva ? 1 : 0]
        )
        numLinea += 1
      }
    }

    const nuevaOrden = await lockOrder(conn, orderId)
    const [[veh]] = await conn.query(
      `SELECT ma.nombre AS marca, mo.nombre AS modelo, v.anio_fabricacion, c.nombre AS nombre_cliente, c.numero_documento AS cedula
       FROM vehiculo v
       JOIN modelo mo ON mo.id_modelo = v.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       JOIN cliente c ON c.id_cliente = v.id_cliente
       WHERE v.matricula = ?`,
      [matricula]
    )

    const payload = { ...nuevaOrden, ...veh }

    await conn.query(
      `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, fecha_hora, detalle)
       VALUES (?, 'orden', ?, 'crear', NOW(), ?)`,
      [id_usuario, String(orderId), `Orden ${tipo} creada para vehículo ${matricula}, tipo_pago: ${tipo_pago}`]
    )

    saveClaimResponse(id_usuario, req.body.solicitud, payload)
    await conn.commit()
    res.status(201).json(payload)
  } catch (err) {
    if (conn) await conn.rollback()
    console.error('Error al crear orden:', err)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Error interno del servidor.' })
  } finally {
    conn?.release()
  }
})

module.exports = router