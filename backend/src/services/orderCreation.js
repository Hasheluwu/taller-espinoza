const { createHash } = require('node:crypto')
const { fail } = require('./validation')
const { date } = require('./workshop')

function validateDates(body) {
  const ingreso = body.fecha_ingreso
  if (typeof ingreso !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(ingreso)) fail('Fecha de ingreso inválida.')
  const day = date(ingreso.slice(0, 10), 'Fecha de ingreso')
  const time = ingreso.slice(11).split(':').map(Number)
  if (time[0] > 23 || time[1] > 59 || (time[2] || 0) > 59) fail('Hora de ingreso inválida.')
  for (const [key, label] of [['fecha_entrega_estimada', 'La entrega'], ['fecha_vencimiento_garantia', 'El vencimiento de garantía']]) {
    if (body[key] && date(body[key], label) < day) fail(`${label} no puede ser anterior al ingreso del vehículo.`)
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
function requestKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(value)) fail('Falta el identificador de guardado. Recarga el formulario antes de registrar la orden.')
  return value
}
async function claim(conn, user, body) {
  const key = requestKey(body.solicitud)
  const hash = createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex')
  await conn.query('INSERT INTO orden_solicitud (id_usuario, solicitud, huella) VALUES (?,?,?) ON DUPLICATE KEY UPDATE solicitud=solicitud', [user, key, hash])
  const [[row]] = await conn.query('SELECT huella,respuesta FROM orden_solicitud WHERE id_usuario=? AND solicitud=? FOR UPDATE', [user, key])
  if (row.huella !== hash) fail('Esta solicitud ya creó una orden con otros datos. Revisa las órdenes registradas antes de iniciar un nuevo trabajo.', 409)
  return typeof row.respuesta === 'string' ? JSON.parse(row.respuesta) : row.respuesta
}
module.exports = { validateDates, requestKey, claim }
