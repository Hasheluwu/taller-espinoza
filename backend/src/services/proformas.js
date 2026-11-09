// backend/src/services/proformas.js
const { validateDates } = require('./orderCreation')
const { fail, number, cents, packId } = require('./validation')
const rules = require('./fieldRules')
const {
  resolveMatricula,
  aseguradoraToId,
  aseguradoraToSlug,
  tipoOrdenToId,
} = require('./catalogs')

const json = value => (typeof value === 'string' ? JSON.parse(value) : value)
let nextSequenceNumber = 17293

// Memoria de metadatos de proformas creadas en sesión (seguro elegido: PARTICULAR, LAFISE o INISER)
const proformaMeta = new Map()

function text(value, label, max = 255, required = false) {
  const s = String(value ?? '').trim()
  if ((required && !s) || s.length > max) {
    fail(`${label}: revisa el contenido (máximo ${max} caracteres).`)
  }
  return s
}

function calculate(body) {
  if (!Array.isArray(body.detalles) || body.detalles.length > 150) fail('Agrega hasta 150 líneas.')
  const global =
    body.mano_obra_global !== null && body.mano_obra_global !== undefined && body.mano_obra_global !== ''
      ? cents(body.mano_obra_global, 'Mano de obra')
      : null
  const detalles = body.detalles.map(d => {
    if (!['servicio', 'repuesto', 'material'].includes(d.tipo_linea)) fail('Tipo de línea inválido.')
    const cantidad = number(d.cantidad, 'Cantidad', { positive: true })
    if (cantidad > 99999 || Math.abs(cantidad * 100 - Math.round(cantidad * 100)) > 0.000001) {
      fail('Cantidad: usa hasta dos decimales y un máximo de 99999.')
    }
    const precio = cents(d.precio_unitario, 'Precio')
    if (typeof d.aplica_iva !== 'boolean') fail('Indica si la línea aplica IVA.')
    const base = global !== null && d.tipo_linea === 'servicio' ? 0 : Math.round(cantidad * precio)
    return {
      tipo_linea: d.tipo_linea,
      descripcion: text(d.descripcion, 'Descripción', 255, true),
      cantidad,
      precio_unitario: global !== null && d.tipo_linea === 'servicio' ? 0 : precio / 100,
      aplica_iva: global !== null && d.tipo_linea === 'servicio' ? false : d.aplica_iva,
      base: base / 100,
      impuesto: (d.aplica_iva ? Math.round(base * 0.15) : 0) / 100,
    }
  })
  const subtotal = detalles.reduce((s, d) => s + Math.round(d.base * 100), global ?? 0)
  const iva = detalles.reduce((s, d) => s + Math.round(d.impuesto * 100), global === null ? 0 : Math.round(global * 0.15))
  if (subtotal + iva > 9999999999) fail('El total supera el límite permitido.')
  return {
    detalles,
    mano_obra_global: global === null ? null : global / 100,
    subtotal: subtotal / 100,
    iva: iva / 100,
    total: (subtotal + iva) / 100,
  }
}

async function context(conn, idOrMatricula) {
  const mat = await resolveMatricula(conn, idOrMatricula)
  if (!mat) fail('Vehículo no encontrado.', 404)
  const [[row]] = await conn.query(
    `SELECT
       v.matricula AS id,
       v.matricula,
       v.id_cliente,
       ma.nombre AS marca,
       mo.nombre AS modelo,
       v.anio_fabricacion,
       v.color,
       v.chasis,
       v.motor,
       va.id_aseguradora,
       c.nombre AS cliente,
       c.numero_documento AS cedula,
       c.telefono
     FROM vehiculo v
     JOIN modelo mo ON mo.id_modelo = v.id_modelo
     JOIN marca ma ON ma.id_marca = mo.id_marca
     JOIN cliente c ON c.id_cliente = v.id_cliente
     LEFT JOIN vehiculo_aseguradora va ON va.matricula = v.matricula
     WHERE v.matricula = ?`,
    [mat]
  )
  if (!row) fail('Vehículo no encontrado.', 404)
  row.aseguradora = aseguradoraToSlug(row.id_aseguradora)
  return row
}

function quotationData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('Completa los datos de la cotización.')
  }
  return {
    cliente: text(value.cliente, 'Cliente', 150, true),
    placa: rules.plate(value.placa),
    marca: text(value.marca, 'Marca', 80, true),
    vehiculo: text(value.vehiculo, 'Modelo', 80, true),
    anio: String(value.anio || 2020),
    color: text(value.color || 'Blanco', 'Color', 50, false),
    cedula: value.cedula ? rules.cedula(value.cedula, { required: false }) : '',
    telefono: value.telefono ? rules.phone(value.telefono, { required: false }) : '',
    municipio_residencia: text(value.municipio_residencia || 'Managua', 'Municipio', 100, false),
    direccion: text(value.direccion || '', 'Dirección', 255, false),
    chasis: rules.serial(value.chasis, { label: 'Chasis' }),
    motor: rules.serial(value.motor, { label: 'Motor' }),
  }
}

function snapshot(v) {
  return {
    cliente: v.cliente,
    cedula: v.cedula,
    telefono: v.telefono,
    vehiculo: v.modelo,
    marca: v.marca,
    placa: v.matricula,
    anio: String(v.anio_fabricacion),
    id_cliente: v.id_cliente,
  }
}

function detectSeguroFromText(obs = '', defaultVehicleSeguro = 'ninguna', meta = null) {
  if (meta?.seguro) return meta.seguro
  const s = String(obs || '').toUpperCase()
  if (s.includes('[PARTICULAR]') || s.includes('CLIENTE APRUEBA')) return 'PARTICULAR'
  if (s.includes('LAFISE')) return 'LAFISE'
  if (s.includes('INISER')) return 'INISER'
  return defaultVehicleSeguro === 'ninguna' ? 'PARTICULAR' : defaultVehicleSeguro.toUpperCase()
}

async function read(conn, id, lock = false) {
  const presId = number(id, 'Proforma', { positive: true, integer: true })
  if (lock) {
    await conn.query('SELECT id_presupuesto FROM presupuesto WHERE id_presupuesto = ? FOR UPDATE', [presId])
  }
  const [[p]] = await conn.query('SELECT * FROM vw_totales_presupuesto WHERE id_presupuesto = ?', [presId])
  if (!p) fail('Proforma no encontrada.', 404)

  const [detalles] = await conn.query(
    'SELECT * FROM presupuesto_detalle WHERE id_presupuesto = ? ORDER BY num_linea ASC',
    [presId]
  )
  const [ordenes] = await conn.query(
    'SELECT id_orden FROM orden_presupuesto WHERE id_presupuesto = ? ORDER BY id_orden ASC',
    [presId]
  )
  const v = await context(conn, p.matricula)
  const meta = proformaMeta.get(Number(presId))
  const seguro = detectSeguroFromText(p.observaciones, v.aseguradora, meta)
  const faseMap = { pendiente: 'emitida', aprobado: 'aprobada', rechazado: 'rechazada' }
  const fase = meta?.fase || faseMap[p.estado] || 'emitida'

  return {
    ...p,
    id: p.id_presupuesto,
    id_presupuesto: p.id_presupuesto,
    id_vehiculo: p.matricula,
    subtotal: Number(p.subtotal),
    iva: Number(p.iva),
    total: Number(p.total),
    numero: 17000 + Number(p.id_presupuesto),
    version: meta?.version || 1,
    fase,
    es_cotizacion: Boolean(meta?.es_cotizacion),
    seguro,
    tramite: meta?.tramite || '',
    reclamo: meta?.reclamo || '',
    mano_obra_global: meta?.mano_obra_global ?? null,
    datos: snapshot(v),
    detalles: detalles.map(d => ({
      ...d,
      id: packId(d.id_presupuesto, d.num_linea),
      aplica_iva: Boolean(d.aplica_iva),
    })),
    versiones: [{ version: meta?.version || 1, emitida: new Date(p.fecha).toISOString(), desde_orden: null }],
    ordenes: ordenes.map(o => o.id_orden),
    vehiculo_actual: v,
  }
}

async function audit(conn, user, id, action, detail) {
  await conn.query(
    `INSERT INTO auditoria (id_usuario, tabla, id_registro, accion, detalle)
     VALUES (?, 'presupuesto', ?, ?, ?)`,
    [user, String(id), action, detail]
  )
}

async function nextNumber() {
  const current = nextSequenceNumber
  nextSequenceNumber += 1
  return current
}

async function save(conn, id, body, user) {
  const totals = calculate(body)
  const fecha = text(body.fecha, 'Fecha', 10, true)
  const seguro = text(body.seguro || 'PARTICULAR', 'Aseguradora', 100, true).toUpperCase()
  const rawObs = text(body.observaciones, 'Observaciones', 4000)

  let matricula = await resolveMatricula(conn, body.id_vehiculo || body.matricula || body.datos?.placa)
  if (!matricula && body.datos) {
    matricula = await require('./quotationRegistration').register(
      conn,
      { datos: quotationData(body.datos), seguro },
      body.datos
    )
  }
  if (!matricula) fail('Selecciona un vehículo válido para registrar el presupuesto.', 400)

  let presId = id ? number(id, 'Proforma', { positive: true, integer: true }) : null
  const prevMeta = presId ? proformaMeta.get(Number(presId)) : null
  const nextVersion = prevMeta ? prevMeta.version + 1 : 1

  if (presId) {
    const old = await read(conn, presId, true)
    if (old.ordenes.length) {
      fail('Esta proforma ya tiene una orden. Sus datos se conservan; crea otra proforma para un nuevo trabajo.', 409)
    }
    await conn.query(
      `UPDATE presupuesto SET matricula = ?, fecha = ?, estado = 'pendiente', observaciones = ?
       WHERE id_presupuesto = ?`,
      [matricula, fecha, rawObs || null, presId]
    )
    await conn.query('DELETE FROM presupuesto_detalle WHERE id_presupuesto = ?', [presId])
  } else {
    const [result] = await conn.query(
      `INSERT INTO presupuesto (matricula, fecha, estado, observaciones)
       VALUES (?, ?, 'pendiente', ?)`,
      [matricula, fecha, rawObs || null]
    )
    presId = result.insertId
  }

  proformaMeta.set(Number(presId), {
    seguro,
    tramite: body.tramite || '',
    reclamo: body.reclamo || '',
    mano_obra_global: totals.mano_obra_global,
    es_cotizacion: Boolean(body.es_cotizacion),
    version: nextVersion,
    fase: 'borrador',
  })

  let numLinea = 1
  for (const d of totals.detalles) {
    const precioUnitario =
      totals.mano_obra_global !== null && d.tipo_linea === 'servicio' && numLinea === 1
        ? totals.mano_obra_global / Number(d.cantidad || 1)
        : d.precio_unitario
    const aplicaIva =
      totals.mano_obra_global !== null && d.tipo_linea === 'servicio' && numLinea === 1 ? true : d.aplica_iva

    await conn.query(
      `INSERT INTO presupuesto_detalle
         (id_presupuesto, num_linea, tipo_linea, descripcion, cantidad, precio_unitario, aplica_iva)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [presId, numLinea, d.tipo_linea, d.descripcion, d.cantidad, precioUnitario, aplicaIva ? 1 : 0]
    )
    numLinea += 1
  }

  await audit(conn, user, presId, id ? 'editar' : 'crear', `Presupuesto (${seguro}) guardado; total C$ ${totals.total}`)
  return read(conn, presId)
}

async function emit(conn, id, _version, user) {
  const p = await read(conn, id, true)
  if (!p.detalles.length || Number(p.total) <= 0) {
    fail('Agrega trabajos o repuestos y un total mayor que cero antes de emitir.')
  }
  const meta = proformaMeta.get(Number(id)) || {}
  proformaMeta.set(Number(id), { ...meta, seguro: p.seguro, version: p.version, fase: 'emitida' })
  await audit(conn, user, id, 'cambio_estado', `Emitida proforma ${p.numero}`)
  return read(conn, id)
}

async function changeState(conn, id, body, user) {
  const p = await read(conn, id, true)
  const fase = body.fase
  if (!['aprobada', 'rechazada', 'anulada'].includes(fase)) fail('Estado inválido.')
  if (p.ordenes.length) fail('Esta proforma está cerrada para cambios.', 409)
  const nuevoEstado = fase === 'aprobada' ? 'aprobado' : 'rechazado'
  const motivo = text(body.motivo, 'Motivo', 500, fase === 'anulada')
  await conn.query('UPDATE presupuesto SET estado = ? WHERE id_presupuesto = ?', [nuevoEstado, id])
  const meta = proformaMeta.get(Number(id)) || {}
  proformaMeta.set(Number(id), { ...meta, seguro: p.seguro, version: p.version, fase })
  await audit(conn, user, id, 'cambio_estado', `${fase}: ${motivo}`)
  return read(conn, id)
}

async function convert(conn, id, body, user) {
  const p = await read(conn, id, true)
  if (p.ordenes.length) {
    const order = await require('./validation').lockOrder(conn, p.ordenes[0])
    return { ...order, matricula: p.matricula, nombre_cliente: p.datos.cliente }
  }
  if (p.estado !== 'aprobado') {
    fail('Aprueba el presupuesto antes de crear la orden.', 409)
  }
  if (!['pintura', 'mecanica', 'mantenimiento'].includes(body.tipo)) {
    fail('Selecciona el tipo de trabajo.')
  }
  validateDates(body)

  // Respetar si el usuario eligió 'particular' en el formulario de la orden,
  // incluso si el vehículo tiene aseguradora afiliada en vehiculo_aseguradora.
  const chosenPayer = body.tipo_pago
    ? String(body.tipo_pago).toLowerCase()
    : p.seguro === 'PARTICULAR'
      ? 'particular'
      : p.seguro.toLowerCase()
  const insured = chosenPayer === 'lafise' || chosenPayer === 'iniser'

  const idTipoOrden = tipoOrdenToId(body.tipo)
  const entrega = body.fecha_entrega_estimada || null

  const [result] = await conn.query(
    `INSERT INTO orden (matricula, id_tipo_orden, estado, fecha_ingreso, fecha_entrega_estimada, id_usuario)
     VALUES (?, ?, 'recibido', ?, ?, ?)`,
    [p.matricula, idTipoOrden, body.fecha_ingreso, entrega, user]
  )
  const orderId = result.insertId

  await conn.query('INSERT INTO orden_presupuesto (id_orden, id_presupuesto) VALUES (?, ?)', [orderId, p.id_presupuesto])

  if (insured) {
    const idAseg = aseguradoraToId(chosenPayer)
    const tramite = body.numero_tramite || p.tramite || p.reclamo || `TRAM-${chosenPayer.toUpperCase()}-${orderId}`
    const ordenSeg = body.numero_orden_seguro || null
    await conn.query(
      `INSERT INTO orden_seguro (id_orden, id_aseguradora, numero_tramite, numero_orden_seguro, monto_autorizado)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, idAseg, tramite, ordenSeg, p.total]
    )
  }

  let numLinea = 1
  for (const d of p.detalles) {
    const base = Math.round(Number(d.cantidad) * Number(d.precio_unitario) * 100) / 100
    await conn.query(
      `INSERT INTO orden_servicio (id_orden, num_linea, descripcion, precio, aplica_iva)
       VALUES (?, ?, ?, ?, ?)`,
      [
        orderId,
        numLinea,
        text(`${Number(d.cantidad)} × ${d.descripcion}`, 'Descripción de cargo', 255),
        base,
        d.aplica_iva ? 1 : 0,
      ]
    )
    numLinea += 1
  }

  if (body.es_garantia && body.fecha_vencimiento_garantia) {
    await conn.query(
      `INSERT INTO garantia (id_orden, num_garantia, fecha_vencimiento) VALUES (?, 1, ?)`,
      [orderId, body.fecha_vencimiento_garantia]
    )
  }

  await audit(conn, user, id, 'cambio_estado', `Convertida en orden #${orderId} (${chosenPayer})`)
  const order = await require('./validation').lockOrder(conn, orderId)
  return { ...order, matricula: p.matricula, nombre_cliente: p.datos.cliente }
}

module.exports = {
  quotationData,
  calculate,
  context,
  read,
  save,
  emit,
  changeState,
  convert,
  nextNumber,
  audit,
  json,
  text,
}