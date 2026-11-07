-- ============================================================================
-- TALLER PEDRO ESPINOZA — SCRIPT DE LLENADO ORGÁNICO ESTÁNDAR (53 TABLAS)
-- Ejecutar en MySQL Workbench después del script DDL (01_crear_database_v7.sql)
-- Contraseña de todos los usuarios para el Login web: admin1234
-- ============================================================================

USE taller_pedro_espinoza;

-- 1. LIMPIEZA SEGURA DE DATOS PREVIOS
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE auditoria;
TRUNCATE TABLE liquidacion_detalle;
TRUNCATE TABLE liquidacion;
TRUNCATE TABLE pago_seguro;
TRUNCATE TABLE pago_cliente;
TRUNCATE TABLE factura_seguro;
TRUNCATE TABLE factura_cliente;
TRUNCATE TABLE factura;
TRUNCATE TABLE linker_lafise;
TRUNCATE TABLE dano_oculto_respuesta;
TRUNCATE TABLE dano_oculto;
TRUNCATE TABLE orden_seguro;
TRUNCATE TABLE orden_dano_particular;
TRUNCATE TABLE reclamo_garantia;
TRUNCATE TABLE garantia_repuesto;
TRUNCATE TABLE garantia_servicio;
TRUNCATE TABLE garantia;
TRUNCATE TABLE orden_media;
TRUNCATE TABLE orden_personal;
TRUNCATE TABLE transferencia_repuesto;
TRUNCATE TABLE repuesto_cliente;
TRUNCATE TABLE orden_repuesto;
TRUNCATE TABLE orden_material;
TRUNCATE TABLE orden_servicio;
TRUNCATE TABLE orden_presupuesto;
TRUNCATE TABLE orden;
TRUNCATE TABLE presupuesto_detalle;
TRUNCATE TABLE presupuesto;
TRUNCATE TABLE cita;
TRUNCATE TABLE compatibilidad_repuesto;
TRUNCATE TABLE repuesto_taller;
TRUNCATE TABLE ajuste_material;
TRUNCATE TABLE compra_detalle;
TRUNCATE TABLE compra;
TRUNCATE TABLE material;
TRUNCATE TABLE personal_especialidad;
TRUNCATE TABLE personal;
TRUNCATE TABLE proveedor;
TRUNCATE TABLE vehiculo_aseguradora;
TRUNCATE TABLE vehiculo;
TRUNCATE TABLE cliente;
TRUNCATE TABLE usuario;
TRUNCATE TABLE tipo_documento;
TRUNCATE TABLE rol;
TRUNCATE TABLE especialidad;
TRUNCATE TABLE condicion_repuesto;
TRUNCATE TABLE metodo_pago;
TRUNCATE TABLE tipo_orden;
TRUNCATE TABLE unidad_medida;
TRUNCATE TABLE aseguradora;
TRUNCATE TABLE modelo;
TRUNCATE TABLE marca;
TRUNCATE TABLE municipio;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. CATÁLOGOS BASE (11 tablas)
-- ============================================================================

INSERT INTO municipio (id_municipio, nombre) VALUES
  (1, 'Managua'),
  (2, 'Ciudad Sandino'),
  (3, 'Masaya'),
  (4, 'Granada'),
  (5, 'León'),
  (6, 'Estelí');

INSERT INTO tipo_documento (id_tipo_documento, nombre) VALUES
  (1, 'Cédula'),
  (2, 'Pasaporte'),
  (3, 'Cédula de Residencia'),
  (4, 'RUC');

INSERT INTO marca (id_marca, nombre) VALUES
  (1, 'Hyundai'),
  (2, 'Toyota'),
  (3, 'Kia'),
  (4, 'Nissan');

INSERT INTO modelo (id_modelo, id_marca, nombre) VALUES
  (1, 1, 'Accent'),
  (2, 2, 'Hilux'),
  (3, 3, 'Rio'),
  (4, 1, 'Elantra'),
  (5, 2, 'Corolla'),
  (6, 4, 'Frontier');

INSERT INTO aseguradora (id_aseguradora, nombre) VALUES
  (1, 'Seguros LAFISE'),
  (2, 'INISER');

INSERT INTO unidad_medida (id_unidad, nombre) VALUES
  (1, 'Galón'),
  (2, 'Litro'),
  (3, 'Unidad'),
  (4, 'Pliego');

INSERT INTO tipo_orden (id_tipo_orden, nombre) VALUES
  (1, 'Mecánica'),
  (2, 'Enderezado y Pintura'),
  (3, 'Pintura'),
  (4, 'Mantenimiento');

INSERT INTO metodo_pago (id_metodo, nombre) VALUES
  (1, 'Efectivo'),
  (2, 'Transferencia'),
  (3, 'Tarjeta'),
  (4, 'Otro');

INSERT INTO condicion_repuesto (id_condicion, nombre) VALUES
  (1, 'Nuevo'),
  (2, 'Usado Bueno'),
  (3, 'Usado Regular'),
  (4, 'Para Reparar');

INSERT INTO especialidad (id_especialidad, nombre) VALUES
  (1, 'Mecánico'),
  (2, 'Enderezador'),
  (3, 'Pintor'),
  (4, 'Electricista');

INSERT INTO rol (id_rol, nombre) VALUES
  (1, 'Administradora'),
  (2, 'Recepcionista'),
  (3, 'Propietario');

-- ============================================================================
-- 2. ACTORES: USUARIOS, 4 CLIENTES (CASOS DISTINTOS), 6 VEHÍCULOS, PERSONAL
-- Contraseña de todos los usuarios: admin1234
-- ============================================================================

INSERT INTO usuario (id_usuario, nombre, email, password_hash, id_rol, activo, fecha_creacion) VALUES
  (1, 'María López (Recepcionista)',  'recepcion@tallerpedro.com', '$2b$10$SYLkSVbKJob6fWCM3t1qleSVesHl9b8eFiLTjcsxflnMr3f.TslnS', 2, TRUE, '2026-01-10 08:00:00'),
  (2, 'Doña Carmen (Administradora)', 'admin@tallerpedro.com',     '$2b$10$SYLkSVbKJob6fWCM3t1qleSVesHl9b8eFiLTjcsxflnMr3f.TslnS', 1, TRUE, '2026-01-10 08:00:00'),
  (3, 'Pedro Espinoza (Propietario)', 'admin@tallerespinoza.com',  '$2b$10$SYLkSVbKJob6fWCM3t1qleSVesHl9b8eFiLTjcsxflnMr3f.TslnS', 3, TRUE, '2026-01-10 08:00:00');

INSERT INTO cliente (id_cliente, id_tipo_documento, numero_documento, nombre, telefono, fecha_nacimiento, id_municipio, direccion, fecha_creacion) VALUES
  (1, 1, '001-150585-0023A', 'Carlos Alberto Mendoza',    '8888-1122', '1985-05-15', 1, 'Altamira 2c al sur, casa #45',      '2026-09-01 09:00:00'),
  (2, 4, 'J0310000456789',   'Distribuidora El Sol S.A.', '2255-4400', NULL,         1, 'Carretera Norte Km 5.5',            '2026-10-05 10:00:00'),
  (3, 1, '401-220892-0011B', 'Ana Sofía Blandón',         '8777-3344', '1992-08-22', 3, 'Barrio San Miguel, Masaya',         '2026-10-12 11:00:00'),
  (4, 2, 'US-998877665',     'Roberto Stuart',            '8666-5566', '1978-11-03', 4, 'Calle La Calzada, Granada',         '2026-10-15 14:00:00');

INSERT INTO vehiculo (matricula, id_cliente, id_modelo, anio_fabricacion, color, chasis, motor) VALUES
  ('M 111001',  1, 1, 2019, 'Blanco', 'KMHCT4AE0KU111001', 'G4FG-111001'),
  ('M 333003',  1, 3, 2020, 'Rojo',   'KNADN412AL6333003', 'G4LA-333003'),
  ('M 222002',  2, 2, 2022, 'Gris',   'MR0FR22G500222002', '2GD-222002'),
  ('M 555005',  2, 2, 2023, 'Blanco', 'MR0FR22G500555005', '2GD-555005'),
  ('MY 444004', 3, 4, 2021, 'Azul',   'KMHD84LF1MU444004', 'G4FG-444004'),
  ('GR 666006', 4, 5, 2018, 'Negro',  'JTDBR32E900666006', '2ZR-666006');

INSERT INTO vehiculo_aseguradora (matricula, id_aseguradora) VALUES
  ('M 222002',  1),
  ('M 555005',  1),
  ('MY 444004', 2);

INSERT INTO proveedor (id_proveedor, nombre, contacto, emite_factura_iva, fijo) VALUES
  (1, 'Pinturas Sur Nicaragua',           '2255-9900', TRUE,  TRUE),
  (2, 'Repuestos y Lubricantes El Chele', '8765-4321', FALSE, FALSE),
  (3, 'Importadora Automotriz Pinolera',  '2244-1122', TRUE,  TRUE);

INSERT INTO personal (id_personal, nombre, telefono, tipo, fijo, activo) VALUES
  (1, 'Juan Pérez',      '8111-2233', 'interno', TRUE,  TRUE),
  (2, 'Roberto Gómez',   '8444-5566', 'externo', TRUE,  TRUE),
  (3, 'Mario Castellón', '8999-0011', 'externo', FALSE, TRUE),
  (4, 'Denis Rocha',     '8222-3344', 'interno', TRUE,  TRUE);

INSERT INTO personal_especialidad (id_personal, id_especialidad) VALUES
  (1, 1),
  (2, 2),
  (2, 3),
  (3, 1),
  (3, 4),
  (4, 3);

-- ============================================================================
-- 3. INVENTARIO DE MATERIALES, COMPRAS, AJUSTES Y REPUESTOS (6 tablas)
-- Nota: El material #3 queda con stock_actual = 15 (menor al mínimo de 20)
-- para activar la alerta de Stock Bajo en el Dashboard.
-- ============================================================================

INSERT INTO material (id_material, id_proveedor, nombre, precio_unidad, stock_minimo, id_unidad, fecha_expiracion) VALUES
  (1, 1, 'Pintura Bicapa Gris Metálico',   1800.00,  2.00, 1, '2028-12-31'),
  (2, 1, 'Pintura Tricapa Rojo Carmesí',   2100.00,  1.00, 1, '2028-12-31'),
  (3, 1, 'Lija al agua grano 400',           25.00, 20.00, 4, NULL),
  (4, 2, 'Kit de parche y vulcanizado',     120.00,  5.00, 3, '2027-06-30'),
  (5, 3, 'Aceite Sintético 5W-30',          380.00, 10.00, 2, '2029-01-31');

INSERT INTO compra (id_compra, id_proveedor, fecha, monto_subtotal, monto_iva) VALUES
  (1, 1, '2026-10-01', 10200.00, 1530.00),
  (2, 2, '2026-10-05',  1200.00,    0.00),
  (3, 3, '2026-10-12',  5700.00,  855.00);

INSERT INTO compra_detalle (id_compra, id_material, cantidad, costo_unitario) VALUES
  (1, 1,  3.00, 1800.00),
  (1, 2,  2.00, 2100.00),
  (1, 3, 24.00,   25.00),
  (2, 4, 10.00,  120.00),
  (3, 5, 15.00,  380.00);

INSERT INTO ajuste_material (id_ajuste, id_material, cantidad, fecha, id_usuario, nota) VALUES
  (1, 3, -2.00, '2026-10-10 16:00:00', 2, 'Baja de 2 pliegos de lija dañados por humedad en bodega');

INSERT INTO repuesto_taller (id_repuesto, nombre, id_modelo, precio, cantidad_ingresada, id_condicion, fecha_ingreso) VALUES
  (1, 'Válvula reforzada de neumático',               1,  250.00, 10, 1, '2026-10-01'),
  (2, 'Guardafango delantero derecho Hilux original', 2, 3500.00,  2, 1, '2026-10-01'),
  (4, 'Pastillas de freno delanteras Cerámica',       5,  950.00,  6, 1, '2026-10-08'),
  (5, 'Faro delantero izquierdo Elantra usado',       4, 2200.00,  2, 2, '2026-10-10');

INSERT INTO compatibilidad_repuesto (id_repuesto, id_modelo) VALUES
  (1, 1), (1, 3), (1, 4), (1, 5),
  (2, 2),
  (4, 1), (4, 3), (4, 5),
  (5, 4);

-- ============================================================================
-- 4. AGENDA DE CITAS Y PRESUPUESTOS / PROFORMAS (3 tablas)
-- Incluye citas en la semana actual de noviembre 2026 para verlas en Agenda.
-- ============================================================================

INSERT INTO cita (id_cita, matricula, fecha_inicio, fecha_fin, motivo, estado, id_usuario, fecha_creacion) VALUES
  (1, 'M 111001',  '2026-10-19 08:00:00', '2026-10-19 09:00:00', 'Revisión de llanta y válvula por fuga',             'completada', 1, '2026-10-18 10:00:00'),
  (2, 'GR 666006', '2026-11-08 09:00:00', '2026-11-08 11:00:00', 'Revisión preventiva de compresor A/C y correas',    'programada', 1, '2026-11-05 11:00:00'),
  (3, 'M 333003',  '2026-11-09 14:00:00', '2026-11-09 16:00:00', 'Inspección de pulido post-garantía en capó',        'programada', 1, '2026-11-06 09:30:00'),
  (4, 'M 555005',  '2026-11-10 10:00:00', '2026-11-10 12:00:00', 'Inspección conjunta con perito de Seguros LAFISE',  'programada', 2, '2026-11-06 15:00:00');

INSERT INTO presupuesto (id_presupuesto, matricula, fecha, estado, observaciones) VALUES
  (1, 'M 111001',  '2026-10-19', 'aprobado',  'Cliente aprueba reparación de llanta y válvula'),
  (2, 'M 222002',  '2026-10-19', 'aprobado',  'Cotización aprobada conforme avalúo Seguros LAFISE'),
  (3, 'MY 444004', '2026-10-20', 'rechazado', 'Cliente rechazó primer presupuesto de pintura general por monto'),
  (4, 'MY 444004', '2026-10-25', 'aprobado',  'Presupuesto ajustado aprobado con aseguradora INISER'),
  (5, 'GR 666006', '2026-11-05', 'pendiente', 'Cotización de mantenimiento de aire acondicionado pendiente de confirmación');

INSERT INTO presupuesto_detalle (id_presupuesto, num_linea, tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva) VALUES
  (1, 1, 'servicio', 'Desmontaje, vulcanizado y balanceo de llanta', 1.00,   450.00, TRUE),
  (1, 2, 'repuesto', 'Válvula reforzada de neumático',               1.00,   250.00, TRUE),
  (2, 1, 'servicio', 'Enderezado y pintura de costado derecho',      1.00,  8500.00, TRUE),
  (2, 2, 'repuesto', 'Guardafango delantero derecho Hilux',          1.00,  3500.00, TRUE),
  (3, 1, 'servicio', 'Pintura general tricapa Hyundai Elantra',      1.00, 18000.00, TRUE),
  (4, 1, 'servicio', 'Enderezado frontal y cambio de faro Elantra',  1.00,  4800.00, TRUE),
  (4, 2, 'repuesto', 'Faro delantero izquierdo Elantra usado',       1.00,  2200.00, TRUE),
  (5, 1, 'servicio', 'Mantenimiento de compresor y recarga gas A/C', 1.00,  1800.00, TRUE);

-- ============================================================================
-- 5. ÓRDENES DE TRABAJO, GARANTÍAS, SEGUROS Y FACTURAS (21 tablas)
-- ============================================================================

INSERT INTO orden (id_orden, matricula, id_tipo_orden, estado, fecha_ingreso, fecha_entrega_estimada, fecha_entrega_real, id_usuario, fecha_creacion) VALUES
  (1, 'M 333003',  3, 'entregado',  '2026-09-10 08:30:00', '2026-09-14', '2026-09-14', 1, '2026-09-10 08:30:00'),
  (2, 'M 111001',  1, 'entregado',  '2026-10-19 09:00:00', '2026-10-19', '2026-10-19', 1, '2026-10-19 09:00:00'),
  (3, 'M 222002',  2, 'entregado',  '2026-10-19 09:30:00', '2026-10-24', '2026-10-24', 1, '2026-10-19 09:30:00'),
  (4, 'M 333003',  3, 'entregado',  '2026-10-20 10:00:00', '2026-10-22', '2026-10-22', 1, '2026-10-20 10:00:00'),
  (5, 'M 111001',  1, 'en_proceso', '2026-11-02 15:00:00', '2026-11-09', NULL,         1, '2026-11-02 15:00:00'),
  (6, 'MY 444004', 2, 'listo',      '2026-10-28 08:30:00', '2026-11-08', NULL,         1, '2026-10-28 08:30:00'),
  (7, 'GR 666006', 1, 'entregado',  '2026-10-21 10:00:00', '2026-10-23', '2026-10-23', 1, '2026-10-21 10:00:00'),
  (8, 'M 555005',  2, 'recibido',   '2026-11-05 08:00:00', '2026-11-12', NULL,         2, '2026-11-05 08:00:00');

INSERT INTO orden_presupuesto (id_orden, id_presupuesto) VALUES
  (2, 1),
  (3, 2),
  (6, 4);

INSERT INTO orden_seguro (id_orden, id_aseguradora, numero_tramite, numero_orden_seguro, monto_autorizado) VALUES
  (3, 1, 'TRAM-LAF-2026-889', 'OS-LAF-9901', 12000.00),
  (6, 2, 'SIN-INI-2026-441',  'OS-INI-3310',  7000.00),
  (8, 1, 'TRAM-LAF-2026-950', 'OS-LAF-9980', 15000.00);

INSERT INTO orden_servicio (id_orden, num_linea, descripcion, precio, aplica_iva) VALUES
  (1, 1, 'Pintura general de capó en Rojo Carmesí',                   4500.00, TRUE),
  (2, 1, 'Reparación, vulcanizado de llanta e instalación de válvula', 700.00, TRUE),
  (3, 1, 'Enderezado de impacto lateral derecho',                     5000.00, TRUE),
  (3, 2, 'Pintura al horno costado derecho e instalación guardafango',7000.00, TRUE),
  (3, 3, 'Reemplazo de soporte interno (daño oculto aprobado)',       2500.00, TRUE),
  (4, 1, 'Corrección de brillo en capó por reclamo de garantía',         0.00, FALSE),
  (5, 1, 'Cambio de rótula de suspensión delantera (daño particular)',1800.00, FALSE),
  (6, 1, 'Enderezado frontal e instalación de faro izquierdo Elantra',4800.00, TRUE),
  (7, 1, 'Reemplazo de pastillas de freno y rectificación de discos', 2600.00, TRUE),
  (8, 1, 'Avalúo inicial de enderezado en parachoques trasero',       3500.00, TRUE);

INSERT INTO orden_material (id_orden, id_material, cantidad_usada, precio_unitario, fecha_registro, id_usuario) VALUES
  (1, 2, 1.00, 2100.00, '2026-09-11 10:00:00', 1),
  (2, 4, 1.00,  120.00, '2026-10-19 10:30:00', 1),
  (3, 1, 1.00, 1800.00, '2026-10-20 09:00:00', 1),
  (3, 3, 4.00,   25.00, '2026-10-20 09:05:00', 1),
  (4, 2, 0.50, 2100.00, '2026-10-20 14:00:00', 1),
  (6, 3, 3.00,   25.00, '2026-10-29 11:00:00', 1),
  (7, 5, 1.00,  380.00, '2026-10-21 15:00:00', 2);

INSERT INTO orden_repuesto (id_orden, id_repuesto, cantidad_usada, precio_unitario, fecha_registro, id_usuario) VALUES
  (2, 1, 1,  250.00, '2026-10-19 10:40:00', 1),
  (3, 2, 1, 3500.00, '2026-10-20 10:00:00', 1),
  (6, 5, 1, 2200.00, '2026-10-29 15:00:00', 1),
  (7, 4, 1,  950.00, '2026-10-21 12:00:00', 1);

INSERT INTO repuesto_cliente (id_orden, num_item, nombre, id_modelo, cantidad, estado, descripcion) VALUES
  (3, 1, 'Guardafango delantero derecho abollado', 2, 1, 'en_taller', 'Cliente lo cede al taller tras cambio por nuevo'),
  (6, 1, 'Faro izquierdo roto Elantra',            4, 1, 'devuelto',  'Entregado en caja al cliente para respaldo de seguro');

INSERT INTO repuesto_taller (id_repuesto, nombre, id_modelo, precio, cantidad_ingresada, id_condicion, fecha_ingreso) VALUES
  (3, 'Guardafango derecho Hilux (recuperado de cliente)', 2, 1500.00, 1, 4, '2026-10-24');

INSERT INTO compatibilidad_repuesto (id_repuesto, id_modelo) VALUES
  (3, 2);

INSERT INTO transferencia_repuesto (id_orden, num_item, id_repuesto) VALUES
  (3, 1, 3);

INSERT INTO orden_personal (id_orden, id_personal, monto_acordado, fecha_registro) VALUES
  (1, 2, 1500.00, '2026-09-11 09:00:00'),
  (2, 1,  250.00, '2026-10-19 10:15:00'),
  (3, 2, 4200.00, '2026-10-19 11:00:00'),
  (4, 4,  600.00, '2026-10-20 11:30:00'),
  (5, 1,  650.00, '2026-11-02 16:00:00'),
  (6, 2, 2400.00, '2026-10-28 09:30:00'),
  (7, 3,  900.00, '2026-10-21 11:00:00');

INSERT INTO orden_media (id_orden, num_archivo, url, tipo, descripcion, categoria, fecha_subida, id_usuario) VALUES
  (2, 1, '/images/workshop-jae-park.jpg', 'foto',      'Evidencia de recepción en bahía de servicio', 'recepcion',   '2026-10-19 09:05:00', 1),
  (3, 1, '/images/workshop-jae-park.jpg', 'documento', 'Orden de trabajo autorizada por LAFISE',      'seguro',      '2026-10-19 09:35:00', 1),
  (3, 2, '/images/workshop-jae-park.jpg', 'foto',      'Soporte interno fisurado (daño oculto)',      'dano_oculto', '2026-10-20 11:00:00', 1);

-- Garantías y órdenes derivadas (respetando los triggers de exclusividad)
INSERT INTO garantia (id_orden, num_garantia, fecha_vencimiento) VALUES
  (1, 1, '2026-12-14'),
  (2, 1, '2026-11-19'),
  (3, 1, '2027-04-24'),
  (3, 2, '2027-10-24'),
  (7, 1, '2027-01-23');

INSERT INTO garantia_servicio (id_orden, num_garantia, num_linea) VALUES
  (1, 1, 1),
  (2, 1, 1),
  (3, 1, 2);

INSERT INTO garantia_repuesto (id_orden, num_garantia, id_repuesto) VALUES
  (3, 2, 2),
  (7, 1, 4);

INSERT INTO reclamo_garantia (id_orden, id_orden_origen, num_garantia) VALUES
  (4, 1, 1);

INSERT INTO orden_dano_particular (id_orden, id_orden_origen) VALUES
  (5, 2);

-- Daños ocultos de órdenes aseguradas y Linker LAFISE
INSERT INTO dano_oculto (id_orden, num_dano, descripcion, costo_adicional, fecha_reporte) VALUES
  (3, 1, 'Soporte interno de guardafango fisurado tras desmontaje', 2500.00, '2026-10-20 11:15:00'),
  (6, 1, 'Base inferior de radiador doblada detrás de parachoques', 1500.00, '2026-10-30 09:00:00');

INSERT INTO dano_oculto_respuesta (id_orden, num_dano, aprobado, monto_cubierto_seguro, fecha_respuesta) VALUES
  (3, 1, TRUE, 2000.00, '2026-10-21 10:00:00');

INSERT INTO linker_lafise (id_orden, numero_reclamo, numero_orden_compra, estado_ingreso, fecha_ingreso_linker, observaciones) VALUES
  (3, 'REC-LAF-2026-554', 'OC-LAF-7788', 'confirmado', '2026-10-21 10:30:00', 'Ampliación por daño oculto confirmada en portal'),
  (8, 'REC-LAF-2026-610', NULL,          'pendiente',  NULL,                  'Recién ingresado, en espera de orden de compra LAFISE');

-- Facturación Legal (Cliente XOR Seguro)
INSERT INTO factura (numero_factura, fecha_emision, subtotal, iva) VALUES
  ('FAC-0001',     '2026-10-19',  1070.00,  105.00),
  ('FAC-SEG-0003', '2026-10-24', 14000.00, 2100.00),
  ('FAC-0004',     '2026-10-23',  3930.00,  390.00),
  ('FAC-SEG-0006', '2026-11-05',  6355.00,  612.00);

INSERT INTO factura_cliente (numero_factura, id_orden) VALUES
  ('FAC-0001', 2),
  ('FAC-0004', 7);

INSERT INTO factura_seguro (numero_factura, id_orden) VALUES
  ('FAC-SEG-0003', 3),
  ('FAC-SEG-0006', 6);

-- ============================================================================
-- 6. PAGOS, LIQUIDACIONES Y AUDITORÍA (5 tablas)
-- ============================================================================

INSERT INTO pago_cliente (id_orden, num_pago, monto, fecha, id_metodo, numero_recibo, id_usuario) VALUES
  (1, 1, 5175.00, '2026-09-14 16:00:00', 2, 'REC-00100', 1),
  (2, 1, 1175.00, '2026-10-19 16:00:00', 3, 'REC-00101', 1),
  (7, 1, 1500.00, '2026-10-21 10:15:00', 1, 'REC-00102', 1),
  (7, 2, 1500.00, '2026-10-22 14:00:00', 2, 'REC-00103', 1),
  (7, 3, 1320.00, '2026-10-23 17:00:00', 3, 'REC-00104', 1),
  (5, 1,  600.00, '2026-11-02 15:30:00', 1, 'REC-00105', 1);

INSERT INTO pago_seguro (id_orden, num_pago, monto, fecha_recibido, referencia_bancaria, concepto) VALUES
  (3, 1, 13800.00, '2026-10-25', 'TRF-LAFISE-998811', 'pago_principal'),
  (3, 2,  2300.00, '2026-10-26', 'TRF-LAFISE-998899', 'dano_oculto');

INSERT INTO liquidacion (id_liquidacion, id_personal, fecha, fecha_pago) VALUES
  (1, 2, '2026-10-25', '2026-10-26'),
  (2, 1, '2026-11-05', NULL),
  (3, 3, '2026-11-05', NULL);

INSERT INTO liquidacion_detalle (id_orden, id_personal, id_liquidacion) VALUES
  (1, 2, 1),
  (3, 2, 1),
  (2, 1, 2),
  (7, 3, 3);

INSERT INTO auditoria (id_auditoria, id_usuario, tabla, id_registro, accion, fecha_hora, detalle) VALUES
  (1, 1, 'orden',       '3',            'crear',         '2026-10-19 09:30:00', 'Apertura de orden con seguro LAFISE para Hilux M 222002'),
  (2, 2, 'liquidacion', '1',            'cambio_estado', '2026-10-26 17:00:00', 'Liquidación #1 de Roberto Gómez pagada'),
  (3, 1, 'factura',     'FAC-SEG-0006', 'crear',         '2026-11-05 16:00:00', 'Emisión de factura de seguro INISER para Elantra MY 444004'),
  (4, 2, 'orden',       '8',            'crear',         '2026-11-05 08:00:00', 'Recepción de Hilux Blanca M 555005 de Distribuidora El Sol');