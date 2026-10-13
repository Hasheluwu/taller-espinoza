-- ============================================================
-- TALLER PEDRO ESPINOZA — Schema v2
-- Ejecutar en MySQL Workbench o desde terminal:
-- mysql -u root -p < taller_espinoza.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS taller_espinoza
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taller_espinoza;

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuario (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('administrador', 'secretaria') NOT NULL DEFAULT 'secretaria',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE cliente (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  nombre               VARCHAR(150) NOT NULL,
  cedula               VARCHAR(20)  NOT NULL UNIQUE,
  telefono             VARCHAR(20)  NOT NULL,
  fecha_nacimiento     DATE,
  municipio_residencia VARCHAR(100) NOT NULL,
  direccion            VARCHAR(255)
);

-- ============================================================
-- VEHÍCULOS
-- ============================================================
CREATE TABLE vehiculo (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente      INT          NOT NULL,
  matricula       VARCHAR(20)  NOT NULL UNIQUE,
  marca           VARCHAR(50)  NOT NULL,
  modelo          VARCHAR(50)  NOT NULL,
  anio_fabricacion YEAR        NOT NULL,
  aseguradora     ENUM('ninguna', 'lafise', 'iniser') NOT NULL DEFAULT 'ninguna',
  color           VARCHAR(50)  NOT NULL,
  chasis          VARCHAR(50),
  motor           VARCHAR(50),
  FOREIGN KEY (id_cliente) REFERENCES cliente(id)
);

-- ============================================================
-- PROVEEDORES
-- ============================================================
CREATE TABLE proveedor (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(150) NOT NULL,
  contacto         VARCHAR(150),
  emite_factura_iva BOOLEAN NOT NULL DEFAULT FALSE,
  fijo             BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- INVENTARIO (materiales consumibles)
-- ============================================================
CREATE TABLE inventario (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_proveedor    INT,
  nombre          VARCHAR(150) NOT NULL,
  precio_unidad   DECIMAL(10,2) NOT NULL,
  cantidad        DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_minimo    DECIMAL(10,2) NOT NULL DEFAULT 0,
  unidad_medida   ENUM('galon', 'litro', 'unidad', 'kilo', 'metro', 'otro') NOT NULL,
  fecha_expiracion DATE,
  FOREIGN KEY (id_proveedor) REFERENCES proveedor(id)
);

-- ============================================================
-- COMPRAS DE INVENTARIO
-- ============================================================
CREATE TABLE compra_inventario (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  id_proveedor     INT,
  fecha            DATE         NOT NULL,
  monto_subtotal   DECIMAL(10,2) NOT NULL,
  monto_iva        DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_total      DECIMAL(10,2) NOT NULL,
  tiene_factura_iva BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (id_proveedor) REFERENCES proveedor(id)
);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================================
CREATE TABLE movimiento_inventario (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_inventario INT  NOT NULL,
  tipo          ENUM('entrada_compra', 'salida_orden', 'ajuste_manual') NOT NULL,
  cantidad      DECIMAL(10,2) NOT NULL,
  fecha         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario    INT  NOT NULL,
  id_compra     INT,
  id_orden      INT,
  nota          TEXT,
  FOREIGN KEY (id_inventario) REFERENCES inventario(id),
  FOREIGN KEY (id_usuario)    REFERENCES usuario(id),
  FOREIGN KEY (id_compra)     REFERENCES compra_inventario(id)
  -- id_orden se agrega como FK después de crear la tabla orden
);

-- ============================================================
-- REPUESTOS DEL TALLER
-- ============================================================
CREATE TABLE repuesto_taller (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nombre            VARCHAR(150) NOT NULL,
  marca             VARCHAR(100) NOT NULL,
  modelo            VARCHAR(100) NOT NULL,
  modelo_compatible VARCHAR(150),
  precio            DECIMAL(10,2) NOT NULL,
  cantidad          INT NOT NULL DEFAULT 0,
  estado            ENUM('nuevo', 'usado_bueno', 'usado_regular', 'para_reparar') NOT NULL,
  origen            ENUM('comprado', 'proveniente_de_cliente') NOT NULL DEFAULT 'comprado',
  fecha_ingreso     DATE NOT NULL DEFAULT (CURRENT_DATE)
);

-- ============================================================
-- PERSONAL
-- ============================================================
CREATE TABLE personal (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nombre   VARCHAR(150) NOT NULL,
  tipo     ENUM('interno', 'externo') NOT NULL,
  rol      ENUM('pintor', 'enderezador', 'mecanico', 'otro') NOT NULL,
  telefono VARCHAR(20),
  fijo     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- PRESUPUESTOS
-- ============================================================
CREATE TABLE presupuesto (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo   INT          NOT NULL,
  fecha         DATE         NOT NULL DEFAULT (CURRENT_DATE),
  estado        ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
  subtotal      DECIMAL(10,2) NOT NULL DEFAULT 0,
  iva           DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  FOREIGN KEY (id_vehiculo) REFERENCES vehiculo(id)
);

CREATE TABLE presupuesto_detalle (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_presupuesto  INT           NOT NULL,
  tipo_linea      ENUM('servicio', 'material', 'repuesto') NOT NULL,
  descripcion     VARCHAR(255)  NOT NULL,
  cantidad        DECIMAL(10,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  aplica_iva      BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (id_presupuesto) REFERENCES presupuesto(id)
);

-- ============================================================
-- ÓRDENES
-- ============================================================
CREATE TABLE orden (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  id_vehiculo             INT NOT NULL,
  id_presupuesto          INT,
  id_orden_origen         INT,
  tipo                    ENUM('pintura', 'mecanica', 'mantenimiento') NOT NULL,
  fecha_ingreso           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_entrega_estimada  DATE,
  fecha_entrega_real      DATE,
  estado                  ENUM('recibido', 'en_proceso', 'listo', 'entregado', 'cancelado') NOT NULL DEFAULT 'recibido',
  es_garantia             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_vencimiento_garantia DATE,
  tipo_pago               ENUM('particular', 'lafise', 'iniser') NOT NULL,
  subtotal                DECIMAL(10,2),
  iva                     DECIMAL(10,2),
  costo_total             DECIMAL(10,2),
  monto_seguro            DECIMAL(10,2),
  monto_cliente           DECIMAL(10,2),
  numero_tramite          VARCHAR(50),
  numero_orden_seguro     VARCHAR(50),
  numero_factura_fisica   VARCHAR(50),
  obra_externa            BOOLEAN NOT NULL DEFAULT FALSE,
  obra_interna            BOOLEAN NOT NULL DEFAULT FALSE,
  danos_ocultos           BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_por              INT NOT NULL,
  FOREIGN KEY (id_vehiculo)     REFERENCES vehiculo(id),
  FOREIGN KEY (id_presupuesto)  REFERENCES presupuesto(id),
  FOREIGN KEY (id_orden_origen) REFERENCES orden(id),
  FOREIGN KEY (creado_por)      REFERENCES usuario(id)
);

-- FK diferida de movimiento_inventario → orden
ALTER TABLE movimiento_inventario
  ADD CONSTRAINT fk_movimiento_orden
  FOREIGN KEY (id_orden) REFERENCES orden(id);

-- ============================================================
-- SERVICIOS DE ORDEN (líneas de cobro al cliente)
-- ============================================================
CREATE TABLE orden_servicio (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_orden    INT           NOT NULL,
  descripcion VARCHAR(255)  NOT NULL,
  precio      DECIMAL(10,2) NOT NULL,
  aplica_iva  BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (id_orden) REFERENCES orden(id)
);

-- ============================================================
-- REPUESTOS DEL CLIENTE (vinculados a la orden)
-- ============================================================
CREATE TABLE repuesto_cliente (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_orden    INT          NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  marca       VARCHAR(100) NOT NULL,
  modelo      VARCHAR(100) NOT NULL,
  cantidad    INT NOT NULL DEFAULT 1,
  estado      ENUM('en_taller', 'devuelto', 'transferido_a_taller') NOT NULL DEFAULT 'en_taller',
  descripcion TEXT,
  FOREIGN KEY (id_orden) REFERENCES orden(id)
);

-- ============================================================
-- MATERIALES USADOS EN ORDEN
-- ============================================================
CREATE TABLE orden_material (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT           NOT NULL,
  id_material     INT           NOT NULL,
  cantidad_usada  DECIMAL(10,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  fecha_registro  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registrado_por  INT NOT NULL,
  FOREIGN KEY (id_orden)       REFERENCES orden(id),
  FOREIGN KEY (id_material)    REFERENCES inventario(id),
  FOREIGN KEY (registrado_por) REFERENCES usuario(id)
);

-- ============================================================
-- REPUESTOS DEL TALLER USADOS EN ORDEN
-- ============================================================
CREATE TABLE orden_repuesto (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT           NOT NULL,
  id_repuesto     INT           NOT NULL,
  cantidad_usada  INT           NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  fecha_registro  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registrado_por  INT NOT NULL,
  FOREIGN KEY (id_orden)       REFERENCES orden(id),
  FOREIGN KEY (id_repuesto)    REFERENCES repuesto_taller(id),
  FOREIGN KEY (registrado_por) REFERENCES usuario(id)
);

-- ============================================================
-- PERSONAL ASIGNADO A ORDEN
-- ============================================================
CREATE TABLE orden_personal (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT           NOT NULL,
  id_personal     INT           NOT NULL,
  monto_acordado  DECIMAL(10,2) NOT NULL,
  fecha_registro  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_orden)    REFERENCES orden(id),
  FOREIGN KEY (id_personal) REFERENCES personal(id)
);

-- ============================================================
-- MEDIA ADJUNTA A ORDEN
-- ============================================================
CREATE TABLE orden_media (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_orden    INT          NOT NULL,
  url         VARCHAR(500) NOT NULL,
  tipo        ENUM('foto', 'video', 'pdf', 'documento') NOT NULL,
  descripcion TEXT,
  fecha_subida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  categoria   ENUM('recepcion_vehiculo', 'dano_oculto', 'trabajo_terminado',
                   'documento_seguro', 'factura', 'recibo', 'otro') NOT NULL,
  subido_por  INT NOT NULL,
  FOREIGN KEY (id_orden)   REFERENCES orden(id),
  FOREIGN KEY (subido_por) REFERENCES usuario(id)
);

-- ============================================================
-- DAÑOS OCULTOS
-- ============================================================
CREATE TABLE orden_dano_oculto (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  id_orden              INT           NOT NULL,
  descripcion           TEXT          NOT NULL,
  costo_adicional       DECIMAL(10,2) NOT NULL,
  aplica_seguro         BOOLEAN NOT NULL DEFAULT FALSE,
  monto_cubierto_seguro DECIMAL(10,2),
  monto_extra_cliente   DECIMAL(10,2),
  estado_aprobacion     ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
  fecha_reporte         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta       DATETIME,
  FOREIGN KEY (id_orden) REFERENCES orden(id)
);

-- ============================================================
-- PAGOS DEL CLIENTE
-- ============================================================
CREATE TABLE pago_cliente (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT           NOT NULL,
  monto           DECIMAL(10,2) NOT NULL,
  fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo            ENUM('adelanto', 'abono', 'saldo') NOT NULL,
  metodo          ENUM('efectivo', 'transferencia', 'otro') NOT NULL,
  numero_recibo   VARCHAR(50),
  registrado_por  INT NOT NULL,
  FOREIGN KEY (id_orden)       REFERENCES orden(id),
  FOREIGN KEY (registrado_por) REFERENCES usuario(id)
);

-- ============================================================
-- PAGOS DE ASEGURADORA
-- ============================================================
CREATE TABLE pago_seguro (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  id_orden            INT           NOT NULL,
  monto               DECIMAL(10,2) NOT NULL,
  fecha_esperada      DATE,
  fecha_recibido      DATE,
  estado              ENUM('pendiente', 'recibido') NOT NULL DEFAULT 'pendiente',
  referencia_bancaria VARCHAR(100),
  concepto            ENUM('pago_principal', 'dano_oculto', 'otro') NOT NULL DEFAULT 'pago_principal',
  FOREIGN KEY (id_orden) REFERENCES orden(id)
);

-- ============================================================
-- LINKER LAFISE
-- ============================================================
CREATE TABLE linker_lafise (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  id_orden            INT         NOT NULL UNIQUE,
  numero_reclamo      VARCHAR(50),
  numero_orden_compra VARCHAR(50),
  chasis              VARCHAR(50),
  motor               VARCHAR(50),
  placa               VARCHAR(20),
  nombre_cliente      VARCHAR(150),
  estado_ingreso      ENUM('pendiente', 'ingresado', 'confirmado', 'rechazado') NOT NULL DEFAULT 'pendiente',
  fecha_ingreso_linker DATETIME,
  observaciones       TEXT,
  FOREIGN KEY (id_orden) REFERENCES orden(id)
);

-- ============================================================
-- LIQUIDACIONES DE PERSONAL
-- ============================================================
CREATE TABLE liquidacion_personal (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_personal INT           NOT NULL,
  fecha       DATE          NOT NULL DEFAULT (CURRENT_DATE),
  monto_total DECIMAL(10,2) NOT NULL,
  pagado      BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_pago  DATE,
  FOREIGN KEY (id_personal) REFERENCES personal(id)
);

CREATE TABLE liquidacion_detalle (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  id_liquidacion   INT NOT NULL,
  id_orden_personal INT NOT NULL,
  FOREIGN KEY (id_liquidacion)   REFERENCES liquidacion_personal(id),
  FOREIGN KEY (id_orden_personal) REFERENCES orden_personal(id)
);

-- ============================================================
-- AUDITORÍA
-- ============================================================
CREATE TABLE auditoria (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario  INT          NOT NULL,
  tabla       VARCHAR(50)  NOT NULL,
  id_registro INT          NOT NULL,
  accion      ENUM('crear', 'editar', 'eliminar', 'cambio_estado') NOT NULL,
  fecha_hora  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle     TEXT,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id)
);

-- ============================================================
-- USUARIO INICIAL (cambiar password después del deploy)
-- password: admin1234  →  bcrypt hash de ejemplo
-- En producción reemplazar el hash con uno generado real
-- ============================================================
INSERT INTO usuario (nombre, email, password_hash, rol, activo)
VALUES (
  'Administrador',
  'admin@tallerespinoza.com',
  '$2b$10$SYLkSVbKJob6fWCM3t1qleSVesHl9b8eFiLTjcsxflnMr3f.TslnS',
  'administrador',
  TRUE
);
