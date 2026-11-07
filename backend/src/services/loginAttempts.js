const { createHash } = require('node:crypto')
const key = value => createHash('sha256').update(value).digest('hex')
module.exports = function loginAttempts(pool) {
  return async function reserve(email, ip) {
    const account = key(`account:${ip}:${email}`)
    const scopes = [[key(`ip:${ip}`), 30], [account, 5]].sort(([a], [b]) => a.localeCompare(b))
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      for (const [scope, limit] of scopes) {
        await conn.query('INSERT INTO login_intento (clave,intentos,vence) VALUES (?,0,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE clave=clave', [scope])
        const [[row]] = await conn.query('SELECT intentos,GREATEST(0,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),vence)) AS segundos FROM login_intento WHERE clave=? FOR UPDATE', [scope])
        if (row.segundos <= 0) await conn.query('UPDATE login_intento SET intentos=1,vence=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE) WHERE clave=?', [scope])
        else {
          if (row.intentos >= limit) {
            const error = new Error(`Demasiados intentos. Espera ${Math.ceil(row.segundos / 60)} minutos antes de volver a ingresar.`)
            error.status = 429; error.retryAfter = Math.max(1, row.segundos); throw error
          }
          await conn.query('UPDATE login_intento SET intentos=intentos+1 WHERE clave=?', [scope])
        }
      }
      await conn.commit()
      return async () => { await pool.query('DELETE FROM login_intento WHERE clave=?', [account]) }
    } catch (error) { await conn.rollback(); throw error }
    finally { conn.release() }
  }
}
