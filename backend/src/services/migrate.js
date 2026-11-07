// backend/src/services/migrate.js
// Verificación limpia de conexión al esquema normalizado v7/v8 (53 tablas).
// No altera tablas ni crea estructuras fuera del DDL oficial.

module.exports = async function migrate(pool) {
  await pool.query('SELECT 1 FROM usuario LIMIT 1')
}