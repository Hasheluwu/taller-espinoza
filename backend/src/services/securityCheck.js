// Startup warnings for risky configuration. They never stop the server.
const bcrypt = require('bcrypt')
const DEFAULT_PASSWORDS = ['admin1234']
module.exports = async function securityCheck(pool) {
  const warnings = []
  if ((process.env.JWT_SECRET || '').length < 32) warnings.push('JWT_SECRET es corto. Usa una clave aleatoria de al menos 32 caracteres en backend/.env.')
  if ((process.env.DB_USER || '').toLowerCase() === 'root') warnings.push('La base de datos usa el usuario root de MySQL. Crea un usuario solo para el taller (ver README, sección Seguridad).')
  const [users] = await pool.query('SELECT email, password_hash FROM usuario WHERE activo = 1')
  for (const user of users) {
    for (const weak of DEFAULT_PASSWORDS) if (await bcrypt.compare(weak, user.password_hash)) warnings.push(`${user.email} usa la contraseña de fábrica. Cámbiala con: npm run cambiar-password`)
  }
  for (const warning of warnings) console.warn(`[SEGURIDAD] ${warning}`)
}
