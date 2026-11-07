// backend/src/services/insuranceInvoices.js
const { cents, fail, lockOrder } = require('./validation')

const insured = order => ['lafise', 'iniser'].includes(order.tipo_pago)

function calculate(insurer, lines) {
  const rate = { lafise: 20, iniser: 15 }[insurer]
  if (!rate) fail('Esta orden no corresponde a una aseguradora admitida.')
  const details = lines.map(line => {
    const base = cents(line.importe, 'Importe de la actividad')
    const labor = line.tipo_linea === 'servicio'
    const discount = labor ? Math.round((base * rate) / 100) : 0
    const net = base - discount
    const tax = labor || line.aplica_iva ? Math.round(net * 0.15) : 0
    return {
      ...line,
      importe: base / 100,
      descuento: discount / 100,
      neto: net / 100,
      iva: tax / 100,
      total: (net + tax) / 100,
    }
  })
  const sum = key => details.reduce((total, line) => total + cents(line[key]), 0) / 100
  return {
    porcentaje_descuento: rate,
    detalles: details,
    bruto: sum('importe'),
    descuento: sum('descuento'),
    subtotal: sum('neto'),
    iva: sum('iva'),
    total: sum('total'),
  }
}

async function preview(conn, order) {
  if (!insured(order)) fail('Los particulares conservan sus pagos por abonos.')
  const orderId = order.id_orden || order.id

  const [[vehicle]] = await conn.query(
    `SELECT v.*, ma.nombre AS marca, mo.nombre AS modelo, c.nombre AS cliente, m.nombre AS municipio_residencia
     FROM vehiculo v
     JOIN modelo mo ON mo.id_modelo = v.id_modelo
     JOIN marca ma ON ma.id_marca = mo.id_marca
     JOIN cliente c ON c.id_cliente = v.id_cliente
     JOIN municipio m ON m.id_municipio = c.id_municipio
     WHERE v.matricula = ?`,
    [order.matricula]
  )

  const [services] = await conn.query(
    'SELECT * FROM orden_servicio WHERE id_orden = ? ORDER BY num_linea ASC',
    [orderId]
  )
  const [materials] = await conn.query(
    `SELECT om.cantidad_usada, om.precio_unitario, m.nombre
     FROM orden_material om
     JOIN material m ON m.id_material = om.id_material
     WHERE om.id_orden = ?`,
    [orderId]
  )
  const [parts] = await conn.query(
    `SELECT orr.cantidad_usada, orr.precio_unitario, rt.nombre
     FROM orden_repuesto orr
     JOIN repuesto_taller rt ON rt.id_repuesto = orr.id_repuesto
     WHERE orr.id_orden = ?`,
    [orderId]
  )

  const lines = services.map(s => ({
    descripcion: s.descripcion,
    tipo_linea: 'servicio',
    cantidad: 1,
    importe: Number(s.precio),
    aplica_iva: Boolean(s.aplica_iva),
  }))

  for (const [type, rows] of [
    ['material', materials],
    ['repuesto', parts],
  ]) {
    for (const row of rows) {
      lines.push({
        descripcion: row.nombre,
        tipo_linea: type,
        cantidad: Number(row.cantidad_usada),
        importe: Math.round(Number(row.cantidad_usada) * cents(row.precio_unitario)) / 100,
        aplica_iva: false,
      })
    }
  }

  if (!lines.length) {
    fail('Registra las actividades y sus precios en Operaciones antes de emitir la factura.', 409)
  }

  const totals = calculate(order.tipo_pago, lines)
  const [[credits]] = await conn.query(
    `SELECT
       (SELECT COALESCE(SUM(monto), 0) FROM pago_cliente WHERE id_orden = ?) AS cliente,
       (SELECT COALESCE(SUM(monto), 0) FROM pago_seguro WHERE id_orden = ?) AS seguro`,
    [orderId, orderId]
  )
  const credit = cents(credits.cliente) + cents(credits.seguro)
  const saldo = Math.max(0, cents(totals.total) - credit) / 100

  return {
    ...totals,
    id_orden: orderId,
    aseguradora: order.tipo_pago.toUpperCase(),
    tramite: order.numero_tramite,
    cliente: vehicle.cliente,
    poblacion: vehicle.municipio_residencia,
    ingreso: order.fecha_ingreso,
    vehiculo: {
      matricula: vehicle.matricula,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      anio: vehicle.anio_fabricacion,
      color: vehicle.color,
    },
    credito_cliente_anterior: Number(credits.cliente),
    credito_seguro_anterior: Number(credits.seguro),
    credito_anterior: credit / 100,
    saldo,
    excedente_anterior: Math.max(0, credit - cents(totals.total)) / 100,
  }
}

async function existing(conn, idOrden) {
  const [[row]] = await conn.query(
    `SELECT fs.numero_factura, fs.id_orden, f.fecha_emision, f.subtotal, f.iva, (f.subtotal + f.iva) AS total
     FROM factura_seguro fs
     JOIN factura f ON f.numero_factura = fs.numero_factura
     WHERE fs.id_orden = ?`,
    [idOrden]
  )
  if (!row) return null

  const order = await lockOrder(conn, idOrden)
  const doc = await preview(conn, order)
  const [[ps]] = await conn.query(
    `SELECT COALESCE(SUM(monto), 0) AS pagado, MAX(fecha_recibido) AS fecha_pago, MAX(referencia_bancaria) AS referencia
     FROM pago_seguro WHERE id_orden = ?`,
    [idOrden]
  )

  const totalFactura = Number(row.total)
  const pagadoSeguro = Number(ps.pagado || 0)
  const isPaid = pagadoSeguro >= totalFactura && totalFactura > 0
  const saldoInicial = Math.max(0, Math.round((totalFactura - pagadoSeguro) * 100) / 100)

  return {
    id: row.numero_factura,
    numero_factura: row.numero_factura,
    id_orden: row.id_orden,
    aseguradora: order.tipo_pago,
    documento: { ...doc, subtotal: Number(row.subtotal), iva: Number(row.iva), total: totalFactura },
    total: totalFactura,
    saldo_inicial: isPaid ? totalFactura : saldoInicial,
    monto_recibido: pagadoSeguro,
    estado: isPaid ? 'pagada' : 'pendiente',
    fecha_emision: row.fecha_emision,
    fecha_pago: ps.fecha_pago || null,
    referencia: ps.referencia || null,
  }
}

async function issue(conn, idOrden, user) {
  const order = await lockOrder(conn, idOrden)
  const prior = await existing(conn, idOrden)
  if (prior) return prior
  if (!['listo', 'entregado'].includes(order.estado)) {
    fail('Marca la reparación como lista antes de emitir su factura definitiva.', 409)
  }
  const document = await preview(conn, order)
  if (document.total <= 0) fail('La factura debe tener un total mayor que cero.')

  const numFactura = `FAC-SEG-${String(idOrden).padStart(4, '0')}`
  await conn.query(
    `INSERT INTO factura (numero_factura, fecha_emision, subtotal, iva)
     VALUES (?, CURDATE(), ?, ?)
     ON DUPLICATE KEY UPDATE subtotal = VALUES(subtotal), iva = VALUES(iva)`,
    [numFactura, document.subtotal, document.iva]
  )
  await conn.query(
    `INSERT IGNORE INTO factura_seguro (numero_factura, id_orden) VALUES (?, ?)`,
    [numFactura, idOrden]
  )
  await conn.query(
    `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
     VALUES (?, 'factura_seguro', ?, 'crear', ?)`,
    [user, numFactura, `Factura de seguro emitida para orden #${idOrden}. Total C$ ${document.total}`]
  )
  return existing(conn, idOrden)
}

async function pay(conn, idOrden, body, user) {
  const order = await lockOrder(conn, idOrden)
  if (!insured(order) || order.estado === 'cancelado') {
    fail('Esta orden no admite pagos de aseguradora.', 409)
  }
  const invoice = await existing(conn, idOrden)
  if (!invoice) fail('Emite y revisa primero la factura de la aseguradora.', 409)
  if (invoice.estado === 'pagada') return invoice
  if (body.confirmar !== true) fail('Confirma que recibiste el pago completo.')

  const date = String(body.fecha || '')
  const parsed = new Date(`${date}T12:00:00Z`)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Managua' })
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date > today
  ) {
    fail('Ingresa una fecha de pago válida, no futura.')
  }
  const reference =
    require('./fieldRules').reference(body.referencia, { label: 'Referencia del pago', max: 100 }) ||
    `TRF-${order.tipo_pago.toUpperCase()}-${idOrden}`

  const [[nextNum]] = await conn.query(
    'SELECT COALESCE(MAX(num_pago), 0) + 1 AS next_num FROM pago_seguro WHERE id_orden = ?',
    [idOrden]
  )
  await conn.query(
    `INSERT INTO pago_seguro (id_orden, num_pago, monto, fecha_recibido, referencia_bancaria, concepto)
     VALUES (?, ?, ?, ?, ?, 'pago_principal')`,
    [idOrden, nextNum.next_num, invoice.saldo_inicial, date, reference]
  )
  await conn.query(
    `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
     VALUES (?, 'factura_seguro', ?, 'cambio_estado', ?)`,
    [user, invoice.numero_factura, `Pago completo recibido: C$ ${invoice.saldo_inicial}. Fecha ${date}.`]
  )
  return existing(conn, idOrden)
}

module.exports = { calculate, insured, existing, preview, issue, pay }