const { fail, cents } = require('./validation')
function date(value, label = 'Fecha') {
  const parsed = new Date(value + 'T12:00:00Z')
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${label} inválida.`)
  return value
}
function photo(data) {
  const match = typeof data === 'string' && data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) fail('Selecciona una imagen JPEG, PNG o WebP.')
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) fail('La foto debe pesar como máximo 3 MB.')
  const valid = match[1] === 'jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) : match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
  if (!valid) fail('El archivo no coincide con el formato de imagen declarado.')
  return { bytes, mime: `image/${match[1]}` }
}
function profit(order, costs, labor) {
  const revenue = cents(order.subtotal || 0)
  const total = costs ? cents(costs.materiales) + cents(costs.repuestos) + cents(costs.otros) + cents(labor) : null
  return { ingreso_sin_iva: revenue / 100, mano_obra: Number(labor), costos: costs, costo_total: total == null ? null : total / 100, ganancia: total == null ? null : (revenue - total) / 100 }
}
module.exports = { date, photo, profit }
