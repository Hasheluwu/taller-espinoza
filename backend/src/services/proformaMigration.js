// Additive extension of the existing presupuesto tables. Never resets business data.
module.exports = async function migrateProformas(pool) {
  const [[column]] = await pool.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orden' AND COLUMN_NAME='cargos_desde_proforma'")
  if (!Number(column.n)) {
    try { await pool.query('ALTER TABLE orden ADD COLUMN cargos_desde_proforma BOOLEAN NOT NULL DEFAULT FALSE') }
    catch (err) { if (err.code !== 'ER_DUP_FIELDNAME') throw err }
  }
  const statements = [
    `CREATE TABLE IF NOT EXISTS proforma_secuencia (id INT PRIMARY KEY, siguiente INT NOT NULL)`,
    `INSERT IGNORE INTO proforma_secuencia VALUES (1, 17293)`,
    `CREATE TABLE IF NOT EXISTS proforma_documento (
      id_presupuesto INT PRIMARY KEY, numero INT UNIQUE, version INT NOT NULL DEFAULT 1,
      fase VARCHAR(20) NOT NULL DEFAULT 'borrador', seguro VARCHAR(100) NOT NULL DEFAULT 'PARTICULAR',
      tramite VARCHAR(50) NOT NULL DEFAULT '', reclamo VARCHAR(50) NOT NULL DEFAULT '',
      mano_obra_global DECIMAL(10,2) DEFAULT NULL, datos JSON NOT NULL,
      solicitud VARCHAR(64) UNIQUE, creado_por INT NOT NULL,
      actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(id_presupuesto) REFERENCES presupuesto(id), FOREIGN KEY(creado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS proforma_version (
      id INT AUTO_INCREMENT PRIMARY KEY, id_presupuesto INT NOT NULL, version INT NOT NULL,
      documento JSON NOT NULL, emitida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, creado_por INT NOT NULL,
      UNIQUE(id_presupuesto,version), FOREIGN KEY(id_presupuesto) REFERENCES presupuesto(id),
      FOREIGN KEY(creado_por) REFERENCES usuario(id))`,
    `CREATE TABLE IF NOT EXISTS proforma_conversion (
      id_presupuesto INT PRIMARY KEY, id_orden INT NOT NULL UNIQUE, version INT NOT NULL,
      FOREIGN KEY(id_presupuesto) REFERENCES presupuesto(id), FOREIGN KEY(id_orden) REFERENCES orden(id))`,
    `CREATE TABLE IF NOT EXISTS proforma_reserva (
      numero INT PRIMARY KEY, seguro VARCHAR(100) NOT NULL, fecha DATE NOT NULL,
      solicitud VARCHAR(64) NOT NULL UNIQUE, creado_por INT NOT NULL,
      FOREIGN KEY(creado_por) REFERENCES usuario(id))`,
  ]
  for (const sql of statements) await pool.query(sql)
}
