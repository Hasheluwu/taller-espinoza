const jwt = require('jsonwebtoken')
const pool = require('../db')
async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Inicia sesión para continuar.' })
  let decoded
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (!decoded.exp || !decoded.jti) throw new Error('Sesión antigua sin vencimiento')
  } catch {
    return res.status(401).json({ message: 'Tu sesión venció. Inicia sesión nuevamente.' })
  }
  try {
    const [rows] = await pool.query('SELECT u.id, u.nombre, u.email, u.rol FROM usuario u JOIN sesion_usuario s ON s.id_usuario = u.id WHERE u.id = ? AND u.activo = 1 AND s.id = ? AND s.vence > UTC_TIMESTAMP()', [decoded.id, decoded.jti])
    if (!rows.length) return res.status(401).json({ message: 'Usuario inactivo o inexistente.' })
    req.usuario = rows[0]
    req.sessionId = decoded.jti
    next()
  } catch (err) { next(err) }
}
requireAuth.admin = (req, res, next) => req.usuario?.rol === 'administrador'
  ? next() : res.status(403).json({ message: 'Esta acción requiere un administrador.' })
module.exports = requireAuth

