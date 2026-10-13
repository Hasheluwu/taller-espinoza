const fs = require('node:fs/promises')
const path = require('node:path')
module.exports = async function migrate(pool) {
  // Additive, repeatable migration. Existing business records are never removed.
  const sql = await fs.readFile(path.join(__dirname, '../../migrations/001_sessions.sql'), 'utf8')
  await pool.query(sql.replace(/^\uFEFF/, ''))
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS cita (id INT AUTO_INCREMENT PRIMARY KEY, id_vehiculo INT NOT NULL, inicio DATETIME NOT NULL, fin DATETIME NOT NULL, motivo VARCHAR(500) NOT NULL, estado ENUM('programada','completada','cancelada') NOT NULL DEFAULT 'programada', creado_por INT NOT NULL, FOREIGN KEY(id_vehiculo) REFERENCES vehiculo(id), FOREIGN KEY(creado_por) REFERENCES usuario(id), INDEX(inicio))`,
    `CREATE TABLE IF NOT EXISTS foto_orden (id INT AUTO_INCREMENT PRIMARY KEY, id_orden INT NOT NULL, etapa ENUM('recepcion','entrega') NOT NULL, descripcion VARCHAR(500), mime VARCHAR(30) NOT NULL, contenido MEDIUMBLOB NOT NULL, creado_por INT NOT NULL, fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(id_orden) REFERENCES orden(id), FOREIGN KEY(creado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS costo_orden (id_orden INT PRIMARY KEY, materiales DECIMAL(10,2) NOT NULL, repuestos DECIMAL(10,2) NOT NULL, otros DECIMAL(10,2) NOT NULL, nota VARCHAR(500) NOT NULL, actualizado_por INT NOT NULL, FOREIGN KEY(id_orden) REFERENCES orden(id), FOREIGN KEY(actualizado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS consumo_responsable (id_material_orden INT PRIMARY KEY, id_personal INT NOT NULL, nota VARCHAR(500), FOREIGN KEY(id_material_orden) REFERENCES orden_material(id) ON DELETE CASCADE, FOREIGN KEY(id_personal) REFERENCES personal(id))`,
  ]) await pool.query(statement)
}
