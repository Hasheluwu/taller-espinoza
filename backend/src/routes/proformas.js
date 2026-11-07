// backend/src/routes/proformas.js
const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail, number } = require('../services/validation')
const { resolveMatricula, aseguradoraToSlug } = require('../services/catalogs')
const service = require('../services/proformas')

const router = express.Router()
router.use(auth)
router.use((req, res, next) =>
  ['administrador', 'secretaria'].includes(req.usuario.rol)
    ? next()
    : res.status(403).json({ message: 'No tienes permiso para gestionar proformas.' })
)

function run(action, transaction = false) {
  return async (req, res, next) => {
    let conn
    try {
      conn = await pool.getConnection()
      if (transaction) {
        await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
        await conn.beginTransaction()
      }
      const result = await action(conn, req)
      if (transaction) await conn.commit()
      res.json(result)
    } catch (err) {
      if (transaction && conn) await conn.rollback()
      next(err)
    } finally {
      conn?.release()
    }
  }
}

router.get(
  '/',
  run(async (conn, req) => {
    const available = req.query.disponibles_para_orden === 'true' && req.query.id_vehiculo
    const privateScope = req.query.ambito === 'particular'

    const clauses = ['1=1']
    const values = []

    if (available) {
      const mat = await resolveMatricula(conn, req.query.id_vehiculo)
      clauses.push('p.matricula = ?')
      values.push(mat || '')
      clauses.push('op.id_orden IS NULL')
    } else if (req.query.ambito) {
      if (privateScope) {
        clauses.push('va.id_aseguradora IS NULL')
      } else {
        clauses.push('va.id_aseguradora IS NOT NULL')
      }
    }

    if (req.query.q?.trim()) {
      const q = `%${String(req.query.q).trim().slice(0, 100)}%`
      clauses.push('(CAST(p.id_presupuesto AS CHAR) LIKE ? OR c.nombre LIKE ? OR v.matricula LIKE ?)')
      values.push(q, q, q)
    }

    if (req.query.fase) {
      const mapEstado = {
        borrador: 'pendiente',
        emitida: 'pendiente',
        aprobada: 'aprobado',
        rechazada: 'rechazado',
      }
      if (mapEstado[req.query.fase]) {
        clauses.push('p.estado = ?')
        values.push(mapEstado[req.query.fase])
      }
    }

    if (req.query.sin_orden === 'true') {
      clauses.push('op.id_orden IS NULL')
    }

    if (req.query.id_vehiculo && !available) {
      const mat = await resolveMatricula(conn, req.query.id_vehiculo)
      clauses.push('p.matricula = ?')
      values.push(mat || '')
    }

    for (const [key, op] of [
      ['desde', '>='],
      ['hasta', '<='],
    ]) {
      if (req.query[key]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query[key])) fail('Fecha de filtro inválida.')
        clauses.push(`p.fecha ${op} ?`)
        values.push(req.query[key])
      }
    }

    const page = Math.min(100000, number(req.query.page || 1, 'Página', { positive: true, integer: true }))
    const from = `
      FROM vw_totales_presupuesto p
      JOIN vehiculo v ON v.matricula = p.matricula
      JOIN modelo mo ON mo.id_modelo = v.id_modelo
      JOIN marca ma ON ma.id_marca = mo.id_marca
      JOIN cliente c ON c.id_cliente = v.id_cliente
      LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
      LEFT JOIN aseguradora a ON a.id_aseguradora = va.id_aseguradora
      LEFT JOIN orden_presupuesto op ON op.id_presupuesto = p.id_presupuesto
    `
    const where = ` WHERE ${clauses.join(' AND ')}`
    const [[count]] = await conn.query(`SELECT COUNT(*) AS total ${from}${where}`, values)

    const [rawRows] = await conn.query(
      `SELECT
         p.id_presupuesto AS id,
         p.id_presupuesto,
         p.matricula AS id_vehiculo,
         p.matricula,
         p.fecha,
         p.estado,
         p.subtotal,
         p.iva,
         p.total,
         p.observaciones,
         (17000 + p.id_presupuesto) AS numero,
         1 AS version,
         CASE
           WHEN p.estado = 'aprobado' THEN 'aprobada'
           WHEN p.estado = 'rechazado' THEN 'rechazada'
           ELSE 'emitida'
         END AS fase,
         CASE
           WHEN va.id_aseguradora = 1 THEN 'LAFISE'
           WHEN va.id_aseguradora = 2 THEN 'INISER'
           ELSE 'PARTICULAR'
         END AS seguro,
         c.nombre AS cliente,
         ma.nombre AS marca,
         mo.nombre AS modelo,
         op.id_orden
       ${from}${where}
       ORDER BY p.fecha DESC, p.id_presupuesto DESC
       LIMIT 25 OFFSET ?`,
      [...values, (page - 1) * 25]
    )

    const [stats] = await conn.query(
      `SELECT
         CASE
           WHEN p.estado = 'aprobado' THEN 'aprobada'
           WHEN p.estado = 'rechazado' THEN 'rechazada'
           ELSE 'emitida'
         END AS fase,
         COUNT(*) AS cantidad,
         SUM(op.id_orden IS NULL) AS sin_orden
       ${from}
       GROUP BY fase`
    )

    return {
      rows: rawRows,
      total: Number(count.total),
      page,
      pages: Math.max(1, Math.ceil(count.total / 25)),
      stats,
      reservas: [],
    }
  })
)

router.get(
  '/vehiculos',
  run(async (conn, req) => {
    const q = String(req.query.q || '').trim().slice(0, 100)
    if (q.length < 2) return []
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
         c.nombre AS cliente,
         c.numero_documento AS cedula,
         c.telefono
       FROM vehiculo v
       JOIN modelo mo ON mo.id_modelo = v.id_modelo
       JOIN marca ma ON ma.id_marca = mo.id_marca
       JOIN cliente c ON c.id_cliente = v.id_cliente
       LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
       WHERE v.matricula LIKE ? OR c.nombre LIKE ? OR c.numero_documento LIKE ?
       ORDER BY c.nombre LIMIT 20`,
      Array(3).fill(`%${q}%`)
    )
    return rows.map(r => ({ ...r, aseguradora: aseguradoraToSlug(r.id_aseguradora) }))
  })
)

router.get(
  '/numeracion',
  run(async () => ({ siguiente: 17293 }))
)

router.put(
  '/numeracion',
  auth.admin,
  run(async (_conn, req) => {
    const siguiente = number(req.body.siguiente, 'Próximo número', { positive: true, integer: true })
    return { siguiente }
  })
)

router.post(
  '/blanco',
  run(async (conn, req) => {
    const seguro = service.text(req.body.seguro || 'PARTICULAR', 'Aseguradora', 100, true).toUpperCase()
    const numero = await service.nextNumber(conn)
    return { numero, seguro, fecha: new Date().toISOString().slice(0, 10) }
  })
)

router.get('/:id', run((conn, req) => service.read(conn, req.params.id)))
router.get('/:id/versiones/:version', run((conn, req) => service.read(conn, req.params.id)))
router.post('/', run((conn, req) => service.save(conn, null, req.body, req.usuario.id), true))
router.put('/:id', run((conn, req) => service.save(conn, req.params.id, req.body, req.usuario.id), true))
router.post('/:id/emitir', run((conn, req) => service.emit(conn, req.params.id, req.body.version, req.usuario.id), true))
router.patch('/:id/estado', run((conn, req) => service.changeState(conn, req.params.id, req.body, req.usuario.id), true))
router.post('/:id/orden', run((conn, req) => service.convert(conn, req.params.id, req.body, req.usuario.id), true))

router.get(
  '/:id/cargos-pendientes',
  run(async (conn, req) => {
    const { extras } = await require('../services/proformaUpdate').pendingCharges(
      conn,
      await service.read(conn, req.params.id)
    )
    return { cantidad: extras.length, cargos: extras }
  })
)

router.post(
  '/:id/actualizar-desde-orden',
  run((conn, req) => require('../services/proformaUpdate').updateFromOrder(conn, req.params.id, req.usuario.id), true)
)

module.exports = router