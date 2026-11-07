-- ============================================================================
-- TALLER PEDRO ESPINOZA — SCRIPT 01: DDL MODELO RELACIONAL (53 TABLAS + 8 TRIGGERS + 7 VISTAS)
-- Motor: MySQL 8.0+ (InnoDB, utf8mb4)
-- Normalización: 3FN / BCNF estricta (Cero columnas calculadas, cero JSON, cero ENUMs)
-- ============================================================================

DROP DATABASE IF EXISTS taller_pedro_espinoza;
CREATE DATABASE IF NOT EXISTS taller_pedro_espinoza
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taller_pedro_espinoza;

-- ============================================================================
-- 1. CATÁLOGOS (11 tablas)
-- ============================================================================

CREATE TABLE municipio (
  id_municipio INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  CONSTRAINT uq_municipio_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE marca (
  id_marca INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  CONSTRAINT uq_marca_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE modelo (
  id_modelo INT AUTO_INCREMENT PRIMARY KEY,
  id_marca INT NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  CONSTRAINT uq_modelo_marca_nombre UNIQUE (id_marca, nombre),
  CONSTRAINT fk_modelo_marca FOREIGN KEY (id_marca) REFERENCES marca (id_marca)
) ENGINE=InnoDB;

CREATE TABLE aseguradora (
  id_aseguradora INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  CONSTRAINT uq_aseguradora_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE unidad_medida (
  id_unidad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_unidad_medida_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE tipo_orden (
  id_tipo_orden INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_tipo_orden_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE metodo_pago (
  id_metodo INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_metodo_pago_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE condicion_repuesto (
  id_condicion INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_condicion_repuesto_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE especialidad (
  id_especialidad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_especialidad_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE rol (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_rol_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE tipo_documento (
  id_tipo_documento INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT uq_tipo_documento_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

-- ============================================================================
-- 2. ACTORES (7 tablas)
-- ============================================================================

CREATE TABLE usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  id_rol INT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuario_email UNIQUE (email),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
) ENGINE=InnoDB;

CREATE TABLE cliente (
  id_cliente INT AUTO_INCREMENT PRIMARY KEY,
  id_tipo_documento INT NOT NULL,
  numero_documento VARCHAR(30) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  fecha_nacimiento DATE NULL,
  id_municipio INT NOT NULL,
  direccion VARCHAR(255) NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cliente_documento UNIQUE (id_tipo_documento, numero_documento),
  CONSTRAINT fk_cliente_tipo_documento FOREIGN KEY (id_tipo_documento) REFERENCES tipo_documento (id_tipo_documento),
  CONSTRAINT fk_cliente_municipio FOREIGN KEY (id_municipio) REFERENCES municipio (id_municipio)
) ENGINE=InnoDB;

CREATE TABLE vehiculo (
  matricula VARCHAR(20) PRIMARY KEY,
  id_cliente INT NOT NULL,
  id_modelo INT NOT NULL,
  anio_fabricacion INT NOT NULL,
  color VARCHAR(50) NOT NULL,
  chasis VARCHAR(50) NULL,
  motor VARCHAR(50) NULL,
  CONSTRAINT uq_vehiculo_chasis UNIQUE (chasis),
  CONSTRAINT chk_vehiculo_anio CHECK (anio_fabricacion BETWEEN 1950 AND 2100),
  CONSTRAINT fk_vehiculo_cliente FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  CONSTRAINT fk_vehiculo_modelo FOREIGN KEY (id_modelo) REFERENCES modelo (id_modelo)
) ENGINE=InnoDB;

CREATE TABLE vehiculo_aseguradora (
  matricula VARCHAR(20) PRIMARY KEY,
  id_aseguradora INT NOT NULL,
  CONSTRAINT fk_vehiculo_aseg_vehiculo FOREIGN KEY (matricula) REFERENCES vehiculo (matricula),
  CONSTRAINT fk_vehiculo_aseg_aseguradora FOREIGN KEY (id_aseguradora) REFERENCES aseguradora (id_aseguradora)
) ENGINE=InnoDB;

CREATE TABLE proveedor (
  id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  contacto VARCHAR(150) NULL,
  emite_factura_iva BOOLEAN NOT NULL,
  fijo BOOLEAN NOT NULL
) ENGINE=InnoDB;

CREATE TABLE personal (
  id_personal INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NULL,
  tipo VARCHAR(10) NOT NULL,
  fijo BOOLEAN NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_personal_tipo CHECK (tipo IN ('interno', 'externo'))
) ENGINE=InnoDB;

CREATE TABLE personal_especialidad (
  id_personal INT NOT NULL,
  id_especialidad INT NOT NULL,
  PRIMARY KEY (id_personal, id_especialidad),
  CONSTRAINT fk_pers_esp_personal FOREIGN KEY (id_personal) REFERENCES personal (id_personal),
  CONSTRAINT fk_pers_esp_especialidad FOREIGN KEY (id_especialidad) REFERENCES especialidad (id_especialidad)
) ENGINE=InnoDB;

-- ============================================================================
-- 3. INVENTARIO DE MATERIALES Y REPUESTOS DEL TALLER (6 tablas)
-- ============================================================================

CREATE TABLE material (
  id_material INT AUTO_INCREMENT PRIMARY KEY,
  id_proveedor INT NULL,
  nombre VARCHAR(150) NOT NULL,
  precio_unidad DECIMAL(10,2) NOT NULL,
  stock_minimo DECIMAL(10,2) NOT NULL,
  id_unidad INT NOT NULL,
  fecha_expiracion DATE NULL,
  CONSTRAINT chk_material_precio CHECK (precio_unidad >= 0),
  CONSTRAINT chk_material_stock_min CHECK (stock_minimo >= 0),
  CONSTRAINT fk_material_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor),
  CONSTRAINT fk_material_unidad FOREIGN KEY (id_unidad) REFERENCES unidad_medida (id_unidad)
) ENGINE=InnoDB;

CREATE TABLE compra (
  id_compra INT AUTO_INCREMENT PRIMARY KEY,
  id_proveedor INT NULL,
  fecha DATE NOT NULL,
  monto_subtotal DECIMAL(10,2) NOT NULL,
  monto_iva DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT chk_compra_montos CHECK (monto_subtotal >= 0 AND monto_iva >= 0),
  CONSTRAINT fk_compra_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor)
) ENGINE=InnoDB;

CREATE TABLE compra_detalle (
  id_compra INT NOT NULL,
  id_material INT NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  costo_unitario DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id_compra, id_material),
  CONSTRAINT chk_compra_det_valores CHECK (cantidad > 0 AND costo_unitario >= 0),
  CONSTRAINT fk_compra_det_compra FOREIGN KEY (id_compra) REFERENCES compra (id_compra),
  CONSTRAINT fk_compra_det_material FOREIGN KEY (id_material) REFERENCES material (id_material)
) ENGINE=InnoDB;

CREATE TABLE ajuste_material (
  id_ajuste INT AUTO_INCREMENT PRIMARY KEY,
  id_material INT NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL COMMENT 'Con signo: + sobrante/inicial, - faltante/baja',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario INT NOT NULL,
  nota TEXT NOT NULL,
  CONSTRAINT chk_ajuste_cantidad_no_cero CHECK (cantidad <> 0),
  CONSTRAINT fk_ajuste_material FOREIGN KEY (id_material) REFERENCES material (id_material),
  CONSTRAINT fk_ajuste_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE repuesto_taller (
  id_repuesto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  id_modelo INT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  cantidad_ingresada INT NOT NULL,
  id_condicion INT NOT NULL,
  fecha_ingreso DATE NOT NULL,
  CONSTRAINT chk_repuesto_taller_valores CHECK (precio >= 0 AND cantidad_ingresada > 0),
  CONSTRAINT fk_rep_taller_modelo FOREIGN KEY (id_modelo) REFERENCES modelo (id_modelo),
  CONSTRAINT fk_rep_taller_condicion FOREIGN KEY (id_condicion) REFERENCES condicion_repuesto (id_condicion)
) ENGINE=InnoDB;

CREATE TABLE compatibilidad_repuesto (
  id_repuesto INT NOT NULL,
  id_modelo INT NOT NULL,
  PRIMARY KEY (id_repuesto, id_modelo),
  CONSTRAINT fk_compat_repuesto FOREIGN KEY (id_repuesto) REFERENCES repuesto_taller (id_repuesto),
  CONSTRAINT fk_compat_modelo FOREIGN KEY (id_modelo) REFERENCES modelo (id_modelo)
) ENGINE=InnoDB;

-- ============================================================================
-- 4. AGENDA DE CITAS Y PRESUPUESTOS / PROFORMAS (3 tablas)
-- ============================================================================

CREATE TABLE cita (
  id_cita INT AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(20) NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'programada',
  id_usuario INT NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_cita_fechas CHECK (fecha_fin > fecha_inicio),
  CONSTRAINT chk_cita_estado CHECK (estado IN ('programada', 'completada', 'cancelada')),
  CONSTRAINT fk_cita_vehiculo FOREIGN KEY (matricula) REFERENCES vehiculo (matricula),
  CONSTRAINT fk_cita_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE presupuesto (
  id_presupuesto INT AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  estado VARCHAR(10) NOT NULL,
  observaciones TEXT NULL,
  CONSTRAINT chk_presupuesto_estado CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  CONSTRAINT fk_presupuesto_vehiculo FOREIGN KEY (matricula) REFERENCES vehiculo (matricula)
) ENGINE=InnoDB;

CREATE TABLE presupuesto_detalle (
  id_presupuesto INT NOT NULL,
  num_linea INT NOT NULL,
  tipo_linea VARCHAR(10) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  aplica_iva BOOLEAN NOT NULL,
  PRIMARY KEY (id_presupuesto, num_linea),
  CONSTRAINT chk_pres_det_tipo CHECK (tipo_linea IN ('servicio', 'material', 'repuesto')),
  CONSTRAINT chk_pres_det_valores CHECK (num_linea > 0 AND cantidad > 0 AND precio_unitario >= 0),
  CONSTRAINT fk_pres_det_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES presupuesto (id_presupuesto)
) ENGINE=InnoDB;

-- ============================================================================
-- 5. ÓRDENES, TRABAJO, GARANTÍAS, SEGUROS Y FACTURAS (21 tablas)
-- ============================================================================

CREATE TABLE orden (
  id_orden INT AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(20) NOT NULL,
  id_tipo_orden INT NOT NULL,
  estado VARCHAR(12) NOT NULL,
  fecha_ingreso DATETIME NOT NULL,
  fecha_entrega_estimada DATE NULL,
  fecha_entrega_real DATE NULL,
  id_usuario INT NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_orden_estado CHECK (estado IN ('recibido', 'en_proceso', 'listo', 'entregado', 'cancelado')),
  CONSTRAINT chk_orden_fechas CHECK (
    (fecha_entrega_estimada IS NULL OR fecha_entrega_estimada >= DATE(fecha_ingreso)) AND
    (fecha_entrega_real IS NULL OR fecha_entrega_real >= DATE(fecha_ingreso))
  ),
  CONSTRAINT fk_orden_vehiculo FOREIGN KEY (matricula) REFERENCES vehiculo (matricula),
  CONSTRAINT fk_orden_tipo_orden FOREIGN KEY (id_tipo_orden) REFERENCES tipo_orden (id_tipo_orden),
  CONSTRAINT fk_orden_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE orden_presupuesto (
  id_orden INT PRIMARY KEY,
  id_presupuesto INT NOT NULL,
  CONSTRAINT uq_orden_presupuesto UNIQUE (id_presupuesto),
  CONSTRAINT fk_ord_pres_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_ord_pres_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES presupuesto (id_presupuesto)
) ENGINE=InnoDB;

CREATE TABLE orden_servicio (
  id_orden INT NOT NULL,
  num_linea INT NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  aplica_iva BOOLEAN NOT NULL,
  PRIMARY KEY (id_orden, num_linea),
  CONSTRAINT chk_ord_serv_valores CHECK (num_linea > 0 AND precio >= 0),
  CONSTRAINT fk_ord_serv_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden)
) ENGINE=InnoDB;

CREATE TABLE orden_material (
  id_orden INT NOT NULL,
  id_material INT NOT NULL,
  cantidad_usada DECIMAL(10,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario INT NOT NULL,
  PRIMARY KEY (id_orden, id_material),
  CONSTRAINT chk_ord_mat_valores CHECK (cantidad_usada > 0 AND precio_unitario >= 0),
  CONSTRAINT fk_ord_mat_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_ord_mat_material FOREIGN KEY (id_material) REFERENCES material (id_material),
  CONSTRAINT fk_ord_mat_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE orden_repuesto (
  id_orden INT NOT NULL,
  id_repuesto INT NOT NULL,
  cantidad_usada INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario INT NOT NULL,
  PRIMARY KEY (id_orden, id_repuesto),
  CONSTRAINT chk_ord_rep_valores CHECK (cantidad_usada > 0 AND precio_unitario >= 0),
  CONSTRAINT fk_ord_rep_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_ord_rep_repuesto FOREIGN KEY (id_repuesto) REFERENCES repuesto_taller (id_repuesto),
  CONSTRAINT fk_ord_rep_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE repuesto_cliente (
  id_orden INT NOT NULL,
  num_item INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  id_modelo INT NOT NULL,
  cantidad INT NOT NULL,
  estado VARCHAR(10) NOT NULL,
  descripcion TEXT NULL,
  PRIMARY KEY (id_orden, num_item),
  CONSTRAINT chk_rep_cli_estado CHECK (estado IN ('en_taller', 'devuelto')),
  CONSTRAINT chk_rep_cli_valores CHECK (num_item > 0 AND cantidad > 0),
  CONSTRAINT fk_rep_cli_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_rep_cli_modelo FOREIGN KEY (id_modelo) REFERENCES modelo (id_modelo)
) ENGINE=InnoDB;

CREATE TABLE transferencia_repuesto (
  id_orden INT NOT NULL,
  num_item INT NOT NULL,
  id_repuesto INT NOT NULL,
  PRIMARY KEY (id_orden, num_item),
  CONSTRAINT uq_transf_id_repuesto UNIQUE (id_repuesto),
  CONSTRAINT fk_transf_rep_cliente FOREIGN KEY (id_orden, num_item) REFERENCES repuesto_cliente (id_orden, num_item),
  CONSTRAINT fk_transf_rep_taller FOREIGN KEY (id_repuesto) REFERENCES repuesto_taller (id_repuesto)
) ENGINE=InnoDB;

CREATE TABLE orden_personal (
  id_orden INT NOT NULL,
  id_personal INT NOT NULL,
  monto_acordado DECIMAL(10,2) NOT NULL,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_orden, id_personal),
  CONSTRAINT chk_ord_pers_monto CHECK (monto_acordado >= 0),
  CONSTRAINT fk_ord_pers_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_ord_pers_personal FOREIGN KEY (id_personal) REFERENCES personal (id_personal)
) ENGINE=InnoDB;

CREATE TABLE orden_media (
  id_orden INT NOT NULL,
  num_archivo INT NOT NULL,
  url VARCHAR(500) NOT NULL,
  tipo VARCHAR(10) NOT NULL,
  descripcion TEXT NULL,
  categoria VARCHAR(25) NOT NULL,
  fecha_subida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario INT NOT NULL,
  PRIMARY KEY (id_orden, num_archivo),
  CONSTRAINT chk_ord_media_tipo CHECK (tipo IN ('foto', 'video', 'pdf', 'documento')),
  CONSTRAINT chk_ord_media_categoria CHECK (categoria IN ('recepcion', 'dano_oculto', 'trabajo_terminado', 'seguro', 'factura', 'recibo', 'otro')),
  CONSTRAINT chk_ord_media_num CHECK (num_archivo > 0),
  CONSTRAINT fk_ord_media_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_ord_media_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE garantia (
  id_orden INT NOT NULL,
  num_garantia INT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  PRIMARY KEY (id_orden, num_garantia),
  CONSTRAINT chk_garantia_num CHECK (num_garantia > 0),
  CONSTRAINT fk_garantia_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden)
) ENGINE=InnoDB;

CREATE TABLE garantia_servicio (
  id_orden INT NOT NULL,
  num_garantia INT NOT NULL,
  num_linea INT NOT NULL,
  PRIMARY KEY (id_orden, num_garantia),
  CONSTRAINT uq_gar_serv_linea UNIQUE (id_orden, num_linea),
  CONSTRAINT fk_gar_serv_garantia FOREIGN KEY (id_orden, num_garantia) REFERENCES garantia (id_orden, num_garantia),
  CONSTRAINT fk_gar_serv_servicio FOREIGN KEY (id_orden, num_linea) REFERENCES orden_servicio (id_orden, num_linea)
) ENGINE=InnoDB;

CREATE TABLE garantia_repuesto (
  id_orden INT NOT NULL,
  num_garantia INT NOT NULL,
  id_repuesto INT NOT NULL,
  PRIMARY KEY (id_orden, num_garantia),
  CONSTRAINT uq_gar_rep_repuesto UNIQUE (id_orden, id_repuesto),
  CONSTRAINT fk_gar_rep_garantia FOREIGN KEY (id_orden, num_garantia) REFERENCES garantia (id_orden, num_garantia),
  CONSTRAINT fk_gar_rep_repuesto FOREIGN KEY (id_orden, id_repuesto) REFERENCES orden_repuesto (id_orden, id_repuesto)
) ENGINE=InnoDB;

CREATE TABLE reclamo_garantia (
  id_orden INT PRIMARY KEY,
  id_orden_origen INT NOT NULL,
  num_garantia INT NOT NULL,
  CONSTRAINT chk_reclamo_no_misma_orden CHECK (id_orden <> id_orden_origen),
  CONSTRAINT fk_reclamo_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_reclamo_garantia FOREIGN KEY (id_orden_origen, num_garantia) REFERENCES garantia (id_orden, num_garantia)
) ENGINE=InnoDB;

CREATE TABLE orden_dano_particular (
  id_orden INT PRIMARY KEY,
  id_orden_origen INT NOT NULL,
  CONSTRAINT chk_dano_part_no_misma_orden CHECK (id_orden <> id_orden_origen),
  CONSTRAINT fk_dano_part_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_dano_part_origen FOREIGN KEY (id_orden_origen) REFERENCES orden (id_orden)
) ENGINE=InnoDB;

CREATE TABLE orden_seguro (
  id_orden INT PRIMARY KEY,
  id_aseguradora INT NOT NULL,
  numero_tramite VARCHAR(50) NULL,
  numero_orden_seguro VARCHAR(50) NULL,
  monto_autorizado DECIMAL(10,2) NOT NULL,
  CONSTRAINT chk_ord_seg_monto CHECK (monto_autorizado >= 0),
  CONSTRAINT fk_ord_seg_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_ord_seg_aseguradora FOREIGN KEY (id_aseguradora) REFERENCES aseguradora (id_aseguradora)
) ENGINE=InnoDB;

CREATE TABLE dano_oculto (
  id_orden INT NOT NULL,
  num_dano INT NOT NULL,
  descripcion TEXT NOT NULL,
  costo_adicional DECIMAL(10,2) NOT NULL,
  fecha_reporte DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_orden, num_dano),
  CONSTRAINT chk_dano_oculto_valores CHECK (num_dano > 0 AND costo_adicional > 0),
  CONSTRAINT fk_dano_oculto_ord_seg FOREIGN KEY (id_orden) REFERENCES orden_seguro (id_orden)
) ENGINE=InnoDB;

CREATE TABLE dano_oculto_respuesta (
  id_orden INT NOT NULL,
  num_dano INT NOT NULL,
  aprobado BOOLEAN NOT NULL,
  monto_cubierto_seguro DECIMAL(10,2) NOT NULL,
  fecha_respuesta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_orden, num_dano),
  CONSTRAINT chk_dano_resp_monto CHECK (
    (aprobado = FALSE AND monto_cubierto_seguro = 0) OR
    (aprobado = TRUE AND monto_cubierto_seguro >= 0)
  ),
  CONSTRAINT fk_dano_resp_dano FOREIGN KEY (id_orden, num_dano) REFERENCES dano_oculto (id_orden, num_dano)
) ENGINE=InnoDB;

CREATE TABLE linker_lafise (
  id_orden INT PRIMARY KEY,
  numero_reclamo VARCHAR(50) NOT NULL,
  numero_orden_compra VARCHAR(50) NULL,
  estado_ingreso VARCHAR(12) NOT NULL,
  fecha_ingreso_linker DATETIME NULL,
  observaciones TEXT NULL,
  CONSTRAINT chk_linker_estado CHECK (estado_ingreso IN ('pendiente', 'ingresado', 'confirmado', 'rechazado')),
  CONSTRAINT fk_linker_ord_seg FOREIGN KEY (id_orden) REFERENCES orden_seguro (id_orden)
) ENGINE=InnoDB;

CREATE TABLE factura (
  numero_factura VARCHAR(50) PRIMARY KEY,
  fecha_emision DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  iva DECIMAL(10,2) NOT NULL,
  CONSTRAINT chk_factura_montos CHECK (subtotal >= 0 AND iva >= 0)
) ENGINE=InnoDB;

CREATE TABLE factura_cliente (
  numero_factura VARCHAR(50) PRIMARY KEY,
  id_orden INT NOT NULL,
  CONSTRAINT uq_fact_cli_orden UNIQUE (id_orden),
  CONSTRAINT fk_fact_cli_factura FOREIGN KEY (numero_factura) REFERENCES factura (numero_factura),
  CONSTRAINT fk_fact_cli_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden)
) ENGINE=InnoDB;

CREATE TABLE factura_seguro (
  numero_factura VARCHAR(50) PRIMARY KEY,
  id_orden INT NOT NULL,
  CONSTRAINT uq_fact_seg_orden UNIQUE (id_orden),
  CONSTRAINT fk_fact_seg_factura FOREIGN KEY (numero_factura) REFERENCES factura (numero_factura),
  CONSTRAINT fk_fact_seg_ord_seg FOREIGN KEY (id_orden) REFERENCES orden_seguro (id_orden)
) ENGINE=InnoDB;

-- ============================================================================
-- 6. PAGOS, LIQUIDACIONES Y AUDITORÍA (5 tablas restantes -> Total: 53 tablas)
-- ============================================================================

CREATE TABLE pago_cliente (
  id_orden INT NOT NULL,
  num_pago INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_metodo INT NOT NULL,
  numero_recibo VARCHAR(50) NOT NULL,
  id_usuario INT NOT NULL,
  PRIMARY KEY (id_orden, num_pago),
  CONSTRAINT uq_pago_cliente_recibo UNIQUE (numero_recibo),
  CONSTRAINT chk_pago_cli_valores CHECK (num_pago > 0 AND monto > 0),
  CONSTRAINT fk_pago_cli_orden FOREIGN KEY (id_orden) REFERENCES orden (id_orden),
  CONSTRAINT fk_pago_cli_metodo FOREIGN KEY (id_metodo) REFERENCES metodo_pago (id_metodo),
  CONSTRAINT fk_pago_cli_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE pago_seguro (
  id_orden INT NOT NULL,
  num_pago INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha_recibido DATE NOT NULL,
  referencia_bancaria VARCHAR(100) NOT NULL,
  concepto VARCHAR(15) NOT NULL,
  PRIMARY KEY (id_orden, num_pago),
  CONSTRAINT chk_pago_seg_concepto CHECK (concepto IN ('pago_principal', 'dano_oculto', 'otro')),
  CONSTRAINT chk_pago_seg_valores CHECK (num_pago > 0 AND monto > 0),
  CONSTRAINT fk_pago_seg_ord_seg FOREIGN KEY (id_orden) REFERENCES orden_seguro (id_orden)
) ENGINE=InnoDB;

CREATE TABLE liquidacion (
  id_liquidacion INT AUTO_INCREMENT PRIMARY KEY,
  id_personal INT NOT NULL,
  fecha DATE NOT NULL,
  fecha_pago DATE NULL COMMENT 'NULL = pendiente de pago',
  CONSTRAINT uq_liquidacion_id_personal UNIQUE (id_liquidacion, id_personal),
  CONSTRAINT chk_liquidacion_fechas CHECK (fecha_pago IS NULL OR fecha_pago >= fecha),
  CONSTRAINT fk_liquidacion_personal FOREIGN KEY (id_personal) REFERENCES personal (id_personal)
) ENGINE=InnoDB;

CREATE TABLE liquidacion_detalle (
  id_orden INT NOT NULL,
  id_personal INT NOT NULL,
  id_liquidacion INT NOT NULL,
  PRIMARY KEY (id_orden, id_personal),
  CONSTRAINT fk_liq_det_orden_personal FOREIGN KEY (id_orden, id_personal)
    REFERENCES orden_personal (id_orden, id_personal),
  CONSTRAINT fk_liq_det_liquidacion_misma_persona FOREIGN KEY (id_liquidacion, id_personal)
    REFERENCES liquidacion (id_liquidacion, id_personal)
) ENGINE=InnoDB;

CREATE TABLE auditoria (
  id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tabla VARCHAR(50) NOT NULL,
  id_registro VARCHAR(50) NOT NULL,
  accion VARCHAR(15) NOT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle TEXT NULL,
  CONSTRAINT chk_auditoria_accion CHECK (accion IN ('crear', 'editar', 'eliminar', 'cambio_estado')),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;

-- ============================================================================
-- 7. TRIGGERS DE INTEGRIDAD RELACIONAL (SUBTIPOS DISJUNTOS Y SOLAPAMIENTO)
-- ============================================================================

DELIMITER $$

-- 7.1 Exclusividad de subtipos de Factura (Cliente XOR Seguro)
CREATE TRIGGER trg_factura_cliente_exclusiva
BEFORE INSERT ON factura_cliente
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM factura_seguro WHERE numero_factura = NEW.numero_factura) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integridad de subtipo violada: La factura ya está registrada como factura de seguro.';
  END IF;
END$$

CREATE TRIGGER trg_factura_seguro_exclusiva
BEFORE INSERT ON factura_seguro
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM factura_cliente WHERE numero_factura = NEW.numero_factura) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integridad de subtipo violada: La factura ya está registrada como factura de cliente.';
  END IF;
END$$

-- 7.2 Exclusividad de subtipos de Garantía (Servicio XOR Repuesto)
CREATE TRIGGER trg_garantia_servicio_exclusiva
BEFORE INSERT ON garantia_servicio
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM garantia_repuesto WHERE id_orden = NEW.id_orden AND num_garantia = NEW.num_garantia) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integridad de subtipo violada: Esta garantía ya cubre un repuesto.';
  END IF;
END$$

CREATE TRIGGER trg_garantia_repuesto_exclusiva
BEFORE INSERT ON garantia_repuesto
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM garantia_servicio WHERE id_orden = NEW.id_orden AND num_garantia = NEW.num_garantia) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integridad de subtipo violada: Esta garantía ya cubre un servicio.';
  END IF;
END$$

-- 7.3 Exclusividad de órdenes derivadas (Reclamo de Garantía XOR Daño Particular)
CREATE TRIGGER trg_reclamo_garantia_exclusivo
BEFORE INSERT ON reclamo_garantia
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM orden_dano_particular WHERE id_orden = NEW.id_orden) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integridad de subtipo violada: La orden ya está clasificada como daño particular.';
  END IF;
END$$

CREATE TRIGGER trg_dano_particular_exclusivo
BEFORE INSERT ON orden_dano_particular
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM reclamo_garantia WHERE id_orden = NEW.id_orden) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integridad de subtipo violada: La orden ya está clasificada como reclamo de garantía.';
  END IF;
END$$

-- 7.4 Prevención de solapamiento horario de citas por vehículo
CREATE TRIGGER trg_cita_no_solapada_ins
BEFORE INSERT ON cita
FOR EACH ROW
BEGIN
  IF NEW.estado = 'programada' AND EXISTS (
    SELECT 1 FROM cita c
    WHERE c.matricula = NEW.matricula
      AND c.estado = 'programada'
      AND NEW.fecha_inicio < c.fecha_fin
      AND NEW.fecha_fin > c.fecha_inicio
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Conflicto de agenda: El vehículo ya tiene una cita programada en ese rango horario.';
  END IF;
END$$

CREATE TRIGGER trg_cita_no_solapada_upd
BEFORE UPDATE ON cita
FOR EACH ROW
BEGIN
  IF NEW.estado = 'programada' AND EXISTS (
    SELECT 1 FROM cita c
    WHERE c.matricula = NEW.matricula
      AND c.id_cita <> NEW.id_cita
      AND c.estado = 'programada'
      AND NEW.fecha_inicio < c.fecha_fin
      AND NEW.fecha_fin > c.fecha_inicio
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Conflicto de agenda: El vehículo ya tiene otra cita programada en ese rango horario.';
  END IF;
END$$

DELIMITER ;

-- ============================================================================
-- 8. VISTAS PARA DATOS DERIVADOS (7 Vistas eficientes en 3FN)
-- ============================================================================

-- 8.1 Stock actual de materiales consumibles
CREATE OR REPLACE VIEW vw_stock_material AS
SELECT
  m.id_material,
  m.id_proveedor,
  m.nombre,
  m.precio_unidad,
  m.stock_minimo,
  m.id_unidad,
  u.nombre AS unidad_medida,
  m.fecha_expiracion,
  COALESCE((SELECT SUM(cd.cantidad) FROM compra_detalle cd WHERE cd.id_material = m.id_material), 0)
  + COALESCE((SELECT SUM(am.cantidad) FROM ajuste_material am WHERE am.id_material = m.id_material), 0)
  - COALESCE((SELECT SUM(om.cantidad_usada) FROM orden_material om WHERE om.id_material = m.id_material), 0)
  AS stock_actual
FROM material m
JOIN unidad_medida u ON u.id_unidad = m.id_unidad;

-- 8.2 Kardex / Historial unificado de movimientos de materiales (sin NULLs estructurales)
CREATE OR REPLACE VIEW vw_movimiento_material AS
SELECT
  cd.id_material,
  'entrada_compra' AS tipo,
  cd.cantidad,
  CAST(c.fecha AS DATETIME) AS fecha,
  NULL AS id_usuario,
  c.id_compra AS id_referencia,
  CONCAT('Compra #', c.id_compra) AS nota
FROM compra_detalle cd
JOIN compra c ON c.id_compra = cd.id_compra
UNION ALL
SELECT
  om.id_material,
  'salida_orden' AS tipo,
  -om.cantidad_usada AS cantidad,
  om.fecha_registro AS fecha,
  om.id_usuario,
  om.id_orden AS id_referencia,
  CONCAT('Consumo en orden #', om.id_orden) AS nota
FROM orden_material om
UNION ALL
SELECT
  am.id_material,
  'ajuste_manual' AS tipo,
  am.cantidad,
  am.fecha,
  am.id_usuario,
  am.id_ajuste AS id_referencia,
  am.nota
FROM ajuste_material am;

-- 8.3 Stock disponible y origen de repuestos del taller
CREATE OR REPLACE VIEW vw_stock_repuesto_taller AS
SELECT
  rt.id_repuesto,
  rt.nombre,
  rt.id_modelo,
  mo.nombre AS modelo,
  ma.id_marca,
  ma.nombre AS marca,
  rt.precio,
  rt.cantidad_ingresada,
  rt.cantidad_ingresada - COALESCE((SELECT SUM(orr.cantidad_usada) FROM orden_repuesto orr WHERE orr.id_repuesto = rt.id_repuesto), 0)
  AS stock_disponible,
  rt.id_condicion,
  cr.nombre AS condicion,
  rt.fecha_ingreso,
  CASE WHEN tr.id_repuesto IS NOT NULL THEN 'transferido_de_cliente' ELSE 'compra_taller' END AS origen
FROM repuesto_taller rt
JOIN modelo mo ON mo.id_modelo = rt.id_modelo
JOIN marca ma ON ma.id_marca = mo.id_marca
JOIN condicion_repuesto cr ON cr.id_condicion = rt.id_condicion
LEFT JOIN transferencia_repuesto tr ON tr.id_repuesto = rt.id_repuesto;

-- 8.4 Totales calculados de presupuestos / proformas (IVA 15%)
CREATE OR REPLACE VIEW vw_totales_presupuesto AS
SELECT
  p.id_presupuesto,
  p.matricula,
  p.fecha,
  p.estado,
  p.observaciones,
  COALESCE(ROUND(SUM(pd.cantidad * pd.precio_unitario), 2), 0.00) AS subtotal,
  COALESCE(ROUND(SUM(CASE WHEN pd.aplica_iva THEN pd.cantidad * pd.precio_unitario * 0.15 ELSE 0 END), 2), 0.00) AS iva,
  COALESCE(ROUND(SUM(pd.cantidad * pd.precio_unitario * CASE WHEN pd.aplica_iva THEN 1.15 ELSE 1.00 END), 2), 0.00) AS total
FROM presupuesto p
LEFT JOIN presupuesto_detalle pd ON pd.id_presupuesto = p.id_presupuesto
GROUP BY p.id_presupuesto, p.matricula, p.fecha, p.estado, p.observaciones;

-- 8.5 Totales, saldos e indicadores derivados de órdenes
CREATE OR REPLACE VIEW vw_totales_orden AS
SELECT
  o.id_orden,
  o.matricula,
  o.id_tipo_orden,
  o.estado,
  o.fecha_ingreso,
  o.fecha_entrega_estimada,
  o.fecha_entrega_real,
  o.id_usuario,
  o.fecha_creacion,
  opres.id_presupuesto,
  oseg.id_aseguradora,
  aseg.nombre AS nombre_aseguradora,
  oseg.numero_tramite,
  oseg.numero_orden_seguro,
  oseg.monto_autorizado,
  (
    COALESCE((SELECT ROUND(SUM(os.precio), 2) FROM orden_servicio os WHERE os.id_orden = o.id_orden), 0.00)
    + COALESCE((SELECT ROUND(SUM(om.cantidad_usada * om.precio_unitario), 2) FROM orden_material om WHERE om.id_orden = o.id_orden), 0.00)
    + COALESCE((SELECT ROUND(SUM(orep.cantidad_usada * orep.precio_unitario), 2) FROM orden_repuesto orep WHERE orep.id_orden = o.id_orden), 0.00)
  ) AS subtotal,
  COALESCE((SELECT ROUND(SUM(CASE WHEN os.aplica_iva THEN os.precio * 0.15 ELSE 0 END), 2) FROM orden_servicio os WHERE os.id_orden = o.id_orden), 0.00) AS iva,
  (
    COALESCE((SELECT ROUND(SUM(os.precio * CASE WHEN os.aplica_iva THEN 1.15 ELSE 1.00 END), 2) FROM orden_servicio os WHERE os.id_orden = o.id_orden), 0.00)
    + COALESCE((SELECT ROUND(SUM(om.cantidad_usada * om.precio_unitario), 2) FROM orden_material om WHERE om.id_orden = o.id_orden), 0.00)
    + COALESCE((SELECT ROUND(SUM(orep.cantidad_usada * orep.precio_unitario), 2) FROM orden_repuesto orep WHERE orep.id_orden = o.id_orden), 0.00)
  ) AS costo_total,
  COALESCE((SELECT SUM(pc.monto) FROM pago_cliente pc WHERE pc.id_orden = o.id_orden), 0.00) AS abonado_cliente,
  COALESCE((SELECT SUM(ps.monto) FROM pago_seguro ps WHERE ps.id_orden = o.id_orden), 0.00) AS abonado_seguro,
  EXISTS (SELECT 1 FROM reclamo_garantia rg WHERE rg.id_orden = o.id_orden) AS es_reclamo_garantia,
  EXISTS (SELECT 1 FROM garantia g WHERE g.id_orden = o.id_orden) AS tiene_garantia,
  EXISTS (SELECT 1 FROM dano_oculto d WHERE d.id_orden = o.id_orden) AS danos_ocultos,
  EXISTS (SELECT 1 FROM orden_personal op JOIN personal pe ON pe.id_personal = op.id_personal WHERE op.id_orden = o.id_orden AND pe.tipo = 'interno') AS obra_interna,
  EXISTS (SELECT 1 FROM orden_personal op JOIN personal pe ON pe.id_personal = op.id_personal WHERE op.id_orden = o.id_orden AND pe.tipo = 'externo') AS obra_externa
FROM orden o
LEFT JOIN orden_presupuesto opres ON opres.id_orden = o.id_orden
LEFT JOIN orden_seguro oseg ON oseg.id_orden = o.id_orden
LEFT JOIN aseguradora aseg ON aseg.id_aseguradora = oseg.id_aseguradora;

-- 8.6 Totales y clasificación de facturas
CREATE OR REPLACE VIEW vw_totales_factura AS
SELECT
  f.numero_factura,
  f.fecha_emision,
  f.subtotal,
  f.iva,
  (f.subtotal + f.iva) AS total,
  COALESCE(fc.id_orden, fs.id_orden) AS id_orden,
  CASE
    WHEN fc.numero_factura IS NOT NULL THEN 'cliente'
    WHEN fs.numero_factura IS NOT NULL THEN 'seguro'
  END AS tipo_factura
FROM factura f
LEFT JOIN factura_cliente fc ON fc.numero_factura = f.numero_factura
LEFT JOIN factura_seguro fs ON fs.numero_factura = f.numero_factura;

-- 8.7 Totales y estado de liquidaciones de personal
CREATE OR REPLACE VIEW vw_totales_liquidacion AS
SELECT
  l.id_liquidacion,
  l.id_personal,
  p.nombre AS nombre_personal,
  l.fecha,
  l.fecha_pago,
  (l.fecha_pago IS NOT NULL) AS pagado,
  COALESCE(SUM(op.monto_acordado), 0.00) AS monto_total
FROM liquidacion l
JOIN personal p ON p.id_personal = l.id_personal
LEFT JOIN liquidacion_detalle ld ON ld.id_liquidacion = l.id_liquidacion AND ld.id_personal = l.id_personal
LEFT JOIN orden_personal op ON op.id_orden = ld.id_orden AND op.id_personal = ld.id_personal
GROUP BY l.id_liquidacion, l.id_personal, p.nombre, l.fecha, l.fecha_pago;