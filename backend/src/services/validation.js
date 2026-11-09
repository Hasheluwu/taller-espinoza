// backend/src/services/validation.js
const { tipoOrdenToSlug, aseguradoraToSlug } = require('./catalogs')

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  throw error
}

function number(value, name, { positive = false, integer = false } = {}) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    fail(`${name}: ingresa un número válido.`)
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || (positive && n === 0) || (integer && !Number.isSafeInteger(n))) {
    fail(`${name}: valor inválido.`)
  }
  return n
}

function cents(value, name = 'Monto', positive = false) {
  const n = number(value, name, { positive })
  const rounded = Math.round(n * 100)
  if (!Number.isSafeInteger(rounded) || Math.abs(n * 100 - rounded) > 0.000001) {
    fail(`${name}: usa como máximo dos decimales.`)
  }
  return rounded
}

function money(value, name, positive = false) {
  return cents(value, name, positive) / 100
}

function packId(parentId, childId) {
  return Number(parentId) * 100000 + Number(childId)
}

function unpackId(packed, label = 'Identificador') {
  if (typeof packed === 'string' && packed.includes('-')) {
    const [p, c] = packed.split('-').map(Number)
    if (Number.isSafeInteger(p) && p > 0 && Number.isSafeInteger(c) && c > 0) return [p, c]
  }
  const n = number(packed, label, { positive: true, integer: true })
  if (n >= 100000) {
    return [Math.floor(n / 100000), n % 100000]
  }
  return [n, 1]
}

async function lockOrder(conn, id, editable = false) {
  const orderId = number(id, 'Orden', { positive: true, integer: true })
  const [locked] = await conn.query('SELECT * FROM orden WHERE id_orden = ? FOR UPDATE', [orderId])
  if (!locked.length) fail('Orden no encontrada.', 404)

  const [[tot]] = await conn.query('SELECT * FROM vw_totales_orden WHERE id_orden = ?', [orderId])
  const [[fact]] = await conn.query(
    `SELECT numero_factura FROM vw_totales_factura WHERE id_orden = ? LIMIT 1`,
    [orderId]
  )
  const [[gar]] = await conn.query(
    `SELECT fecha_vencimiento FROM garantia WHERE id_orden = ? ORDER BY num_garantia ASC LIMIT 1`,
    [orderId]
  )
  const [[orig]] = await conn.query(
    `SELECT id_orden_origen FROM reclamo_garantia WHERE id_orden = ?
     UNION ALL
     SELECT id_orden_origen FROM orden_dano_particular WHERE id_orden = ?
     LIMIT 1`,
    [orderId, orderId]
  )

  const facturaEmitida = Boolean(fact)
  if (editable && facturaEmitida) {
    fail('La orden tiene una factura emitida y sus cargos ya están cerrados.', 409)
  }
  if (editable && !['recibido', 'en_proceso'].includes(locked[0].estado)) {
    fail('Esta orden está cerrada para cambios en sus operaciones.', 409)
  }

  const asegSlug = aseguradoraToSlug(tot.id_aseguradora, tot.nombre_aseguradora)
  const tipoPago = asegSlug === 'ninguna' ? 'particular' : asegSlug
  const costoTotal = Number(tot.costo_total || 0)
  const esSeguro = tipoPago !== 'particular'

  return {
    ...tot,
    id: tot.id_orden,
    id_orden: tot.id_orden,
    id_vehiculo: tot.matricula,
    matricula: tot.matricula,
    id_presupuesto: tot.id_presupuesto || null,
    cargos_desde_proforma: Boolean(tot.id_presupuesto),
    tipo: tipoOrdenToSlug(tot.id_tipo_orden),
    tipo_pago: tipoPago,
    subtotal: Number(tot.subtotal || 0),
    iva: Number(tot.iva || 0),
    costo_total: costoTotal,
    monto_seguro: esSeguro ? (costoTotal > 0 ? costoTotal : Number(tot.monto_autorizado || 0)) : 0,
    monto_cliente: esSeguro ? 0 : costoTotal,
    pagador_unico: 1,
    es_garantia: Boolean(tot.es_reclamo_garantia || tot.tiene_garantia),
    fecha_vencimiento_garantia: gar?.fecha_vencimiento || null,
    id_orden_origen: orig?.id_orden_origen || null,
    obra_interna: Boolean(tot.obra_interna),
    obra_externa: Boolean(tot.obra_externa),
    danos_ocultos: Boolean(tot.danos_ocultos),
    factura_emitida: facturaEmitida,
    numero_factura_fisica: fact?.numero_factura || null,
    creado_por: tot.id_usuario,
  }
}

function paymentDate(value, name = 'Fecha', { future = false } = {}) {
  if (value === undefined || value === null || value === '') return null
  const match =
    typeof value === 'string' &&
    value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) fail(`${name}: ingresa una fecha válida.`)
  const [, day, hh = '00', mm = '00', ss = '00'] = match
  const parsed = new Date(`${day}T12:00:00Z`)
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day ||
    +hh > 23 ||
    +mm > 59 ||
    +ss > 59
  ) {
    fail(`${name}: ingresa una fecha válida.`)
  }
  if (day < '2000-01-01') fail(`${name}: la fecha es demasiado antigua.`)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Managua' })
  if (!future && day > today) fail(`${name}: no puede ser una fecha futura.`)
  return match[2] ? `${day} ${hh}:${mm}:${ss}` : day
}

module.exports = { fail, number, cents, money, packId, unpackId, lockOrder, paymentDate }