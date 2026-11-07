function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error }
function number(value, name, { positive = false, integer = false } = {}) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') fail(`${name}: ingresa un número válido.`)
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || (positive && n === 0) || (integer && !Number.isSafeInteger(n))) fail(`${name}: valor inválido.`)
  return n
}
function cents(value, name = 'Monto', positive = false) {
  const n = number(value, name, { positive })
  const rounded = Math.round(n * 100)
  if (!Number.isSafeInteger(rounded) || Math.abs(n * 100 - rounded) > 0.000001) fail(`${name}: usa como máximo dos decimales.`)
  return rounded
}
function money(value, name, positive = false) { return cents(value, name, positive) / 100 }
async function lockOrder(conn, id, editable = false) {
  number(id, 'Orden', { positive: true, integer: true })
  const [rows] = await conn.query('SELECT * FROM orden WHERE id = ? FOR UPDATE', [id])
  if (!rows.length) fail('Orden no encontrada.', 404)
  if (editable && rows[0].factura_emitida) fail('La orden tiene una factura emitida y sus cargos ya están cerrados.', 409)
  if (editable && !['recibido', 'en_proceso'].includes(rows[0].estado)) fail('Esta orden está cerrada para cambios en sus operaciones.', 409)
  return rows[0]
}
// Optional payment date: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm[:ss]". Empty means "now".
// Received money cannot be dated in the future (Nicaragua time) or before 2000.
function paymentDate(value, name = 'Fecha', { future = false } = {}) {
  if (value === undefined || value === null || value === '') return null
  const match = typeof value === 'string' && value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) fail(`${name}: ingresa una fecha válida.`)
  const [, day, hh = '00', mm = '00', ss = '00'] = match
  const parsed = new Date(`${day}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day || +hh > 23 || +mm > 59 || +ss > 59) fail(`${name}: ingresa una fecha válida.`)
  if (day < '2000-01-01') fail(`${name}: la fecha es demasiado antigua.`)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Managua' })
  if (!future && day > today) fail(`${name}: no puede ser una fecha futura.`)
  return match[2] ? `${day} ${hh}:${mm}:${ss}` : day
}
module.exports = { fail, number, cents, money, lockOrder, paymentDate }
