const fs = require('node:fs/promises')
const path = require('node:path')
module.exports = async function migrate(pool) {
  // Additive, repeatable migration. Existing business records are never removed.
  const sql = await fs.readFile(path.join(__dirname, '../../migrations/001_sessions.sql'), 'utf8')
  await pool.query(sql.replace(/^\uFEFF/, ''))
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS login_intento (clave CHAR(64) PRIMARY KEY, intentos INT NOT NULL, vence DATETIME NOT NULL, INDEX(vence))`,
    `CREATE TABLE IF NOT EXISTS orden_solicitud (id_usuario INT NOT NULL, solicitud VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, huella CHAR(64) NOT NULL, respuesta JSON NULL, PRIMARY KEY(id_usuario,solicitud), FOREIGN KEY(id_usuario) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS orden_particular_documento (id_orden INT PRIMARY KEY, detalle JSON NOT NULL, observaciones TEXT NOT NULL, FOREIGN KEY(id_orden) REFERENCES orden(id))`,
    `CREATE TABLE IF NOT EXISTS cita (id INT AUTO_INCREMENT PRIMARY KEY, id_vehiculo INT NOT NULL, inicio DATETIME NOT NULL, fin DATETIME NOT NULL, motivo VARCHAR(500) NOT NULL, estado ENUM('programada','completada','cancelada') NOT NULL DEFAULT 'programada', creado_por INT NOT NULL, FOREIGN KEY(id_vehiculo) REFERENCES vehiculo(id), FOREIGN KEY(creado_por) REFERENCES usuario(id), INDEX(inicio))`,
    `CREATE TABLE IF NOT EXISTS foto_orden (id INT AUTO_INCREMENT PRIMARY KEY, id_orden INT NOT NULL, etapa ENUM('recepcion','entrega') NOT NULL, descripcion VARCHAR(500), mime VARCHAR(30) NOT NULL, contenido MEDIUMBLOB NOT NULL, creado_por INT NOT NULL, fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(id_orden) REFERENCES orden(id), FOREIGN KEY(creado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS costo_orden (id_orden INT PRIMARY KEY, materiales DECIMAL(10,2) NOT NULL, repuestos DECIMAL(10,2) NOT NULL, otros DECIMAL(10,2) NOT NULL, nota VARCHAR(500) NOT NULL, actualizado_por INT NOT NULL, FOREIGN KEY(id_orden) REFERENCES orden(id), FOREIGN KEY(actualizado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS orden_borrador (id INT AUTO_INCREMENT PRIMARY KEY, tipo ENUM('seguro','particular') NOT NULL, id_vehiculo INT NOT NULL, paso VARCHAR(20) NOT NULL, datos JSON NOT NULL, creado_por INT NOT NULL, actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY(tipo,id_vehiculo), FOREIGN KEY(id_vehiculo) REFERENCES vehiculo(id), FOREIGN KEY(creado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS consumo_responsable (id_material_orden INT PRIMARY KEY, id_personal INT NOT NULL, nota VARCHAR(500), FOREIGN KEY(id_material_orden) REFERENCES orden_material(id) ON DELETE CASCADE, FOREIGN KEY(id_personal) REFERENCES personal(id))`,
  ]) await pool.query(statement)
  const [[paymentMode]] = await pool.query("SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orden' AND COLUMN_NAME='pagador_unico'")
  if (!Number(paymentMode.n)) {
    try { await pool.query('ALTER TABLE orden ADD COLUMN pagador_unico BOOLEAN NOT NULL DEFAULT FALSE') }
    catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error }
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS factura_seguro (
    id INT AUTO_INCREMENT PRIMARY KEY, id_orden INT NOT NULL UNIQUE,
    aseguradora VARCHAR(30) NOT NULL, documento JSON NOT NULL,
    total DECIMAL(12,2) NOT NULL, saldo_inicial DECIMAL(12,2) NOT NULL,
    monto_recibido DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado ENUM('pendiente','pagada') NOT NULL DEFAULT 'pendiente',
    fecha_emision DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, fecha_pago DATE NULL,
    referencia VARCHAR(100), creado_por INT NOT NULL, pagado_por INT NULL,
    FOREIGN KEY(id_orden) REFERENCES orden(id), FOREIGN KEY(creado_por) REFERENCES usuario(id),
    FOREIGN KEY(pagado_por) REFERENCES usuario(id))`)
  for (const statement of [
    'ALTER TABLE orden ADD COLUMN factura_emitida BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE personal ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE',
    "ALTER TABLE orden_servicio ADD COLUMN tipo_linea ENUM('servicio','material','repuesto') NOT NULL DEFAULT 'servicio'"
  ]) { try { await pool.query(statement) } catch(error) { if(error.code !== 'ER_DUP_FIELDNAME') throw error } }
  await require('./proformaMigration')(pool)
  const [[vehicleColumn]] = await pool.query("SELECT IS_NULLABLE nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='presupuesto' AND COLUMN_NAME='id_vehiculo'")
  if (vehicleColumn.nullable === 'NO') await pool.query('ALTER TABLE presupuesto MODIFY id_vehiculo INT NULL')
  try { await pool.query('ALTER TABLE proforma_documento ADD COLUMN es_cotizacion BOOLEAN NOT NULL DEFAULT FALSE') }
  catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error }
}
