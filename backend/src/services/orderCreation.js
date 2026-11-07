// backend/src/services/orderCreation.js
const { createHash } = require('node:crypto')
const { fail } = require('./validation')
const { date } = require('./workshop')

const claims = new Map()

function validateDates(body) {
  const ingreso = body.fecha_ingreso
  if (typeof ingreso !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(ingreso)) {
    fail('Fecha de ingreso inválida.')
  }
  const day = date(ingreso.slice(0, 10), 'Fecha de ingreso')
  const time = ingreso.slice(11).split(':').map(Number)
  if (time[0] > 23 || time[1] > 59 || (time[2] || 0) > 59) fail('Hora de ingreso inválida.')
  for (const [key, label] of [
    ['fecha_entrega_estimada', 'La entrega'],
    ['fecha_vencimiento_garantia', 'El vencimiento de garantía'],
  ]) {
    if (body[key] && date(body[key], label) < day) {
      fail(`${label} no puede ser anterior al ingreso del vehículo.`)
    }
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])])
    )
  }
  return value
}

function requestKey(value) {
  if (!value) return 'auto-' + Date.now()
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{4,64}$/.test(value)) {
    fail('Falta el identificador de guardado. Recarga el formulario antes de registrar la orden.')
  }
  return value
}

async function claim(_conn, user, body) {
  if (!body.solicitud) return null
  const key = `${user}:${requestKey(body.solicitud)}`
  const hash = createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex')
  const existing = claims.get(key)
  if (existing) {
    if (existing.hash !== hash) {
      fail(
        'Esta solicitud ya creó una orden con otros datos. Revisa las órdenes registradas antes de iniciar un nuevo trabajo.',
        409
      )
    }
    return existing.response || null
  }
  claims.set(key, { hash, response: null })
  return null
}

function saveClaimResponse(user, solicitud, response) {
  if (!solicitud) return
  const key = `${user}:${solicitud}`
  const existing = claims.get(key)
  if (existing) existing.response = response
}

module.exports = { validateDates, requestKey, claim, saveClaimResponse }