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
  if (editable && !['recibido', 'en_proceso'].includes(rows[0].estado)) fail('Esta orden está cerrada para cambios en sus operaciones.', 409)
  return rows[0]
}
module.exports = { fail, number, cents, money, lockOrder }
