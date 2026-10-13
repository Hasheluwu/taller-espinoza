CREATE TABLE IF NOT EXISTS sesion_usuario (
  id CHAR(36) PRIMARY KEY,
  id_usuario INT NOT NULL,
  vence DATETIME NOT NULL,
  INDEX idx_sesion_usuario (id_usuario),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id) ON DELETE CASCADE
);
