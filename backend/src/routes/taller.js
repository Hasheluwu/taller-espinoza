const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail, number, money, lockOrder } = require('../services/validation')
const { date, photo, profit, appointmentReason } = require('../services/workshop')
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
  } catch (error) { if (conn) await conn.rollback(); next(error) }
  finally { if (conn) conn.release() }
}
const audit = (conn, req, table, id, detail) => conn.query('INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, ?, ?, ?, ?)', [req.usuario.id, table, id, 'editar', detail])
const id = value => number(value, 'Identificador', { positive: true, integer: true })
const text = (value, label) => { if (typeof value !== 'string' || !value.trim() || value.length > 500) fail(`${label}: escribe entre 1 y 500 caracteres.`); return value.trim() }

router.get('/buscar', run(async (conn, req) => {
  const q = String(req.query.q || '').trim().slice(0,100)
  if (!q) return []
  const [rows] = await conn.query(`SELECT o.id, o.estado, v.matricula, c.nombre AS nombre_cliente
    FROM orden o JOIN vehiculo v ON v.id=o.id_vehiculo JOIN cliente c ON c.id=v.id_cliente
    WHERE LOCATE(?,v.matricula)>0 OR LOCATE(?,c.nombre)>0 OR CAST(o.id AS CHAR)=?
    ORDER BY o.id DESC LIMIT 20`,[q,q,q.replace(/^#/, '')])
  return rows
}))

router.get('/vehiculos', run(async conn => {
  const [rows] = await conn.query('SELECT v.*, c.nombre AS cliente FROM vehiculo v JOIN cliente c ON c.id=v.id_cliente ORDER BY v.matricula')
  return rows
}))
router.get('/vehiculos/:id/historial', run(async (conn, req) => {
  const [orders] = await conn.query('SELECT * FROM orden WHERE id_vehiculo=? ORDER BY fecha_ingreso DESC, id DESC', [id(req.params.id)])
  for (const order of orders) {
    const [services] = await conn.query('SELECT descripcion, precio FROM orden_servicio WHERE id_orden=?', [order.id])
    const [materials] = await conn.query('SELECT i.nombre, om.cantidad_usada, i.unidad_medida FROM orden_material om JOIN inventario i ON i.id=om.id_material WHERE om.id_orden=?', [order.id])
    order.servicios = services; order.materiales = materials
  }
  return orders
}))
router.get('/agenda', run(async (conn, req) => {
  const from = date(req.query.desde), to = date(req.query.hasta)
  if (from > to) fail('Revisa el rango de fechas.')
  const [citas] = await conn.query("SELECT c.*, DATE_FORMAT(c.inicio, '%Y-%m-%dT%H:%i') AS inicio, DATE_FORMAT(c.fin, '%Y-%m-%dT%H:%i') AS fin, v.matricula, v.marca, v.modelo, cl.nombre AS cliente FROM cita c JOIN vehiculo v ON v.id=c.id_vehiculo JOIN cliente cl ON cl.id=v.id_cliente WHERE c.inicio < DATE_ADD(?, INTERVAL 1 DAY) AND c.fin >= ? ORDER BY c.inicio", [to, from])
  const delivery = "SELECT o.id, DATE_FORMAT(o.fecha_entrega_estimada,'%Y-%m-%d') AS fecha_entrega_estimada, o.estado, o.tipo, v.matricula, v.marca, v.modelo, cl.nombre AS cliente FROM orden o JOIN vehiculo v ON v.id=o.id_vehiculo JOIN cliente cl ON cl.id=v.id_cliente WHERE o.estado NOT IN ('entregado','cancelado') AND "
  const [entregas] = await conn.query(`${delivery} o.fecha_entrega_estimada BETWEEN ? AND ? ORDER BY o.fecha_entrega_estimada`, [from, to])
  // Promised deliveries already past due, whatever week is displayed.
  const [atrasadas] = await conn.query(`${delivery} o.fecha_entrega_estimada < CURDATE() ORDER BY o.fecha_entrega_estimada`)
  return { citas, entregas, atrasadas }
}))
router.post('/agenda', run(async (conn, req) => {
  const { inicio, fin, motivo, id_vehiculo } = req.body
  for (const value of [inicio, fin]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) fail('Fecha y hora inválidas.')
    date(value.slice(0,10)); if (value.slice(11,13) > '23' || value.slice(14) > '59') fail('Hora inválida.')
  }
  if (fin <= inicio) fail('La cita debe terminar después de su inicio.')
  const [[vehicle]] = await conn.query('SELECT id FROM vehiculo WHERE id=? FOR UPDATE', [id(id_vehiculo)])
  if (!vehicle) fail('Vehículo no encontrado.',404)
  const [overlap] = await conn.query("SELECT id FROM cita WHERE id_vehiculo=? AND estado='programada' AND inicio < ? AND fin > ?", [vehicle.id, fin, inicio])
  if (overlap.length) fail('El vehículo ya tiene una cita en ese horario.',409)
  const [result] = await conn.query('INSERT INTO cita (id_vehiculo,inicio,fin,motivo,creado_por) VALUES (?,?,?,?,?)', [vehicle.id,inicio,fin,appointmentReason(motivo),req.usuario.id])
  await audit(conn,req,'cita',result.insertId,'Cita programada')
  return { id: result.insertId }
}))
router.patch('/agenda/:id', run(async (conn,req) => {
  if (!['completada','cancelada'].includes(req.body.estado)) fail('Estado inválido.')
  const [rows] = await conn.query('SELECT * FROM cita WHERE id=? FOR UPDATE',[id(req.params.id)])
  if (!rows.length) fail('Cita no encontrada.',404)
  if (rows[0].estado !== 'programada') fail('La cita ya está cerrada.',409)
  await conn.query('UPDATE cita SET estado=? WHERE id=?',[req.body.estado,req.params.id])
  await audit(conn,req,'cita',req.params.id,req.body.estado)
  return { message:'Cita actualizada.' }
}))
router.put('/ordenes/:id/entrega', run(async (conn,req) => {
  const order = await lockOrder(conn,req.params.id)
  if (['entregado','cancelado'].includes(order.estado)) fail('La orden ya está cerrada.',409)
  const value = date(req.body.fecha)
  const [[entry]] = await conn.query("SELECT DATE_FORMAT(fecha_ingreso, '%Y-%m-%d') AS dia FROM orden WHERE id=?", [order.id])
  if (value < entry.dia) fail('La entrega no puede ser anterior al ingreso del vehículo.')
  await conn.query('UPDATE orden SET fecha_entrega_estimada=? WHERE id=?',[value,order.id])
  await audit(conn,req,'orden',order.id,`Entrega estimada: ${value}`)
  return { message:'Fecha de entrega actualizada.' }
}))
router.get('/ordenes/:id/fotos', run(async (conn,req) => {
  const [rows] = await conn.query('SELECT id,etapa,descripcion,fecha FROM foto_orden WHERE id_orden=? ORDER BY id DESC',[id(req.params.id)])
  return rows
}))
router.get('/fotos/:id', async (req,res,next) => {
  try {
    const [[row]] = await pool.query('SELECT mime,contenido FROM foto_orden WHERE id=?',[id(req.params.id)])
    if (!row) fail('Foto no encontrada.',404)
    res.set('Cache-Control','private, no-store').set('X-Content-Type-Options','nosniff').type(row.mime).send(row.contenido)
  } catch (error) { next(error) }
})
router.post('/ordenes/:id/fotos', express.json({limit:'5mb'}), run(async (conn,req) => {
  const order = await lockOrder(conn,req.params.id)
  if (order.estado === 'cancelado') fail('Orden cancelada.',409)
  if (!['recepcion','entrega'].includes(req.body.etapa)) fail('Etapa inválida.')
  const file = photo(req.body.imagen)
  const [result] = await conn.query('INSERT INTO foto_orden (id_orden,etapa,descripcion,mime,contenido,creado_por) VALUES (?,?,?,?,?,?)',[order.id,req.body.etapa,String(req.body.descripcion || '').slice(0,500),file.mime,file.bytes,req.usuario.id])
  await audit(conn,req,'foto_orden',result.insertId,`Foto de ${req.body.etapa} adjunta a orden #${order.id}`)
  return { id:result.insertId }
}))
router.get('/ordenes/:id/costos', run(async (conn,req) => {
  const order = await lockOrder(conn,req.params.id)
  const [[costs]] = await conn.query('SELECT * FROM costo_orden WHERE id_orden=?',[order.id])
  const [[labor]] = await conn.query('SELECT COALESCE(SUM(monto_acordado),0) AS total FROM orden_personal WHERE id_orden=?',[order.id])
  const invoice = await require('../services/insuranceInvoices').existing(conn,order.id)
  return profit(invoice ? {...order,subtotal:invoice.documento.subtotal} : order,costs || null,labor.total)
}))
router.put('/ordenes/:id/costos', auth.admin, run(async (conn,req) => {
  const order = await lockOrder(conn,req.params.id)
  const { materiales,repuestos,otros,nota } = req.body
  const values = [money(materiales,'Materiales'),money(repuestos,'Repuestos'),money(otros,'Otros'),text(nota,'Detalle de costos')]
  await conn.query('INSERT INTO costo_orden (id_orden,materiales,repuestos,otros,nota,actualizado_por) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE materiales=VALUES(materiales),repuestos=VALUES(repuestos),otros=VALUES(otros),nota=VALUES(nota),actualizado_por=VALUES(actualizado_por)',[order.id,...values,req.usuario.id])
  await audit(conn,req,'orden',order.id,`Costos revisados: ${JSON.stringify(values)}`)
  return { message:'Costos guardados.' }
}))
module.exports = router
