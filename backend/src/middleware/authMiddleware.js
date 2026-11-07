// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken')
const pool = require('../db')
const { rolToSlug } = require('../services/catalogs')

// Registro en memoria de sesiones cerradas explícitamente (logout)
const revokedSessions = new Set()

async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Inicia sesión para continuar.' })
  }

  let decoded
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (!decoded.exp) throw new Error('Sesión sin vencimiento')
    if (decoded.jti && revokedSessions.has(decoded.jti)) {
      throw new Error('Sesión cerrada')
    }
  } catch {
    return res.status(401).json({ message: 'Tu sesión venció. Inicia sesión nuevamente.' })
  }

  try {
    const userId = decoded.id_usuario || decoded.id
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.id_rol, r.nombre AS rol_nombre
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.activo = 1
       LIMIT 1`,
      [userId]
    )
    if (!rows.length) {
      return res.status(401).json({ message: 'Usuario inactivo o inexistente.' })
    }

    const u = rows[0]
    req.usuario = {
      id: u.id_usuario,
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      email: u.email,
      id_rol: u.id_rol,
      rol_nombre: u.rol_nombre,
      rol: rolToSlug(u.id_rol, u.rol_nombre),
    }
    req.sessionId = decoded.jti || null
    next()
  } catch (err) {
    next(err)
  }
}

requireAuth.admin = (req, res, next) =>
  req.usuario?.rol === 'administrador'
    ? next()
    : res.status(403).json({ message: 'Esta acción requiere un administrador.' })

requireAuth.revokeSession = (sessionId) => {
  if (sessionId) revokedSessions.add(sessionId)
}

module.exports = requireAuth