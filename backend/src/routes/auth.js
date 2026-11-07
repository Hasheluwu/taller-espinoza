// backend/src/routes/auth.js
const { randomUUID } = require('node:crypto')
const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const requireAuth = require('../middleware/authMiddleware')
const { rolToSlug } = require('../services/catalogs')
const reserveAttempt = require('../services/loginAttempts')(pool)

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email: rawEmail, password } = req.body || {}
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password ||
    email.length > 254 ||
    password.length > 1024
  ) {
    return res.status(400).json({ message: 'Correo y contraseña son requeridos.' })
  }

  try {
    const clearAttempts = await reserveAttempt(email, req.ip || req.socket?.remoteAddress || 'unknown')

    const [rows] = await pool.query(
      `SELECT u.*, r.nombre AS rol_nombre
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
       WHERE u.email = ? AND u.activo = 1
       LIMIT 1`,
      [email]
    )

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' })
    }

    const u = rows[0]
    const match = await bcrypt.compare(password, u.password_hash)
    if (!match) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' })
    }

    const rolSlug = rolToSlug(u.id_rol, u.rol_nombre)
    const sessionId = randomUUID()
    const token = jwt.sign(
      {
        id: u.id_usuario,
        id_usuario: u.id_usuario,
        nombre: u.nombre,
        email: u.email,
        rol: rolSlug,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h', algorithm: 'HS256', jwtid: sessionId }
    )

    await clearAttempts()
    res.json({
      token,
      usuario: {
        id: u.id_usuario,
        id_usuario: u.id_usuario,
        nombre: u.nombre,
        email: u.email,
        rol: rolSlug,
        rol_nombre: u.rol_nombre,
      },
    })
  } catch (err) {
    if (err.status === 429) {
      return res
        .set('Retry-After', String(err.retryAfter))
        .status(429)
        .json({ message: err.message, retry_after: err.retryAfter })
    }
    console.error('Error en login:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  requireAuth.revokeSession(req.sessionId)
  res.json({ message: 'Sesión cerrada.' })
})

module.exports = router