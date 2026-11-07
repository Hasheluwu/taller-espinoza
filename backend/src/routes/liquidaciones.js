// backend/src/routes/liquidaciones.js
const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail, number, cents, packId, unpackId } = require('../services/validation')
const { date } = require('../services/workshop')

const router = express.Router()
router.use(auth, auth.admin)

const run = action => async (req, res, next) => {
  let conn
  try {
    conn = await pool.getConnection()
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await conn.beginTransaction()
    const result = await action(conn, req)
    await conn.commit()
    res.json(result)
  } catch (e) {
    if (conn) await conn.rollback()
    next(e)
  } finally {
    if (conn) conn.release()
  }
}

const audit = (conn, req, id, detail) =>
  conn.query('INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, ?, ?, ?, ?)', [
    req.usuario.id,
    'liquidacion',
    String(id),
    'editar',
    detail,
  ])

router.get(
  '/:id_personal',
  run(async (conn, req) => {
    const person = number(req.params.id_personal, 'Trabajador', { positive: true, integer: true })

    const [rawTrabajos] = await conn.query(
      `SELECT
         op.*,
         o.estado,
         o.matricula,
         ld.id_liquidacion
       FROM orden_personal op
       JOIN orden o ON o.id_orden = op.id_orden
       LEFT JOIN liquidacion_detalle ld ON ld.id_orden = op.id_orden AND ld.id_personal = op.id_personal
       WHERE op.id_personal = ?
       ORDER BY op.id_orden DESC`,
      [person]
    )
    const trabajos = rawTrabajos.map(t => ({
      ...t,
      id: packId(t.id_orden, t.id_personal),
    }))

    const [rawLiq] = await conn.query(
      `SELECT
         id_liquidacion AS id,
         id_liquidacion,
         id_personal,
         fecha,
         fecha_pago,
         pagado,
         monto_total
       FROM vw_totales_liquidacion
       WHERE id_personal = ?
       ORDER BY id_liquidacion DESC`,
      [person]
    )

    const liquidaciones = []
    for (const liq of rawLiq) {
      const [details] = await conn.query(
        `SELECT op.id_orden, op.monto_acordado
         FROM liquidacion_detalle ld
         JOIN orden_personal op ON op.id_orden = ld.id_orden AND op.id_personal = ld.id_personal
         WHERE ld.id_liquidacion = ?`,
        [liq.id_liquidacion]
      )
      liquidaciones.push({
        ...liq,
        pagado: Boolean(liq.pagado),
        monto_total: Number(liq.monto_total || 0),
        trabajos: details,
      })
    }

    return { trabajos, liquidaciones }
  })
)

router.post(
  '/',
  run(async (conn, req) => {
    const person = number(req.body.id_personal, 'Trabajador', { positive: true, integer: true })
    const fecha = date(req.body.fecha)
    const ids = req.body.asignaciones
    if (!Array.isArray(ids) || !ids.length || ids.length > 200) fail('Selecciona de 1 a 200 trabajos.')

    const [[worker]] = await conn.query('SELECT id_personal FROM personal WHERE id_personal = ? FOR UPDATE', [person])
    if (!worker) fail('Trabajador no encontrado.', 404)

    let total = 0
    const pairs = []
    const seen = new Set()

    for (const item of ids) {
      const [id_orden, id_personal] = unpackId(item, 'Trabajo')
      const key = `${id_orden}-${id_personal}`
      if (seen.has(key)) fail('Hay trabajos repetidos.')
      seen.add(key)

      const [[assignment]] = await conn.query(
        `SELECT op.*, o.estado
         FROM orden_personal op
         JOIN orden o ON o.id_orden = op.id_orden
         WHERE op.id_orden = ? AND op.id_personal = ? FOR UPDATE`,
        [id_orden, id_personal]
      )
      if (!assignment || Number(assignment.id_personal) !== person) {
        fail('El trabajo no pertenece al trabajador.', 409)
      }
      if (!['listo', 'entregado'].includes(assignment.estado)) {
        fail('Solo se liquidan trabajos de órdenes listas o entregadas.', 409)
      }
      const [existing] = await conn.query(
        'SELECT id_liquidacion FROM liquidacion_detalle WHERE id_orden = ? AND id_personal = ?',
        [id_orden, id_personal]
      )
      if (existing.length) fail('Uno de los trabajos ya pertenece a una liquidación.', 409)

      total += cents(assignment.monto_acordado)
      pairs.push([id_orden, id_personal])
    }

    if (!total) fail('Los trabajos deben tener un monto acordado mayor que cero.')

    const [result] = await conn.query(
      'INSERT INTO liquidacion (id_personal, fecha, fecha_pago) VALUES (?, ?, NULL)',
      [person, fecha]
    )
    const idLiq = result.insertId

    for (const [id_orden, id_personal] of pairs) {
      await conn.query(
        'INSERT INTO liquidacion_detalle (id_orden, id_personal, id_liquidacion) VALUES (?, ?, ?)',
        [id_orden, id_personal, idLiq]
      )
    }

    await audit(conn, req, idLiq, `Liquidación preparada por C$ ${total / 100}`)
    return { id: idLiq, monto_total: total / 100 }
  })
)

router.patch(
  '/:id/pagar',
  run(async (conn, req) => {
    const id = number(req.params.id, 'Liquidación', { positive: true, integer: true })
    const fecha = date(req.body.fecha_pago)
    if (
      typeof req.body.referencia !== 'string' ||
      req.body.referencia.trim().length < 3 ||
      req.body.referencia.length > 500
    ) {
      fail('Indica el comprobante o referencia del pago.')
    }

    const [[row]] = await conn.query('SELECT * FROM vw_totales_liquidacion WHERE id_liquidacion = ?', [id])
    if (!row) fail('Liquidación no encontrada.', 404)
    if (row.pagado) return { message: 'Esta liquidación ya está pagada.' }

    await conn.query(
      'UPDATE liquidacion SET fecha_pago = GREATEST(?, fecha) WHERE id_liquidacion = ?',
      [fecha, id]
    )
    await audit(conn, req, id, `Pagada C$ ${row.monto_total} el ${fecha}; comprobante: ${req.body.referencia.trim()}`)
    return { message: 'Pago al trabajador registrado.' }
  })
)

module.exports = router