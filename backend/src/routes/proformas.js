const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail, number } = require('../services/validation')
const service = require('../services/proformas')
const router = express.Router()
router.use(auth)
router.use((req, res, next) => ['administrador', 'secretaria'].includes(req.usuario.rol) ? next() : res.status(403).json({ message: 'No tienes permiso para gestionar proformas.' }))
function run(action, transaction = false) {
  return async (req, res, next) => {
    let conn
    try {
      conn = await pool.getConnection()
      if (transaction) { await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'); await conn.beginTransaction() }
      const result = await action(conn, req)
      if (transaction) await conn.commit()
      res.json(result)
    } catch (err) { if (transaction && conn) await conn.rollback(); next(err) }
    finally { conn?.release() }
  }
}
router.get('/', run(async (conn, req) => {
  const quotation = req.baseUrl === '/api/cotizaciones' || req.query.cotizaciones === 'true'
  const linked = 'EXISTS (SELECT 1 FROM orden linked WHERE linked.id_presupuesto=p.id)'
  const available = !quotation && req.query.disponibles_para_orden === 'true' && req.query.id_vehiculo
  // Insurer scope ("presupuestos con orden") and private scope: own proformas in any phase,
  // plus older ones already linked to an order of that kind.
  const privateScope = req.query.ambito === 'particular'
  const own = `(d.id_presupuesto IS NOT NULL AND COALESCE(d.es_cotizacion,0)=0 AND d.seguro${privateScope ? "='PARTICULAR'" : "<>'PARTICULAR'"})`
  const linkedKind = `EXISTS (SELECT 1 FROM orden kind WHERE kind.id_presupuesto=p.id AND kind.tipo_pago ${privateScope ? "='particular'" : "IN ('lafise','iniser')"})`
  const scope = quotation ? `COALESCE(d.es_cotizacion,0)=1 AND NOT ${linked}` : available ? `NOT ${linked}` : `(${own} OR ${linkedKind})`
  const clauses = [scope], values = []
  if (req.query.q?.trim()) {
    clauses.push("(CAST(d.numero AS CHAR) LIKE ? OR c.nombre LIKE ? OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.datos,'$.placa')),v.matricula) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(d.datos,'$.cliente')) LIKE ?)")
    values.push(...Array(4).fill(`%${String(req.query.q).trim().slice(0,100)}%`))
  }
  if (req.query.fase) { clauses.push("COALESCE(d.fase,'anterior')=?"); values.push(req.query.fase) }
  if (req.query.sin_orden === 'true') clauses.push(`NOT ${linked}`)
  if (req.query.seguro) { clauses.push('d.seguro=?'); values.push(req.query.seguro) }
  if (req.query.id_vehiculo) { clauses.push('p.id_vehiculo=?'); values.push(number(req.query.id_vehiculo, 'Vehículo', { positive: true, integer: true })) }
  for (const [key, op] of [['desde','>='],['hasta','<=']]) if (req.query[key]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query[key])) fail('Fecha de filtro inválida.')
    clauses.push(`p.fecha ${op} ?`); values.push(req.query[key])
  }
  const page = Math.min(100000, number(req.query.page || 1, 'Página', { positive: true, integer: true }))
  const from = `FROM presupuesto p LEFT JOIN vehiculo v ON v.id=p.id_vehiculo LEFT JOIN cliente c ON c.id=v.id_cliente LEFT JOIN proforma_documento d ON d.id_presupuesto=p.id`
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  const [[count]] = await conn.query(`SELECT COUNT(*) AS total ${from}${where}`, values)
  const [rows] = await conn.query(`SELECT p.*, d.numero, COALESCE(d.version,0) AS version, COALESCE(d.fase,'anterior') AS fase,
    COALESCE(d.seguro,UPPER(v.aseguradora)) AS seguro, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.datos,'$.cliente')),c.nombre) AS cliente,
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.datos,'$.placa')),v.matricula) AS matricula, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.datos,'$.marca')),v.marca) AS marca, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.datos,'$.vehiculo')),v.modelo) AS modelo, (SELECT MIN(o.id) FROM orden o WHERE o.id_presupuesto=p.id) AS id_orden
    ${from}${where} ORDER BY p.fecha DESC,p.id DESC LIMIT 25 OFFSET ?`, [...values,(page-1)*25])
  const [stats] = await conn.query(`SELECT COALESCE(d.fase,'anterior') AS fase,COUNT(*) AS cantidad,SUM(NOT ${linked}) AS sin_orden ${from} WHERE ${scope} GROUP BY COALESCE(d.fase,'anterior')`)
  const [reservas] = await conn.query('SELECT numero,seguro,fecha FROM proforma_reserva ORDER BY numero DESC LIMIT 20')
  return { rows, total: Number(count.total), page, pages: Math.max(1,Math.ceil(count.total/25)), stats, reservas }
}))
router.get('/vehiculos', run(async (conn, req) => {
  const q = String(req.query.q || '').trim().slice(0,100)
  if (q.length < 2) return []
  const [rows] = await conn.query(`SELECT v.*,c.nombre AS cliente,c.cedula,c.telefono FROM vehiculo v JOIN cliente c ON c.id=v.id_cliente WHERE v.matricula LIKE ? OR c.nombre LIKE ? OR c.cedula LIKE ? ORDER BY c.nombre LIMIT 20`, Array(3).fill(`%${q}%`))
  return rows
}))
router.get('/numeracion', run(async conn => { const [[row]] = await conn.query('SELECT siguiente FROM proforma_secuencia WHERE id=1'); return row }))
router.put('/numeracion', auth.admin, run(async (conn, req) => {
  const siguiente = number(req.body.siguiente, 'Próximo número', { positive:true, integer:true })
  const [[current]] = await conn.query('SELECT siguiente FROM proforma_secuencia WHERE id=1 FOR UPDATE')
  if (siguiente < current.siguiente || siguiente >= 2147483647) fail('Solo puedes mantener o adelantar el número. Los números anteriores no se reutilizan.')
  await conn.query('UPDATE proforma_secuencia SET siguiente=? WHERE id=1', [siguiente])
  await service.audit(conn, req.usuario.id, 0, 'editar', `Numeración: ${current.siguiente} → ${siguiente}`)
  return { siguiente }
}, true))
router.post('/blanco', run(async (conn, req) => {
  const key = service.text(req.body.solicitud, 'Identificador',64,true)
  await conn.query('SELECT siguiente FROM proforma_secuencia WHERE id=1 FOR UPDATE')
  const [[existing]] = await conn.query('SELECT * FROM proforma_reserva WHERE solicitud=?', [key])
  if (existing) return existing
  const seguro = service.text(req.body.seguro || 'PARTICULAR','Aseguradora',100,true).toUpperCase()
  const numero = await service.nextNumber(conn)
  await conn.query('INSERT INTO proforma_reserva (numero,seguro,fecha,solicitud,creado_por) VALUES (?,?,CURDATE(),?,?)', [numero,seguro,key,req.usuario.id])
  await service.audit(conn,req.usuario.id,0,'crear',`Hoja en blanco reservada: ${numero}`)
  const [[row]] = await conn.query('SELECT * FROM proforma_reserva WHERE numero=?',[numero])
  return row
}, true))
router.get('/:id', run((conn, req) => service.read(conn, req.params.id)))
router.get('/:id/versiones/:version', run(async (conn, req) => {
  const [[row]] = await conn.query('SELECT documento FROM proforma_version WHERE id_presupuesto=? AND version=?', [req.params.id,req.params.version])
  if (!row) fail('Versión no encontrada.',404)
  return service.json(row.documento)
}))
router.post('/', run((conn, req) => service.save(conn, null, req.body, req.usuario.id), true))
router.put('/:id', run((conn, req) => service.save(conn, req.params.id, req.body, req.usuario.id), true))
router.post('/:id/emitir', run((conn, req) => service.emit(conn, req.params.id, req.body.version, req.usuario.id), true))
router.patch('/:id/estado', run((conn, req) => service.changeState(conn, req.params.id, req.body, req.usuario.id), true))
router.post('/:id/orden', run((conn, req) => service.convert(conn, req.params.id, req.body, req.usuario.id), true))
module.exports = router
