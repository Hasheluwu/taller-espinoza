// backend/src/services/loginAttempts.js
const buckets = new Map()
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

function checkAndIncrement(key, maxAttempts) {
  const now = Date.now()
  const record = buckets.get(key)
  if (!record || record.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS })
    return
  }
  if (record.count >= maxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((record.expiresAt - now) / 1000))
    const err = new Error('Demasiados intentos de inicio de sesión. Espera unos minutos antes de volver a intentarlo.')
    err.status = 429
    err.retryAfter = retryAfter
    throw err
  }
  record.count += 1
}

module.exports = function createLoginAttempts() {
  return async function reserveAttempt(email, ip) {
    const cleanEmail = String(email || '').trim().toLowerCase()
    const cleanIp = String(ip || 'unknown').trim()
    const accountKey = `acc:${cleanEmail}:${cleanIp}`
    const ipKey = `ip:${cleanIp}`

    checkAndIncrement(ipKey, 30)
    checkAndIncrement(accountKey, 5)

    return async function clearAttempts() {
      buckets.delete(accountKey)
    }
  }
}