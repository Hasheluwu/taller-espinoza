// Unfinished order registrations. The client and vehicle already exist; this keeps
// the remaining form so the user can resume it later. One draft per vehicle and kind.
const express = require('express')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const { fail, number } = require('../services/validation')
const router = express.Router()
router.use(auth)
router.use((req, res, next) => ['administrador', 'secretaria'].includes(req.usuario.rol) ? next() : res.status(403).json({ message: 'No tienes permiso para gestionar borradores de órdenes.' }))
const kind = value => { if (!['seguro', 'particular'].includes(value)) fail('Tipo de borrador inválido.'); return value }
const run = action => async (req, res, next) => { try { res.json(await action(req)) } catch (err) { next(err) } }

router.get('/', run(async req => {
  const [rows] = await pool.query(`SELECT b.id,b.tipo,b.paso,b.datos,b.actualizado,b.id_vehiculo,v.matricula,v.marca,v.modelo,v.aseguradora,c.nombre AS cliente,c.cedula
    FROM orden_borrador b JOIN vehiculo v ON v.id=b.id_vehiculo JOIN cliente c ON c.id=v.id_cliente
    WHERE b.tipo=? AND NOT EXISTS (SELECT 1 FROM orden o WHERE o.id_vehiculo=b.id_vehiculo AND o.fecha_creacion>=b.actualizado)
    ORDER BY b.actualizado DESC LIMIT 100`, [kind(req.query.tipo)])
  return rows.map(row => ({ ...row, datos: typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos }))
}))
router.put('/', run(async req => {
  const { tipo, id_vehiculo, paso, datos } = req.body || {}
  const vehicle = number(id_vehiculo, 'Vehículo', { positive: true, integer: true })
  if (!['vehiculo', 'presupuesto', 'orden'].includes(paso)) fail('Paso del borrador inválido.')
  const json = JSON.stringify(datos ?? {})
  if (json.length > 200000) fail('El borrador es demasiado grande.')
  const [[exists]] = await pool.query('SELECT id FROM vehiculo WHERE id=?', [vehicle])
  if (!exists) fail('Vehículo no encontrado.', 404)
  await pool.query(`INSERT INTO orden_borrador (tipo,id_vehiculo,paso,datos,creado_por) VALUES (?,?,?,?,?)
    ON DUPLICATE KEY UPDATE paso=VALUES(paso),datos=VALUES(datos),creado_por=VALUES(creado_por),actualizado=CURRENT_TIMESTAMP`, [kind(tipo), vehicle, paso, json, req.usuario.id])
  return { message: 'Borrador guardado.' }
}))
router.delete('/', run(async req => {
  await pool.query('DELETE FROM orden_borrador WHERE tipo=? AND id_vehiculo=?', [kind(req.query.tipo), number(req.query.id_vehiculo, 'Vehículo', { positive: true, integer: true })])
  return { message: 'Borrador eliminado.' }
}))
module.exports = router
