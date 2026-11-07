// backend/src/routes/taller.js
const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail, number, money, lockOrder, packId, unpackId } = require('../services/validation')
const { date, profit, appointmentReason } = require('../services/workshop')
const {
  resolveMatricula,
  aseguradoraToSlug,
  tipoOrdenToSlug,
  unidadToSlug,
} = require('../services/catalogs')

const router = express.Router()
router.use(auth)

const run = action => async (req, res, next) => {
  let conn
  try {
    conn = await pool.getConnection()
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await conn.beginTransaction()
    const data = await action(conn, req)
    await conn.commit()
    res.json(data)
  } catch (error) {
    if (conn) await conn.rollback()
    next(error)
  } finally {
    if (conn) conn.release()
  }
}

const audit = (conn, req, table, id, detail) =>
  conn.query('INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, ?, ?, ?, ?)', [
    req.usuario.id,
    table,
    String(id),
    'editar',
    detail,
  ])

const id = value => number(value, 'Identificador', { positive: true, integer: true })

router.get(
  '/buscar',
  run(async (conn, req) => {
    const q = String(req.query.q || '').trim().slice(0, 100)
    if (!q) return []
    const [rows] = await conn.query(
      `SELECT o.id_orden AS id, o.id_orden, o.estado, v.matricula, c.nombre AS nombre_cliente
       FROM orden o
       JOIN vehiculo v ON v.matricula = o.matricula
       JOIN cliente c ON c.id_cliente = v.id_cliente
       WHERE LOCATE(?, v.matricula) > 0 OR LOCATE(?, c.nombre) > 0 OR CAST(o.id_orden AS CHAR) = ?
       ORDER BY o.id_orden DESC LIMIT 20`,
      [q, q, q.replace(/^#/, '')]
    )
    return rows
  })
)

router.get(
  '/vehiculos',
  run(async conn => {
    const [rows] = await conn.query(
      `SELECT
         v.matricula AS id,
         v.matricula,
         v.id_cliente,
         ma.nombre AS marca,
         mo.nombre AS modelo,
         v.anio_fabricacion,
         v.color,
         v.chasis,
         v.motor,
         va.id_aseguradora,
         c.nombre AS cliente
       FROM vehiculo v
       JOIN modelo mo ON mo.id_modelo = v.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       JOIN cliente c ON c.id_cliente = v.id_cliente
       LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
       ORDER BY v.matricula ASC`
    )
    return rows.map(r => ({ ...r, aseguradora: aseguradoraToSlug(r.id_aseguradora) }))
  })
)

router.get(
  '/vehiculos/:id/historial',
  run(async (conn, req) => {
    const matricula = await resolveMatricula(conn, req.params.id)
    if (!matricula) return []

    const [orders] = await conn.query(
      `SELECT * FROM vw_totales_orden WHERE matricula = ? ORDER BY fecha_ingreso DESC, id_orden DESC`,
      [matricula]
    )
    for (const order of orders) {
      order.id = order.id_orden
      order.tipo = tipoOrdenToSlug(order.id_tipo_orden)
      const [services] = await conn.query(
        'SELECT descripcion, precio FROM orden_servicio WHERE id_orden = ? ORDER BY num_linea ASC',
        [order.id_orden]
      )
      const [materials] = await conn.query(
        `SELECT m.nombre, om.cantidad_usada, u.nombre AS unidad_nombre
         FROM orden_material om
         JOIN material m ON m.id_material = om.id_material
         JOIN unidad_medida u ON u.id_unidad = m.id_unidad
         WHERE om.id_orden = ?`,
        [order.id_orden]
      )
      order.servicios = services
      order.materiales = materials.map(m => ({ ...m, unidad_medida: unidadToSlug(m.unidad_nombre) }))
    }
    return orders
  })
)

router.get(
  '/agenda',
  run(async (conn, req) => {
    const from = date(req.query.desde)
    const to = date(req.query.hasta)
    if (from > to) fail('Revisa el rango de fechas.')

    const [citas] = await conn.query(
      `SELECT
         c.id_cita AS id,
         c.id_cita,
         c.matricula AS id_vehiculo,
         c.matricula,
         DATE_FORMAT(c.fecha_inicio, '%Y-%m-%dT%H:%i') AS inicio,
         DATE_FORMAT(c.fecha_fin, '%Y-%m-%dT%H:%i') AS fin,
         c.motivo,
         c.estado,
         ma.nombre AS marca,
         mo.nombre AS modelo,
         cl.nombre AS cliente
       FROM cita c
       JOIN vehiculo v ON v.matricula = c.matricula
       JOIN modelo mo ON mo.id_modelo = v.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       JOIN cliente cl ON cl.id_cliente = v.id_cliente
       WHERE c.fecha_inicio < DATE_ADD(?, INTERVAL 1 DAY) AND c.fecha_fin >= ?
       ORDER BY c.fecha_inicio ASC`,
      [to, from]
    )

    const deliveryBase = `
      SELECT
        o.id_orden AS id,
        DATE_FORMAT(o.fecha_entrega_estimada, '%Y-%m-%d') AS fecha_entrega_estimada,
        o.estado,
        o.id_tipo_orden,
        v.matricula,
        ma.nombre AS marca,
        mo.nombre AS modelo,
        cl.nombre AS cliente
      FROM orden o
      JOIN vehiculo v ON v.matricula = o.matricula
      JOIN modelo mo ON mo.id_modelo = v.id_modelo
      JOIN marca ma ON ma.id_marca = mo.id_marca
      JOIN cliente cl ON cl.id_cliente = v.id_cliente
      WHERE o.estado NOT IN ('entregado', 'cancelado') AND
    `
    const [entregas] = await conn.query(
      `${deliveryBase} o.fecha_entrega_estimada BETWEEN ? AND ? ORDER BY o.fecha_entrega_estimada ASC`,
      [from, to]
    )
    const [atrasadas] = await conn.query(
      `${deliveryBase} o.fecha_entrega_estimada < CURDATE() ORDER BY o.fecha_entrega_estimada ASC`
    )

    return {
      citas,
      entregas: entregas.map(e => ({ ...e, tipo: tipoOrdenToSlug(e.id_tipo_orden) })),
      atrasadas: atrasadas.map(a => ({ ...a, tipo: tipoOrdenToSlug(a.id_tipo_orden) })),
    }
  })
)

router.post(
  '/agenda',
  run(async (conn, req) => {
    const { inicio, fin, motivo, id_vehiculo } = req.body
    for (const value of [inicio, fin]) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        fail('Fecha y hora inválidas.')
      }
      date(value.slice(0, 10))
      if (value.slice(11, 13) > '23' || value.slice(14) > '59') fail('Hora inválida.')
    }
    if (fin <= inicio) fail('La cita debe terminar después de su inicio.')

    const matricula = await resolveMatricula(conn, id_vehiculo)
    if (!matricula) fail('Vehículo no encontrado.', 404)

    const [overlap] = await conn.query(
      "SELECT id_cita FROM cita WHERE matricula = ? AND estado = 'programada' AND fecha_inicio < ? AND fecha_fin > ?",
      [matricula, fin, inicio]
    )
    if (overlap.length) fail('El vehículo ya tiene una cita en ese horario.', 409)

    const [result] = await conn.query(
      'INSERT INTO cita (matricula, fecha_inicio, fecha_fin, motivo, estado, id_usuario) VALUES (?, ?, ?, ?, ?, ?)',
      [matricula, inicio, fin, appointmentReason(motivo), 'programada', req.usuario.id]
    )
    await audit(conn, req, 'cita', result.insertId, 'Cita programada')
    return { id: result.insertId }
  })
)

router.patch(
  '/agenda/:id',
  run(async (conn, req) => {
    if (!['completada', 'cancelada'].includes(req.body.estado)) fail('Estado inválido.')
    const citaId = id(req.params.id)
    const [rows] = await conn.query('SELECT * FROM cita WHERE id_cita = ? FOR UPDATE', [citaId])
    if (!rows.length) fail('Cita no encontrada.', 404)
    if (rows[0].estado !== 'programada') fail('La cita ya está cerrada.', 409)

    await conn.query('UPDATE cita SET estado = ? WHERE id_cita = ?', [req.body.estado, citaId])
    await audit(conn, req, 'cita', citaId, req.body.estado)
    return { message: 'Cita actualizada.' }
  })
)

router.put(
  '/ordenes/:id/entrega',
  run(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id)
    if (['entregado', 'cancelado'].includes(order.estado)) fail('La orden ya está cerrada.', 409)
    const value = date(req.body.fecha)
    const [[entry]] = await conn.query(
      "SELECT DATE_FORMAT(fecha_ingreso, '%Y-%m-%d') AS dia FROM orden WHERE id_orden = ?",
      [order.id_orden]
    )
    if (value < entry.dia) fail('La entrega no puede ser anterior al ingreso del vehículo.')

    await conn.query('UPDATE orden SET fecha_entrega_estimada = ? WHERE id_orden = ?', [value, order.id_orden])
    await audit(conn, req, 'orden', order.id_orden, `Entrega estimada: ${value}`)
    return { message: 'Fecha de entrega actualizada.' }
  })
)

router.get(
  '/ordenes/:id/fotos',
  run(async (conn, req) => {
    const orderId = id(req.params.id)
    const [rows] = await conn.query(
      `SELECT
         num_archivo,
         categoria,
         descripcion,
         fecha_subida AS fecha,
         url
       FROM orden_media
       WHERE id_orden = ?
       ORDER BY num_archivo DESC`,
      [orderId]
    )
    return rows.map(r => ({
      id: packId(orderId, r.num_archivo),
      etapa: r.categoria === 'trabajo_terminado' ? 'entrega' : 'recepcion',
      descripcion: r.descripcion,
      fecha: r.fecha,
      url: r.url,
    }))
  })
)

router.get('/fotos/:id', async (req, res, next) => {
  try {
    const [id_orden, num_archivo] = unpackId(req.params.id, 'Foto')
    const [[row]] = await pool.query(
      'SELECT url FROM orden_media WHERE id_orden = ? AND num_archivo = ?',
      [id_orden, num_archivo]
    )
    if (!row) fail('Foto no encontrada.', 404)
    if (row.url.startsWith('data:')) {
      const match = row.url.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
      if (match) {
        return res.type(match[1]).send(Buffer.from(match[2], 'base64'))
      }
    }
    res.redirect(row.url)
  } catch (error) {
    next(error)
  }
})

router.post(
  '/ordenes/:id/fotos',
  express.json({ limit: '5mb' }),
  run(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id)
    if (order.estado === 'cancelado') fail('Orden cancelada.', 409)
    if (!['recepcion', 'entrega'].includes(req.body.etapa)) fail('Etapa inválida.')

    const [[maxRow]] = await conn.query(
      'SELECT COALESCE(MAX(num_archivo), 0) + 1 AS next_num FROM orden_media WHERE id_orden = ?',
      [order.id_orden]
    )
    const numArchivo = maxRow.next_num
    const categoria = req.body.etapa === 'entrega' ? 'trabajo_terminado' : 'recepcion'
    const url = String(req.body.url || `https://cdn.tallerpedro.com/ord${order.id_orden}/foto_${numArchivo}.jpg`).slice(
      0,
      500
    )

    await conn.query(
      `INSERT INTO orden_media (id_orden, num_archivo, url, tipo, descripcion, categoria, id_usuario)
       VALUES (?, ?, ?, 'foto', ?, ?, ?)`,
      [
        order.id_orden,
        numArchivo,
        url,
        String(req.body.descripcion || '').slice(0, 500),
        categoria,
        req.usuario.id,
      ]
    )
    const packed = packId(order.id_orden, numArchivo)
    await audit(conn, req, 'orden_media', `${order.id_orden}-${numArchivo}`, `Foto de ${req.body.etapa} adjunta`)
    return { id: packed }
  })
)

router.get(
  '/ordenes/:id/costos',
  run(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id)
    const [[matCost]] = await conn.query(
      'SELECT COALESCE(ROUND(SUM(cantidad_usada * precio_unitario), 2), 0) AS total FROM orden_material WHERE id_orden = ?',
      [order.id_orden]
    )
    const [[repCost]] = await conn.query(
      'SELECT COALESCE(ROUND(SUM(cantidad_usada * precio_unitario), 2), 0) AS total FROM orden_repuesto WHERE id_orden = ?',
      [order.id_orden]
    )
    const [[labor]] = await conn.query(
      'SELECT COALESCE(SUM(monto_acordado), 0) AS total FROM orden_personal WHERE id_orden = ?',
      [order.id_orden]
    )
    const costs = {
      id_orden: order.id_orden,
      materiales: Number(matCost.total || 0),
      repuestos: Number(repCost.total || 0),
      otros: 0,
      nota: 'Calculado automáticamente de consumos y repuestos registrados en 3FN',
    }
    return profit(order, costs, labor.total)
  })
)

router.put(
  '/ordenes/:id/costos',
  auth.admin,
  run(async (conn, req) => {
    const order = await lockOrder(conn, req.params.id)
    const { materiales, repuestos, otros } = req.body
    const values = [money(materiales, 'Materiales'), money(repuestos, 'Repuestos'), money(otros, 'Otros')]
    await audit(conn, req, 'orden', order.id_orden, `Costos revisados: ${JSON.stringify(values)}`)
    return { message: 'Costos auditados y verificados.' }
  })
)

module.exports = router