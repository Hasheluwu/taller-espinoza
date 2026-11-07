const { randomUUID } = require('node:crypto')
const requireAuth = require('../middleware/authMiddleware')
// backend/src/routes/auth.js
const express = require('express')
const bcrypt  = require('bcrypt')
const jwt     = require('jsonwebtoken')
const pool    = require('../db')

const reserveAttempt = require('../services/loginAttempts')(pool)
const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email: rawEmail, password } = req.body || {}
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 254 || password.length > 1024) {
    return res.status(400).json({ message: 'Correo y contraseña son requeridos.' })
  }

  try {
    const clearAttempts = await reserveAttempt(email, req.ip || req.socket?.remoteAddress || 'unknown')
    // Buscar usuario activo por email
    const [rows] = await pool.query(
      'SELECT * FROM usuario WHERE email = ? AND activo = 1 LIMIT 1',
      [email]
    )

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' })
    }

    const usuario = rows[0]

    // Comparar contraseña con hash guardado
    const match = await bcrypt.compare(password, usuario.password_hash)
    if (!match) {
      return res.status(401).json({ message: 'Credenciales incorrectas.' })
    }

    // Sesión con vencimiento; los tokens antiguos requieren nuevo inicio de sesión.
    const sessionId = randomUUID()
    const token = jwt.sign(
      {
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol,
      },
      process.env.JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256', jwtid: sessionId }
    )

    await pool.query('INSERT INTO sesion_usuario (id, id_usuario, vence) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))', [sessionId, usuario.id])
    await clearAttempts()
    res.json({
      token,
      usuario: {
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol,
      },
    })
  } catch (err) {
    if (err.status === 429) return res.set('Retry-After', String(err.retryAfter)).status(429).json({ message: err.message, retry_after: err.retryAfter })
    console.error('Error en login:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
})

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM sesion_usuario WHERE id = ?', [req.sessionId])
    res.json({ message: 'Sesión cerrada.' })
  } catch (err) { next(err) }
})
module.exports = router

