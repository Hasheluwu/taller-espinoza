// backend/src/routes/debug.js
// ─── SOLO PARA DESARROLLO — quitar este router en producción ─────────────────
const express = require('express')
const pool    = require('../db')

const router = express.Router()

// POST /api/debug/reset-db
// Limpia todas las tablas y recarga los datos de prueba del seed.
router.post('/reset-db', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // ── 1. Deshabilitar FK checks para poder truncar en cualquier orden ──────
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')

    const tablas = [
      'auditoria',
      'liquidacion_detalle',
      'liquidacion_personal',
      'linker_lafise',
      'pago_seguro',
      'pago_cliente',
      'orden_dano_oculto',
      'orden_media',
      'orden_personal',
      'orden_repuesto',
      'orden_material',
      'orden_servicio',
      'repuesto_cliente',
      'movimiento_inventario',
      'compra_inventario',
      'orden',
      'presupuesto_detalle',
      'presupuesto',
      'repuesto_taller',
      'inventario',
      'personal',
      'vehiculo',
      'cliente',
      'proveedor',
      'usuario',
    ]

    for (const tabla of tablas) {
      await conn.query(`TRUNCATE TABLE \`${tabla}\``)
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1')

    // ── 2. Usuario inicial ────────────────────────────────────────────────────
    // Hash de bcrypt para la contraseña "admin1234" — cambiar en producción
    await conn.query(`
      INSERT INTO usuario (id, nombre, email, password_hash, rol, activo) VALUES
      (1, 'Administrador', 'admin@tallerespinoza.com',
       '$2b$10$placeholderHashCambiarEnProduccion', 'administrador', TRUE)
    `)

    // ── 3. Proveedores ────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO proveedor (id, nombre, contacto, emite_factura_iva, fijo) VALUES
      (1, 'Pinturas El Maestro',     '2265-1234', TRUE,  TRUE),
      (2, 'Distribuidora AutoParts', '8888-9999', FALSE, TRUE),
      (3, 'Ferretería Central',      '2270-4567', TRUE,  TRUE),
      (4, 'Repuestos La Nacional',   '2270-8888', TRUE,  TRUE),
      (5, 'AutoZone Nicaragua',      '2265-5555', TRUE,  FALSE)
    `)

    // ── 4. Inventario ─────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO inventario (id, id_proveedor, nombre, precio_unidad, cantidad, stock_minimo, unidad_medida, fecha_expiracion) VALUES
      ( 1, 1, 'Pintura base blanca',        350.00, 20.00, 5.00,  'galon',  '2027-01-01'),
      ( 2, 1, 'Pintura base negra',         350.00, 15.00, 5.00,  'galon',  '2027-01-01'),
      ( 3, 1, 'Barniz transparente',        420.00, 10.00, 3.00,  'galon',  '2026-12-01'),
      ( 4, 1, 'Solvente mineral',           180.00, 25.00, 8.00,  'litro',  NULL),
      ( 5, 1, 'Thinner estándar',           160.00, 30.00, 10.00, 'litro',  NULL),
      ( 6, 3, 'Lija grano 120',              15.00,100.00, 20.00, 'unidad', NULL),
      ( 7, 3, 'Lija grano 220',              18.00, 80.00, 20.00, 'unidad', NULL),
      ( 8, 3, 'Lija grano 400',             22.00,  60.00, 15.00, 'unidad', NULL),
      ( 9, 3, 'Masilla plástica',            95.00, 40.00, 10.00, 'unidad', '2026-11-01'),
      (10, 3, 'Cinta de enmascarar 2"',      45.00, 50.00, 10.00, 'unidad', NULL),
      (11, 3, 'Aceite de motor 15W-40',     280.00, 20.00,  5.00, 'litro',  NULL),
      (12, 3, 'Líquido de frenos DOT4',     120.00,  2.00,  3.00, 'litro',  '2027-06-01'),
      (13, 2, 'Filtro de aceite universal', 185.00, 12.00,  4.00, 'unidad', NULL),
      (14, 2, 'Filtro de aire estándar',    220.00,  8.00,  3.00, 'unidad', NULL),
      (15, 3, 'Silicona negra selladora',    85.00, 20.00,  5.00, 'unidad', '2027-03-01'),
      (16, 1, 'Pintura roja carmín',        370.00,  8.00,  3.00, 'galon',  '2027-01-01'),
      (17, 1, 'Pintura azul marino',        370.00,  6.00,  3.00, 'galon',  '2027-01-01'),
      (18, 3, 'Sellador de juntas',          65.00, 15.00,  5.00, 'unidad', '2027-06-01'),
      (19, 2, 'Correa de distribución',     450.00,  4.00,  2.00, 'unidad', NULL),
      (20, 2, 'Pastillas de freno delant.', 380.00,  3.00,  2.00, 'unidad', NULL)
    `)

    // ── 5. Repuestos del taller ───────────────────────────────────────────────
    await conn.query(`
      INSERT INTO repuesto_taller (id, nombre, marca, modelo, modelo_compatible, precio, cantidad, estado, origen, fecha_ingreso) VALUES
      ( 1, 'Bumper delantero',       'Toyota',    'Corolla',      '2015-2020', 2500.00, 2, 'usado_bueno',   'comprado',               '2025-01-10'),
      ( 2, 'Bumper trasero',         'Toyota',    'Corolla',      '2015-2020', 2200.00, 1, 'usado_regular', 'comprado',               '2025-02-05'),
      ( 3, 'Puerta delantera izq',   'Hyundai',   'Tucson',       '2018-2022', 4500.00, 1, 'nuevo',         'comprado',               '2025-03-15'),
      ( 4, 'Capó',                   'Nissan',    'Sentra',       '2019-2023', 3800.00, 1, 'usado_bueno',   'proveniente_de_cliente', '2025-04-20'),
      ( 5, 'Guardafango delantero',  'Toyota',    'RAV4',         '2016-2021', 1800.00, 3, 'nuevo',         'comprado',               '2025-05-01'),
      ( 6, 'Espejo retrovisor izq',  'Honda',     'Civic',        '2020-2024',  950.00, 2, 'nuevo',         'comprado',               '2025-06-10'),
      ( 7, 'Parabrisas delantero',   'Toyota',    'Hilux',        '2018-2023', 6500.00, 1, 'nuevo',         'comprado',               '2025-07-15'),
      ( 8, 'Faro delantero izq',     'Kia',       'Sportage',     '2019-2022', 2100.00, 2, 'usado_bueno',   'comprado',               '2025-08-01'),
      ( 9, 'Radiador',               'Honda',     'CR-V',         '2017-2021', 3200.00, 1, 'para_reparar',  'proveniente_de_cliente', '2025-09-05'),
      (10, 'Llanta 195/65 R15',      'General',   'Altimax RT',   NULL,         850.00, 4, 'nuevo',         'comprado',               '2025-10-01'),
      (11, 'Puerta trasera der',      'Toyota',   'Hilux',        '2018-2023', 5200.00, 1, 'usado_bueno',   'comprado',               '2025-11-01'),
      (12, 'Amortiguador delant der', 'KYB',      'Universal',    NULL,        1200.00, 2, 'nuevo',         'comprado',               '2025-11-15'),
      (13, 'Faro trasero der',        'Hyundai',  'Tucson',       '2018-2022',  980.00, 1, 'usado_bueno',   'proveniente_de_cliente', '2025-12-01'),
      (14, 'Bumper delantero',        'Kia',      'Sportage',     '2019-2022', 2800.00, 1, 'nuevo',         'comprado',               '2026-01-10'),
      (15, 'Capó',                   'Chevrolet', 'Spark',        '2015-2020', 2100.00, 1, 'usado_regular', 'proveniente_de_cliente', '2026-02-05')
    `)

    // ── 6. Personal ───────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO personal (id, nombre, tipo, rol, telefono, fijo) VALUES
      (1, 'Carlos Mendoza', 'externo', 'pintor',      '8123-4567', TRUE),
      (2, 'Jorge Ruiz',     'externo', 'enderezador', '8234-5678', TRUE),
      (3, 'Pedro Espinoza', 'interno', 'mecanico',    '8345-6789', TRUE),
      (4, 'Luis Hernández', 'externo', 'pintor',      '8456-7890', FALSE),
      (5, 'Mario González', 'interno', 'otro',        '8567-8901', FALSE)
    `)

    // ── 7. Clientes ───────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO cliente (id, nombre, cedula, telefono, fecha_nacimiento, municipio_residencia, direccion, fecha_creacion) VALUES
      ( 1, 'Juan Carlos Martínez',    '001-010185-0001A', '8111-2233', '1985-01-01', 'Managua',    'Bo. Las Brisas, casa #14',          '2024-01-15 09:00:00'),
      ( 2, 'María López García',      '001-220390-0002B', '8222-3344', '1990-03-22', 'Managua',    'Reparto San Juan, semáforos 1c N',  '2024-02-03 10:30:00'),
      ( 3, 'Roberto Pérez Sánchez',   '001-151275-0003C', '8333-4455', '1975-12-15', 'Masaya',     'Bo. Monimbó, frente a la iglesia',  '2024-03-10 08:00:00'),
      ( 4, 'Ana Sofía Ruiz',          '001-050888-0004D', '8444-5566', '1988-08-05', 'Granada',    'Col. Xalteva, casa esquinera',      '2024-04-22 14:00:00'),
      ( 5, 'Pedro Hernández López',   '001-300692-0005E', '8555-6677', '1992-06-30', 'León',       'Bo. Sutiaba, del mercado 2c O',     '2024-05-18 11:00:00'),
      ( 6, 'Lucía González Torres',   '001-120979-0006F', '8666-7788', '1979-09-12', 'Managua',    'Km 10 Carretera Norte, casa azul',  '2024-06-05 09:30:00'),
      ( 7, 'Carlos Morales Castillo', '001-250283-0007G', '8777-8899', '1983-02-25', 'Chinandega', 'Calle Central, frente al parque',   '2024-07-14 16:00:00'),
      ( 8, 'Patricia Díaz Méndez',    '001-180595-0008H', '8888-9900', '1995-05-18', 'Estelí',     'Col. 16 de Julio, casa #8',         '2024-08-20 10:00:00'),
      ( 9, 'Diego Ramírez Vega',      '001-040187-0009I', '8999-0011', '1987-01-04', 'Matagalpa',  'Bo. Guanuca, 1c al lago',           '2024-09-01 08:30:00'),
      (10, 'Sofía Castillo Rojas',    '001-270993-0010J', '8100-1122', '1993-09-27', 'Managua',    'Residencial Bolonia, casa #22',     '2024-10-11 13:00:00')
    `)

    // ── 8. Vehículos ──────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO vehiculo (id, id_cliente, matricula, marca, modelo, anio_fabricacion, aseguradora, color, chasis, motor) VALUES
      ( 1,  1, 'M-123456', 'Toyota',     'Corolla',      2018, 'ninguna', 'Blanco',   'JT2BF22K1W0123456', 'JT2BF22K1'),
      ( 2,  2, 'N-234567', 'Hyundai',    'Tucson',       2020, 'lafise',  'Gris',     'KMHD74LF5LU234567', 'KMHD74LF5'),
      ( 3,  3, 'M-345678', 'Nissan',     'Sentra',       2019, 'iniser',  'Negro',    '3N1AB7AP5KL345678', '3N1AB7AP5'),
      ( 4,  4, 'G-456789', 'Honda',      'CR-V',         2021, 'ninguna', 'Azul',     '2HKRW2H87MH456789', '2HKRW2H87'),
      ( 5,  5, 'L-567890', 'Kia',        'Sportage',     2017, 'lafise',  'Rojo',     'KNDPC3AC5H7567890', 'KNDPC3AC5'),
      ( 6,  6, 'M-678901', 'Toyota',     'RAV4',         2022, 'ninguna', 'Plata',    'JTMRFREV2ND678901', 'JTMRFREV2'),
      ( 7,  7, 'C-789012', 'Chevrolet',  'Spark',        2016, 'iniser',  'Amarillo', 'KL8CB6SA9GC789012', 'KL8CB6SA9'),
      ( 8,  8, 'E-890123', 'Mitsubishi', 'L200',         2020, 'ninguna', 'Blanco',   'MMBJNKB40JH890123', 'MMBJNKB40'),
      ( 9,  9, 'R-901234', 'Ford',       'Ranger',       2019, 'lafise',  'Verde',    '1FTER4EH5KLA01234', '1FTER4EH5'),
      (10, 10, 'M-012345', 'Mazda',      'CX-5',         2023, 'ninguna', 'Café',     'JM3KFBDM4P0012345', 'JM3KFBDM4'),
      (11,  1, 'M-111222', 'Honda',      'Civic',        2020, 'lafise',  'Rojo',     'JHMFC1F37MS111222', 'JHMFC1F37'),
      (12,  2, 'N-333444', 'Toyota',     'Hilux',        2021, 'ninguna', 'Negro',    'MR0GX32G90K333444', 'MR0GX32G9'),
      (13,  3, 'M-555666', 'Suzuki',     'Grand Vitara', 2018, 'iniser',  'Gris',     'JS3TD0D13J4555666', 'JS3TD0D13')
    `)

    // ── 9. Presupuestos ───────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO presupuesto (id, id_vehiculo, fecha, estado, subtotal, iva, total, observaciones) VALUES
      ( 1,  1, '2026-01-10', 'aprobado',  15000.00, 2250.00, 17250.00, 'Pintura completa y enderezado lateral'),
      ( 2,  1, '2026-03-15', 'pendiente',  8500.00, 1275.00,  9775.00, 'Cambio de aceite y filtros, revisión general'),
      ( 3,  2, '2026-02-01', 'aprobado',  22000.00, 3300.00, 25300.00, 'Reparación post-choque frontal, seguro LAFISE'),
      ( 4,  2, '2026-04-20', 'rechazado',  5000.00,  750.00,  5750.00, 'Revisión de suspensión — cliente rechazó'),
      ( 5,  3, '2026-02-20', 'aprobado',  18000.00, 2700.00, 20700.00, 'Choque trasero, reparación y pintura, INISER'),
      ( 6,  3, '2026-05-10', 'pendiente',  3500.00,  525.00,  4025.00, 'Cambio de pastillas de freno'),
      ( 7,  4, '2026-03-05', 'aprobado',  12000.00, 1800.00, 13800.00, 'Pintura de capó y guardafangos'),
      ( 8,  4, '2026-06-01', 'pendiente',  4200.00,  630.00,  4830.00, 'Mantenimiento preventivo 50,000 km'),
      ( 9,  5, '2026-04-10', 'aprobado',  30000.00, 4500.00, 34500.00, 'Daños severos por colisión, LAFISE cubre parcial'),
      (10,  5, '2026-07-15', 'pendiente',  6500.00,  975.00,  7475.00, 'Pintura de rines y retoque lateral'),
      (11,  6, '2026-05-20', 'aprobado',   9500.00, 1425.00, 10925.00, 'Pintura parcial techo y maletero'),
      (12,  7, '2026-06-08', 'aprobado',   7200.00, 1080.00,  8280.00, 'Enderezado de puerta delantera izquierda'),
      (13,  8, '2026-07-01', 'aprobado',  14000.00, 2100.00, 16100.00, 'Revisión mecánica completa y cambio de correa'),
      (14,  9, '2026-07-20', 'aprobado',  25000.00, 3750.00, 28750.00, 'Choque frontal con daños en capó y faroles, LAFISE'),
      (15, 10, '2026-08-05', 'pendiente',  5500.00,  825.00,  6325.00, 'Pulido y encerado completo')
    `)

    // ── 10. Presupuesto detalles ──────────────────────────────────────────────
    await conn.query(`
      INSERT INTO presupuesto_detalle (id, id_presupuesto, tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva) VALUES
      ( 1, 1, 'servicio',  'Pintura completa carrocería',         1, 10000.00, TRUE),
      ( 2, 1, 'servicio',  'Enderezado lateral derecho',          1,  3000.00, TRUE),
      ( 3, 1, 'material',  'Pintura base blanca (3 galones)',     3,   350.00, TRUE),
      ( 4, 1, 'material',  'Barniz transparente (2 galones)',     2,   420.00, TRUE),
      ( 5, 1, 'repuesto',  'Guardafango delantero Toyota RAV4',   1,  1800.00, FALSE),
      ( 6, 2, 'servicio',  'Cambio de aceite y filtro',           1,  1500.00, TRUE),
      ( 7, 2, 'material',  'Aceite de motor 15W-40 (4 litros)',   4,   280.00, TRUE),
      ( 8, 2, 'repuesto',  'Filtro de aceite universal',          1,   185.00, FALSE),
      ( 9, 2, 'repuesto',  'Filtro de aire estándar',             1,   220.00, FALSE),
      (10, 3, 'servicio',  'Reparación bumper frontal',           1,  8000.00, TRUE),
      (11, 3, 'servicio',  'Pintura frontal completa',            1,  7000.00, TRUE),
      (12, 3, 'repuesto',  'Bumper delantero Toyota Corolla',     1,  2500.00, FALSE),
      (13, 3, 'material',  'Pintura base gris (2 galones)',       2,   350.00, TRUE),
      (14, 3, 'material',  'Barniz transparente (1 galón)',       1,   420.00, TRUE),
      (15, 5, 'servicio',  'Reparación choque trasero completo',  1, 10000.00, TRUE),
      (16, 5, 'servicio',  'Pintura trasera y lateral',           1,  5000.00, TRUE),
      (17, 5, 'repuesto',  'Bumper trasero Toyota Corolla',       1,  2200.00, FALSE),
      (18, 5, 'material',  'Pintura base negra (2 galones)',      2,   350.00, TRUE),
      (19, 9, 'servicio',  'Reparación estructural colisión',     1, 15000.00, TRUE),
      (20, 9, 'servicio',  'Pintura completa carrocería',         1,  8000.00, TRUE),
      (21, 9, 'repuesto',  'Faro delantero izq Kia Sportage',     1,  2100.00, FALSE),
      (22, 9, 'material',  'Pintura roja carmín (3 galones)',     3,   370.00, TRUE)
    `)

    // ── 11. Órdenes ───────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO orden (id, id_vehiculo, id_presupuesto, id_orden_origen, tipo, fecha_ingreso, fecha_entrega_estimada, fecha_entrega_real, estado, es_garantia, fecha_vencimiento_garantia, tipo_pago, subtotal, iva, costo_total, monto_seguro, monto_cliente, numero_tramite, numero_orden_seguro, numero_factura_fisica, obra_externa, obra_interna, danos_ocultos, fecha_creacion, creado_por) VALUES
      ( 1,  1,  1, NULL, 'pintura',       '2026-01-15 08:30:00', '2026-01-25', '2026-01-24', 'entregado',  FALSE, NULL,         'particular', 15000.00, 2250.00, 17250.00,     NULL,     NULL, NULL,          NULL,          '5001', TRUE,  FALSE, FALSE, '2026-01-15 08:30:00', 1),
      ( 2,  2,  3, NULL, 'pintura',       '2026-02-05 09:00:00', '2026-02-20', NULL,         'listo',      FALSE, NULL,         'lafise',     22000.00, 3300.00, 25300.00, 22000.00,     0.00, 'TRM-423686',  'ORD-400542',  NULL,   TRUE,  FALSE, FALSE, '2026-02-05 09:00:00', 1),
      ( 3,  3,  5, NULL, 'pintura',       '2026-02-25 10:00:00', '2026-03-10', '2026-03-09', 'entregado',  TRUE,  '2026-04-09', 'iniser',     18000.00, 2700.00, 20700.00, 15000.00,  5700.00, 'TRM-INS-001', 'ORD-INS-001', '5002', TRUE,  FALSE, FALSE, '2026-02-25 10:00:00', 1),
      ( 4,  4,  7, NULL, 'pintura',       '2026-03-10 11:00:00', '2026-03-20', NULL,         'en_proceso', FALSE, NULL,         'particular', 12000.00, 1800.00, 13800.00,     NULL,     NULL, NULL,          NULL,          NULL,   TRUE,  FALSE, FALSE, '2026-03-10 11:00:00', 1),
      ( 5,  5,  9, NULL, 'pintura',       '2026-04-15 08:00:00', '2026-05-05', NULL,         'en_proceso', FALSE, NULL,         'lafise',     30000.00, 4500.00, 34500.00, 25000.00,  9500.00, 'TRM-567890',  'ORD-567890',  NULL,   TRUE,  FALSE, TRUE,  '2026-04-15 08:00:00', 1),
      ( 6,  6, 11, NULL, 'pintura',       '2026-05-22 14:00:00', '2026-06-01', NULL,         'recibido',   FALSE, NULL,         'particular',  9500.00, 1425.00, 10925.00,     NULL,     NULL, NULL,          NULL,          NULL,   TRUE,  FALSE, FALSE, '2026-05-22 14:00:00', 1),
      ( 7,  7, 12, NULL, 'mecanica',      '2026-06-10 09:30:00', '2026-06-18', NULL,         'en_proceso', FALSE, NULL,         'iniser',      7200.00, 1080.00,  8280.00,  7200.00,  1080.00, 'TRM-INS-002', 'ORD-INS-002', NULL,   FALSE, TRUE,  FALSE, '2026-06-10 09:30:00', 1),
      ( 8,  8, 13, NULL, 'mantenimiento', '2026-07-05 08:00:00', '2026-07-10', NULL,         'listo',      FALSE, NULL,         'particular', 14000.00, 2100.00, 16100.00,     NULL,     NULL, NULL,          NULL,          NULL,   FALSE, TRUE,  FALSE, '2026-07-05 08:00:00', 1),
      ( 9,  9, 14, NULL, 'pintura',       '2026-07-25 10:00:00', '2026-08-10', NULL,         'recibido',   FALSE, NULL,         'lafise',     25000.00, 3750.00, 28750.00, 25000.00,  3750.00, 'TRM-901234',  'ORD-901234',  NULL,   TRUE,  FALSE, FALSE, '2026-07-25 10:00:00', 1),
      (10, 10, NULL, NULL,'mantenimiento','2026-08-10 09:00:00', '2026-08-15', NULL,          'recibido',   FALSE, NULL,         'particular',  5500.00,  825.00,  6325.00,     NULL,     NULL, NULL,          NULL,          NULL,   FALSE, TRUE,  FALSE, '2026-08-10 09:00:00', 1),
      (11, 11, NULL, 1,   'pintura',      '2026-02-10 08:00:00', '2026-02-15', '2026-02-14', 'entregado',  TRUE,  '2026-03-24', 'particular',  3000.00,  450.00,  3450.00,     NULL,     NULL, NULL,          NULL,          '5003', TRUE,  FALSE, FALSE, '2026-02-10 08:00:00', 1),
      (12, 12, NULL, NULL,'mantenimiento','2026-05-15 11:00:00', '2026-05-20', '2026-05-19', 'entregado',  FALSE, NULL,         'particular',  8500.00, 1275.00,  9775.00,     NULL,     NULL, NULL,          NULL,          '5004', FALSE, TRUE,  FALSE, '2026-05-15 11:00:00', 1),
      (13, 13, NULL, NULL,'pintura',      '2026-06-01 14:00:00', '2026-06-15', NULL,         'cancelado',  FALSE, NULL,         'iniser',     11000.00, 1650.00, 12650.00, 11000.00,  1650.00, 'TRM-INS-003', NULL,          NULL,   TRUE,  FALSE, FALSE, '2026-06-01 14:00:00', 1)
    `)

    // ── 12. FK diferida: movimiento_inventario → orden (ya existe, solo hay que insertar ahora) ─
    // ── 13. Servicios de orden ────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO orden_servicio (id, id_orden, descripcion, precio, aplica_iva) VALUES
      ( 1, 1, 'Pintura completa carrocería exterior',   10000.00, TRUE),
      ( 2, 1, 'Enderezado lateral derecho',              3000.00, TRUE),
      ( 3, 1, 'Pulido y encerado final',                 2000.00, TRUE),
      ( 4, 2, 'Reparación bumper frontal',               8000.00, TRUE),
      ( 5, 2, 'Pintura frontal y laterales',             7000.00, TRUE),
      ( 6, 2, 'Instalación bumper nuevo',                3000.00, TRUE),
      ( 7, 2, 'Alineación y balanceo post-reparación',   2000.00, TRUE),
      ( 8, 3, 'Reparación choque trasero',              10000.00, TRUE),
      ( 9, 3, 'Pintura trasera y lateral izquierdo',     5000.00, TRUE),
      (10, 3, 'Instalación bumper trasero',              2000.00, TRUE),
      (11, 4, 'Pintura de capó',                         4000.00, TRUE),
      (12, 4, 'Pintura de guardafangos delanteros',       4000.00, TRUE),
      (13, 4, 'Preparación y lijado de superficie',       2000.00, TRUE),
      (14, 5, 'Reparación estructural post-colisión',   15000.00, TRUE),
      (15, 5, 'Pintura completa carrocería',             8000.00, TRUE),
      (16, 5, 'Instalación faro delantero',              2000.00, TRUE),
      (17, 6, 'Pintura de techo y maletero',             6000.00, TRUE),
      (18, 6, 'Preparación y lijado',                    2000.00, TRUE),
      (19, 6, 'Barnizado final',                         1500.00, TRUE),
      (20, 7, 'Enderezado de puerta delantera izq',      4000.00, TRUE),
      (21, 7, 'Pintura de puerta',                       2000.00, TRUE),
      (22, 8, 'Cambio de aceite y filtros',              2000.00, TRUE),
      (23, 8, 'Cambio de correa de distribución',        5000.00, TRUE),
      (24, 8, 'Revisión y cambio de pastillas de freno', 3500.00, TRUE),
      (25, 8, 'Revisión general de motor',               3000.00, TRUE),
      (26, 9, 'Reparación capó y estructura frontal',   12000.00, TRUE),
      (27, 9, 'Pintura frontal',                         7000.00, TRUE),
      (28, 9, 'Instalación de faroles',                  3000.00, TRUE),
      (29,10, 'Pulido y encerado completo',              3000.00, TRUE),
      (30,10, 'Revisión de niveles y ajuste general',    1500.00, TRUE),
      (31,11, 'Retoque de pintura por garantía',         2500.00, TRUE),
      (32,11, 'Corrección de bordes y detalles',          500.00, TRUE),
      (33,12, 'Cambio de aceite y filtro de aceite',     2000.00, TRUE),
      (34,12, 'Cambio de filtro de aire',                 800.00, TRUE),
      (35,12, 'Revisión de frenos y líquidos',           3000.00, TRUE),
      (36,12, 'Limpieza de inyectores',                  2700.00, TRUE)
    `)

    // ── 14. Repuestos del cliente ─────────────────────────────────────────────
    await conn.query(`
      INSERT INTO repuesto_cliente (id, id_orden, nombre, marca, modelo, cantidad, estado, descripcion) VALUES
      (1, 2, 'Bumper delantero original', 'Hyundai',   'Tucson',   1, 'en_taller',            'Bumper dañado por choque, queda en taller para evaluación'),
      (2, 3, 'Bumper trasero original',   'Nissan',    'Sentra',   1, 'transferido_a_taller', 'Se quedó en taller — reutilizable con reparación'),
      (3, 5, 'Faro delantero izquierdo',  'Kia',       'Sportage', 1, 'devuelto',             'Devuelto al cliente — no tenía reparación posible'),
      (4, 7, 'Moldura de puerta',         'Chevrolet', 'Spark',    1, 'en_taller',            'Moldura decorativa, posible reutilización'),
      (5, 9, 'Capó original',             'Ford',      'Ranger',   1, 'en_taller',            'Capó con daño severo, pendiente evaluación')
    `)

    // ── 15. Materiales usados en órdenes ──────────────────────────────────────
    await conn.query(`
      INSERT INTO orden_material (id, id_orden, id_material, cantidad_usada, precio_unitario, registrado_por) VALUES
      ( 1, 1,  1,  3.00, 350.00, 1),
      ( 2, 1,  3,  2.00, 420.00, 1),
      ( 3, 1,  4,  2.00, 180.00, 1),
      ( 4, 1,  6, 20.00,  15.00, 1),
      ( 5, 1,  7, 15.00,  18.00, 1),
      ( 6, 2,  2,  2.00, 350.00, 1),
      ( 7, 2,  3,  1.00, 420.00, 1),
      ( 8, 2,  4,  1.50, 180.00, 1),
      ( 9, 2,  9,  2.00,  95.00, 1),
      (10, 2,  6, 15.00,  15.00, 1),
      (11, 3,  2,  2.00, 350.00, 1),
      (12, 3,  3,  1.00, 420.00, 1),
      (13, 3,  9,  1.00,  95.00, 1),
      (14, 3,  6, 10.00,  15.00, 1),
      (15, 4,  1,  2.00, 350.00, 1),
      (16, 4,  3,  1.00, 420.00, 1),
      (17, 4,  8, 10.00,  22.00, 1),
      (18, 5, 16,  3.00, 370.00, 1),
      (19, 5,  3,  2.00, 420.00, 1),
      (20, 5,  9,  3.00,  95.00, 1),
      (21, 5,  4,  2.00, 180.00, 1),
      (22, 7, 17,  1.00, 370.00, 1),
      (23, 7,  3,  1.00, 420.00, 1),
      (24, 8, 11,  4.00, 280.00, 1),
      (25, 8, 12,  1.00, 120.00, 1),
      (26, 8, 19,  1.00, 450.00, 1),
      (27, 8, 20,  1.00, 380.00, 1),
      (28,11,  1,  1.00, 350.00, 1),
      (29,11,  3,  0.50, 420.00, 1),
      (30,12, 11,  4.00, 280.00, 1),
      (31,12, 13,  1.00, 185.00, 1),
      (32,12, 14,  1.00, 220.00, 1)
    `)

    // ── 16. Repuestos del taller usados en órdenes ────────────────────────────
    await conn.query(`
      INSERT INTO orden_repuesto (id, id_orden, id_repuesto, cantidad_usada, precio_unitario, registrado_por) VALUES
      (1, 2, 1, 1, 2500.00, 1),
      (2, 3, 2, 1, 2200.00, 1),
      (3, 5, 8, 1, 2100.00, 1),
      (4, 7, 3, 1, 4500.00, 1),
      (5, 8,12, 2, 1200.00, 1),
      (6, 9, 4, 1, 3800.00, 1),
      (7, 1, 5, 1, 1800.00, 1),
      (8,12, 6, 1,  950.00, 1)
    `)

    // ── 17. Personal asignado a órdenes ───────────────────────────────────────
    await conn.query(`
      INSERT INTO orden_personal (id, id_orden, id_personal, monto_acordado) VALUES
      ( 1, 1, 1, 4000.00),
      ( 2, 1, 2, 2500.00),
      ( 3, 2, 1, 5000.00),
      ( 4, 2, 2, 3000.00),
      ( 5, 3, 1, 4000.00),
      ( 6, 3, 2, 2000.00),
      ( 7, 4, 1, 3000.00),
      ( 8, 5, 4, 6000.00),
      ( 9, 5, 2, 4000.00),
      (10, 6, 1, 2500.00),
      (11, 7, 2, 2000.00),
      (12, 8, 3, 3500.00),
      (13, 8, 5, 1500.00),
      (14, 9, 1, 5000.00),
      (15, 9, 2, 3000.00),
      (16,10, 3, 1500.00),
      (17,11, 1,  800.00),
      (18,12, 3, 2000.00)
    `)

    // ── 18. Daños ocultos ─────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO orden_dano_oculto (id, id_orden, descripcion, costo_adicional, aplica_seguro, monto_cubierto_seguro, monto_extra_cliente, estado_aprobacion, fecha_reporte, fecha_respuesta) VALUES
      (1, 5, 'Daño en piso de baúl no visible en inspección inicial', 3500.00, TRUE,  3500.00,    0.00, 'aprobado',  '2026-04-20 11:00:00', '2026-04-22 14:00:00'),
      (2, 5, 'Rotura de soporte de radiador por impacto',             2200.00, TRUE,  2200.00,    0.00, 'aprobado',  '2026-04-23 09:00:00', '2026-04-24 10:30:00'),
      (3, 5, 'Daño en manguera de dirección hidráulica',              1800.00, FALSE,    0.00, 1800.00, 'rechazado', '2026-04-25 10:00:00', '2026-04-26 09:00:00')
    `)

    // ── 19. Pagos del cliente ─────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO pago_cliente (id, id_orden, monto, fecha, tipo, metodo, numero_recibo, registrado_por) VALUES
      ( 1, 1,  8625.00, '2026-01-15 09:00:00', 'adelanto', 'efectivo',     'REC-001', 1),
      ( 2, 1,  8625.00, '2026-01-24 16:00:00', 'saldo',    'transferencia','REC-002', 1),
      ( 3, 3,  2850.00, '2026-02-25 10:30:00', 'adelanto', 'efectivo',     'REC-003', 1),
      ( 4, 3,  2850.00, '2026-03-09 15:00:00', 'saldo',    'efectivo',     'REC-004', 1),
      ( 5, 4,  6900.00, '2026-03-10 12:00:00', 'adelanto', 'transferencia','REC-005', 1),
      ( 6, 5,  4750.00, '2026-04-15 09:00:00', 'adelanto', 'efectivo',     'REC-006', 1),
      ( 7, 6,  5462.50, '2026-05-22 15:00:00', 'adelanto', 'transferencia','REC-007', 1),
      ( 8, 8,  8050.00, '2026-07-05 08:30:00', 'adelanto', 'efectivo',     'REC-008', 1),
      ( 9,10,  3162.50, '2026-08-10 09:30:00', 'adelanto', 'efectivo',     'REC-009', 1),
      (10,12,  4887.50, '2026-05-15 12:00:00', 'adelanto', 'efectivo',     'REC-010', 1),
      (11,12,  4887.50, '2026-05-19 16:00:00', 'saldo',    'transferencia','REC-011', 1)
    `)

    // ── 20. Pagos de aseguradora ──────────────────────────────────────────────
    await conn.query(`
      INSERT INTO pago_seguro (id, id_orden, monto, fecha_esperada, fecha_recibido, estado, referencia_bancaria, concepto) VALUES
      (1, 2, 22000.00, '2026-03-01', NULL,         'pendiente', NULL,           'pago_principal'),
      (2, 3, 15000.00, '2026-03-15', '2026-03-14', 'recibido',  'BAC-TRF-8834', 'pago_principal'),
      (3, 5, 25000.00, '2026-05-10', NULL,         'pendiente', NULL,           'pago_principal'),
      (4, 5,  5700.00, '2026-05-15', '2026-05-12', 'recibido',  'BAC-TRF-9921', 'dano_oculto'),
      (5, 7,  7200.00, '2026-07-01', NULL,         'pendiente', NULL,           'pago_principal'),
      (6, 9, 25000.00, '2026-08-20', NULL,         'pendiente', NULL,           'pago_principal')
    `)

    // ── 21. Linker LAFISE ─────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO linker_lafise (id, id_orden, numero_reclamo, numero_orden_compra, chasis, motor, placa, nombre_cliente, estado_ingreso, fecha_ingreso_linker, observaciones) VALUES
      (1, 2, 'REC-408055', 'ORD-400542', 'KMHD74LF5LU234567', 'KMHD74LF5', 'N-234567', 'María López García',    'pendiente', NULL,                  NULL),
      (2, 5, 'REC-512233', 'ORD-567890', 'KNDPC3AC5H7567890', 'KNDPC3AC5', 'L-567890', 'Pedro Hernández López', 'ingresado', '2026-04-28 10:00:00', 'Daños ocultos aprobados incluidos'),
      (3, 9, 'REC-634521', 'ORD-901234', '1FTER4EH5KLA01234', '1FTER4EH5', 'R-901234', 'Diego Ramírez Vega',    'pendiente', NULL,                  NULL)
    `)

    // ── 22. Liquidaciones ─────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO liquidacion_personal (id, id_personal, fecha, monto_total, pagado, fecha_pago) VALUES
      (1, 1, '2026-01-31', 6500.00, TRUE,  '2026-01-31'),
      (2, 2, '2026-01-31', 4500.00, TRUE,  '2026-01-31'),
      (3, 1, '2026-02-28', 9000.00, TRUE,  '2026-02-28'),
      (4, 2, '2026-02-28', 5000.00, TRUE,  '2026-02-28'),
      (5, 3, '2026-07-31', 3500.00, FALSE, NULL),
      (6, 1, '2026-07-31', 7500.00, FALSE, NULL),
      (7, 2, '2026-07-31', 5000.00, FALSE, NULL)
    `)

    await conn.query(`
      INSERT INTO liquidacion_detalle (id, id_liquidacion, id_orden_personal) VALUES
      ( 1, 1,  1), ( 2, 2,  2),
      ( 3, 3,  3), ( 4, 3,  5),
      ( 5, 4,  4), ( 6, 4,  6),
      ( 7, 5, 12), ( 8, 5, 16),
      ( 9, 6, 10), (10, 6, 14),
      (11, 7, 11), (12, 7, 15)
    `)

    // ── 23. Compras de inventario ─────────────────────────────────────────────
    await conn.query(`
      INSERT INTO compra_inventario (id, id_proveedor, fecha, monto_subtotal, monto_iva, monto_total, tiene_factura_iva) VALUES
      (1, 1, '2026-01-05', 12000.00, 1800.00, 13800.00, TRUE),
      (2, 3, '2026-01-10',  3500.00,  525.00,  4025.00, TRUE),
      (3, 2, '2026-02-15',  8000.00,    0.00,  8000.00, FALSE),
      (4, 1, '2026-03-01', 15000.00, 2250.00, 17250.00, TRUE),
      (5, 3, '2026-04-10',  4200.00,  630.00,  4830.00, TRUE),
      (6, 4, '2026-05-20',  9500.00, 1425.00, 10925.00, TRUE),
      (7, 1, '2026-06-15',  6000.00,  900.00,  6900.00, TRUE),
      (8, 3, '2026-07-01',  2800.00,  420.00,  3220.00, TRUE)
    `)

    // ── 24. Movimientos de inventario ─────────────────────────────────────────
    await conn.query(`
      INSERT INTO movimiento_inventario (id, id_inventario, tipo, cantidad, id_usuario, id_compra, id_orden, nota) VALUES
      ( 1,  1, 'entrada_compra',  10.00, 1, 1, NULL, 'Compra inicial enero'),
      ( 2,  2, 'entrada_compra',   8.00, 1, 1, NULL, 'Compra inicial enero'),
      ( 3,  3, 'entrada_compra',   5.00, 1, 1, NULL, 'Compra inicial enero'),
      ( 4,  6, 'entrada_compra',  50.00, 1, 2, NULL, 'Lijas enero'),
      ( 5,  7, 'entrada_compra',  40.00, 1, 2, NULL, 'Lijas enero'),
      ( 6,  1, 'entrada_compra',   8.00, 1, 4, NULL, 'Compra marzo'),
      ( 7,  3, 'entrada_compra',   4.00, 1, 4, NULL, 'Compra marzo'),
      ( 8, 16, 'entrada_compra',   6.00, 1, 4, NULL, 'Compra marzo'),
      ( 9,  1, 'salida_orden',     3.00, 1, NULL, 1, 'Usado en orden #1'),
      (10,  3, 'salida_orden',     2.00, 1, NULL, 1, 'Usado en orden #1'),
      (11,  4, 'salida_orden',     2.00, 1, NULL, 1, 'Usado en orden #1'),
      (12,  6, 'salida_orden',    20.00, 1, NULL, 1, 'Usado en orden #1'),
      (13,  7, 'salida_orden',    15.00, 1, NULL, 1, 'Usado en orden #1'),
      (14,  2, 'salida_orden',     2.00, 1, NULL, 2, 'Usado en orden #2'),
      (15,  3, 'salida_orden',     1.00, 1, NULL, 2, 'Usado en orden #2'),
      (16,  2, 'salida_orden',     2.00, 1, NULL, 3, 'Usado en orden #3'),
      (17,  3, 'salida_orden',     1.00, 1, NULL, 3, 'Usado en orden #3'),
      (18, 16, 'salida_orden',     3.00, 1, NULL, 5, 'Usado en orden #5'),
      (19,  9, 'ajuste_manual',   -5.00, 1, NULL, NULL, 'Corrección conteo físico — masilla dañada')
    `)

    // ── 25. Auditoría ─────────────────────────────────────────────────────────
    await conn.query(`
      INSERT INTO auditoria (id, id_usuario, tabla, id_registro, accion, detalle) VALUES
      ( 1, 1, 'orden',        1,  'crear',         'Orden creada. Tipo: pintura, Pago: particular'),
      ( 2, 1, 'orden',        1,  'cambio_estado', 'Estado cambiado a: entregado'),
      ( 3, 1, 'orden',        2,  'crear',         'Orden creada. Tipo: pintura, Pago: lafise'),
      ( 4, 1, 'orden',        3,  'crear',         'Orden creada. Tipo: pintura, Pago: iniser'),
      ( 5, 1, 'orden',        3,  'cambio_estado', 'Estado cambiado a: entregado'),
      ( 6, 1, 'orden',        4,  'crear',         'Orden creada. Tipo: pintura, Pago: particular'),
      ( 7, 1, 'orden',        4,  'cambio_estado', 'Estado cambiado a: en_proceso'),
      ( 8, 1, 'orden',        5,  'crear',         'Orden creada. Tipo: pintura, Pago: lafise'),
      ( 9, 1, 'orden',        5,  'cambio_estado', 'Estado cambiado a: en_proceso'),
      (10, 1, 'orden',        8,  'cambio_estado', 'Estado cambiado a: listo'),
      (11, 1, 'pago_cliente', 1,  'crear',         'Pago adelanto C$8,625.00 — efectivo'),
      (12, 1, 'pago_cliente', 2,  'crear',         'Pago saldo C$8,625.00 — transferencia'),
      (13, 1, 'pago_seguro',  2,  'cambio_estado', 'Cobro INISER marcado como recibido — BAC-TRF-8834'),
      (14, 1, 'pago_seguro',  4,  'cambio_estado', 'Cobro daño oculto recibido — BAC-TRF-9921'),
      (15, 1, 'orden',       13,  'cambio_estado', 'Estado cambiado a: cancelado')
    `)

    await conn.commit()
    res.json({ ok: true, message: 'Base de datos reiniciada con datos de prueba.' })
  } catch (err) {
    await conn.rollback()
    console.error('Error en /debug/reset-db:', err)
    res.status(500).json({ ok: false, message: err.message })
  } finally {
    conn.release()
  }
})

module.exports = router