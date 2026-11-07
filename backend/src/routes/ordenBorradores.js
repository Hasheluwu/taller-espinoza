// backend/src/routes/ordenBorradores.js
const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail } = require('../services/validation')
const { resolveMatricula, aseguradoraToSlug } = require('../services/catalogs')

const router = express.Router()
router.use(auth)
router.use((req, res, next) =>
  ['administrador', 'secretaria'].includes(req.usuario.rol)
    ? next()
    : res.status(403).json({ message: 'No tienes permiso para gestionar borradores de órdenes.' })
)

const drafts = new Map()
const kind = value => {
  if (!['seguro', 'particular'].includes(value)) fail('Tipo de borrador inválido.')
  return value
}
const run = action => async (req, res, next) => {
  try {
    res.json(await action(req))
  } catch (err) {
    next(err)
  }
}

router.get(
  '/',
  run(async req => {
    const t = kind(req.query.tipo)
    const results = []
    for (const [, draft] of drafts.entries()) {
      if (draft.tipo !== t) continue
      const [rows] = await pool.query(
        `SELECT v.matricula, ma.nombre AS marca, mo.nombre AS modelo, va.id_aseguradora, c.nombre AS cliente, c.numero_documento AS cedula
         FROM vehiculo v
         JOIN modelo mo ON mo.id_modelo = v.id_modelo
         JOIN marca ma ON ma.id_marca = mo.id_marca
         JOIN cliente c ON c.id_cliente = v.id_cliente
         LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
         WHERE v.matricula = ?`,
        [draft.matricula]
      )
      if (rows.length > 0) {
        const v = rows[0]
        results.push({
          ...draft,
          id_vehiculo: v.matricula,
          matricula: v.matricula,
          marca: v.marca,
          modelo: v.modelo,
          aseguradora: aseguradoraToSlug(v.id_aseguradora),
          cliente: v.cliente,
          cedula: v.cedula,
        })
      }
    }
    return results
  })
)

router.put(
  '/',
  run(async req => {
    const { tipo, id_vehiculo, paso, datos } = req.body || {}
    if (!['vehiculo', 'presupuesto', 'orden'].includes(paso)) fail('Paso del borrador inválido.')
    const matricula = await resolveMatricula(pool, id_vehiculo)
    if (!matricula) fail('Vehículo no encontrado.', 404)
    const t = kind(tipo)
    const key = `${t}:${matricula}`
    drafts.set(key, {
      id: drafts.size + 1,
      tipo: t,
      matricula,
      paso,
      datos: datos ?? {},
      actualizado: new Date().toISOString(),
    })
    return { message: 'Borrador guardado.' }
  })
)

router.delete(
  '/',
  run(async req => {
    const t = kind(req.query.tipo)
    const matricula = await resolveMatricula(pool, req.query.id_vehiculo)
    if (matricula) drafts.delete(`${t}:${matricula}`)
    return { message: 'Borrador eliminado.' }
  })
)

module.exports = router