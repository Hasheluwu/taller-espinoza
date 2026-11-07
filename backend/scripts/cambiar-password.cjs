// Cambia la contraseña de un usuario del sistema. Uso: npm run cambiar-password
// La contraseña se escribe sin mostrarse y nunca queda guardada en archivos ni en el historial.
const path = require('node:path')
const readline = require('node:readline')
const bcrypt = require('bcrypt')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true })

// One reader for every question; typed characters are hidden while a password is asked.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY })
const lines = []
const waiting = []
let muted = false
rl._writeToOutput = text => { if (!muted) process.stdout.write(text) }
rl.on('line', line => { const next = waiting.shift(); if (next) next(line); else lines.push(line) })
rl.on('close', () => { for (const next of waiting.splice(0)) next('') })
function ask(question, hidden = false) {
  process.stdout.write(question)
  muted = hidden
  return new Promise(resolve => {
    const done = answer => { muted = false; if (hidden) process.stdout.write('\n'); resolve(answer) }
    if (lines.length) done(lines.shift()); else waiting.push(done)
  })
}
const WEAK = ['admin1234', 'password', 'contraseña', '1234567890', 'taller1234', 'espinoza123']

async function main() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
  try {
    const [users] = await conn.query('SELECT id, nombre, email, rol FROM usuario WHERE activo = 1 ORDER BY id')
    console.log('\nUsuarios activos:')
    for (const u of users) console.log(`  - ${u.email} (${u.rol})`)
    const email = (await ask('\nCorreo del usuario [admin@tallerespinoza.com]: ')).trim().toLowerCase() || 'admin@tallerespinoza.com'
    const user = users.find(u => u.email.toLowerCase() === email)
    if (!user) throw Error('No existe un usuario activo con ese correo.')
    const password = await ask('Nueva contraseña (no se mostrará): ', true)
    if (password.length < 10) throw Error('Usa al menos 10 caracteres.')
    if (password.length > 72) throw Error('Usa como máximo 72 caracteres.')
    if (WEAK.includes(password.toLowerCase()) || password.toLowerCase().includes(email.split('@')[0])) throw Error('Esa contraseña es demasiado fácil de adivinar. Elige otra.')
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) throw Error('Combina letras y números.')
    if (await ask('Repite la contraseña: ', true) !== password) throw Error('Las contraseñas no coinciden.')
    await conn.beginTransaction()
    await conn.query('UPDATE usuario SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 12), user.id])
    const [closed] = await conn.query('DELETE FROM sesion_usuario WHERE id_usuario = ?', [user.id])
    await conn.query("INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle) VALUES (?, 'usuario', ?, 'editar', 'Contraseña cambiada desde la consola')", [user.id, user.id])
    await conn.commit()
    console.log(`\nListo: contraseña de ${user.email} actualizada. Se cerraron ${closed.affectedRows} sesiones abiertas; vuelve a iniciar sesión.`)
  } catch (error) {
    try { await conn.rollback() } catch { /* nothing to undo */ }
    throw error
  } finally { await conn.end(); rl.close() }
}
main().catch(error => { console.error(`\nNo se cambió la contraseña: ${error.message}`); process.exitCode = 1 })
