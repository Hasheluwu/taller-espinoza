const { validateDates } = require('./orderCreation')
const { fail, number, cents } = require('./validation')
const rules = require('./fieldRules')
const json = value => typeof value === 'string' ? JSON.parse(value) : value
function text(value, label, max = 255, required = false) {
  const s = String(value ?? '').trim()
  if ((required && !s) || s.length > max) fail(`${label}: revisa el contenido (máximo ${max} caracteres).`)
  return s
}
function calculate(body) {
  if (!Array.isArray(body.detalles) || body.detalles.length > 150) fail('Agrega hasta 150 líneas.')
  const global = body.mano_obra_global !== null && body.mano_obra_global !== undefined && body.mano_obra_global !== ''
    ? cents(body.mano_obra_global, 'Mano de obra') : null
  const detalles = body.detalles.map(d => {
    if (!['servicio', 'repuesto', 'material'].includes(d.tipo_linea)) fail('Tipo de línea inválido.')
    const cantidad = number(d.cantidad, 'Cantidad', { positive: true })
    if (cantidad > 99999 || Math.abs(cantidad * 100 - Math.round(cantidad * 100)) > 0.000001) fail('Cantidad: usa hasta dos decimales y un máximo de 99999.')
    const precio = cents(d.precio_unitario, 'Precio')
    if (typeof d.aplica_iva !== 'boolean') fail('Indica si la línea aplica IVA.')
    const base = global !== null && d.tipo_linea === 'servicio' ? 0 : Math.round(cantidad * precio)
    return { tipo_linea: d.tipo_linea, descripcion: text(d.descripcion, 'Descripción', 255, true), cantidad,
      precio_unitario: global !== null && d.tipo_linea === 'servicio' ? 0 : precio / 100,
      aplica_iva: global !== null && d.tipo_linea === 'servicio' ? false : d.aplica_iva,
      base: base / 100, impuesto: (d.aplica_iva ? Math.round(base * 0.15) : 0) / 100 }
  })
  const subtotal = detalles.reduce((s, d) => s + Math.round(d.base * 100), global ?? 0)
  const iva = detalles.reduce((s, d) => s + Math.round(d.impuesto * 100), global === null ? 0 : Math.round(global * 0.15))
  if (subtotal + iva > 9999999999) fail('El total supera el límite permitido.')
  return { detalles, mano_obra_global: global === null ? null : global / 100, subtotal: subtotal / 100, iva: iva / 100, total: (subtotal + iva) / 100 }
}
async function context(conn, id) {
  number(id, 'Vehículo', { positive: true, integer: true })
  const [[row]] = await conn.query(`SELECT v.*, c.nombre AS cliente, c.cedula, c.telefono FROM vehiculo v JOIN cliente c ON c.id=v.id_cliente WHERE v.id=?`, [id])
  if (!row) fail('Vehículo no encontrado.', 404)
  return row
}
function quotationData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Completa los datos de la cotización.')
  const limits = {cliente:150,cedula:20,telefono:20,municipio_residencia:100,direccion:255,placa:20,marca:50,vehiculo:50,anio:4,color:50,chasis:50,motor:50}
  const data = {}
  for (const [key,max] of Object.entries(limits)) {
    if (value[key] != null && typeof value[key] !== 'string' && typeof value[key] !== 'number') fail(`Dato inválido: ${key}`)
    data[key] = text(value[key], key, max, ['cliente','placa','marca','vehiculo'].includes(key))
  }
  // Quotes may be incomplete, but whatever is written must have a valid format.
  data.cliente = rules.personName(data.cliente, { label: 'Nombre del cliente' })
  data.placa = rules.plate(data.placa)
  data.cedula = rules.cedula(data.cedula, { required: false })
  data.telefono = rules.phone(data.telefono, { required: false })
  data.chasis = rules.serial(data.chasis, { label: 'Chasis' })
  data.motor = rules.serial(data.motor, { label: 'Motor' })
  return data
}
function snapshot(v) {
  return { cliente: v.cliente, cedula: v.cedula, telefono: v.telefono, vehiculo: v.modelo, marca: v.marca, placa: v.matricula, anio: String(v.anio_fabricacion), id_cliente: v.id_cliente }
}
async function read(conn, id, lock = false) {
  number(id, 'Proforma', { positive: true, integer: true })
  const [[p]] = await conn.query(`SELECT * FROM presupuesto WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [id])
  if (!p) fail('Proforma no encontrada.', 404)
  const [[meta]] = await conn.query('SELECT * FROM proforma_documento WHERE id_presupuesto=?', [id])
  const [detalles] = await conn.query('SELECT * FROM presupuesto_detalle WHERE id_presupuesto=? ORDER BY id', [id])
  const [ordenes] = await conn.query('SELECT id FROM orden WHERE id_presupuesto=? ORDER BY id', [id])
  const v = p.id_vehiculo ? await context(conn, p.id_vehiculo) : null
  const [versiones] = await conn.query("SELECT version, DATE_FORMAT(emitida,'%Y-%m-%dT%H:%i:%sZ') AS emitida, JSON_UNQUOTE(JSON_EXTRACT(documento,'$.actualizada_desde_orden')) AS desde_orden FROM proforma_version WHERE id_presupuesto=? ORDER BY version DESC", [id])
  return { ...p, numero: meta?.numero ?? null, version: meta?.version ?? 0, fase: meta?.fase ?? 'anterior',
    es_cotizacion: !!meta?.es_cotizacion,
    seguro: meta?.seguro ?? (!v || v.aseguradora === 'ninguna' ? 'PARTICULAR' : v.aseguradora.toUpperCase()),
    tramite: meta?.tramite ?? '', reclamo: meta?.reclamo ?? '', mano_obra_global: meta?.mano_obra_global ?? null,
    datos: meta ? json(meta.datos) : snapshot(v), detalles: detalles.map(d => ({ ...d, aplica_iva: !!d.aplica_iva })),
    versiones, ordenes: ordenes.map(o => o.id), vehiculo_actual: v }
}
async function audit(conn, user, id, action, detail) {
  await conn.query('INSERT INTO auditoria (id_usuario,tabla,id_registro,accion,detalle) VALUES (?,\'presupuesto\',?,?,?)', [user, id, action, detail])
}
async function nextNumber(conn) {
  const [[row]] = await conn.query('SELECT siguiente FROM proforma_secuencia WHERE id=1 FOR UPDATE')
  if (!row || row.siguiente >= 2147483647) fail('Revisa la numeración de proformas.', 409)
  await conn.query('UPDATE proforma_secuencia SET siguiente=siguiente+1 WHERE id=1')
  return row.siguiente
}
async function save(conn, id, body, user) {
  const prior = id ? await read(conn, id, true) : null
  const quotation = prior ? prior.es_cotizacion : body.es_cotizacion === true
  const totals = calculate(body)
  const fecha = text(body.fecha, 'Fecha', 10, true)
  const parsedDate = new Date(`${fecha}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== fecha) fail('Fecha inválida.')
  const seguro = text(body.seguro, 'Aseguradora', 100, true).toUpperCase()
  const tramite = seguro === 'LAFISE' ? rules.claim(body.tramite, { label: 'Número de trámite de LAFISE', required: !quotation }) : ''
  const reclamo = seguro === 'INISER' ? rules.claim(body.reclamo, { label: 'Número de reclamo de INISER', required: !quotation }) : ''
  const obs = text(body.observaciones, 'Observaciones', 4000)
  const vehicle = quotation ? null : await context(conn, body.id_vehiculo)
  let version = 1, datos = quotation ? quotationData(body.datos || (body.id_vehiculo ? snapshot(await context(conn, body.id_vehiculo)) : {})) : snapshot(vehicle)
  const vehicleId = quotation ? null : body.id_vehiculo
  if (id) {
    const old = await read(conn, id, true)
    if (old.ordenes.length) fail('Esta proforma ya tiene una orden. Sus datos se conservan; crea otra proforma para un nuevo trabajo.', 409)
    if (Number(body.version) !== old.version) fail('La proforma cambió en otra sesión. Vuelve a abrirla antes de guardar.', 409)
    if (old.fase === 'anulada') fail('No se puede editar una proforma anulada.', 409)
    if (!quotation && old.numero && Number(body.id_vehiculo) !== old.id_vehiculo) fail('Una proforma numerada no puede cambiar de vehículo.', 409)
    if (!quotation) datos = Number(body.id_vehiculo) === old.id_vehiculo ? old.datos : datos
    version = old.version + 1
    await conn.query("UPDATE presupuesto SET id_vehiculo=?, fecha=?, estado='pendiente', subtotal=?, iva=?, total=?, observaciones=? WHERE id=?", [vehicleId, fecha, totals.subtotal, totals.iva, totals.total, obs, id])
    await conn.query('DELETE FROM presupuesto_detalle WHERE id_presupuesto=?', [id])
  } else {
    const key = text(body.solicitud, 'Identificador de guardado', 64, true)
    // Serializes creates and retries, including concurrent requests with the same key.
    await conn.query('SELECT siguiente FROM proforma_secuencia WHERE id=1 FOR UPDATE')
    const [[existing]] = await conn.query('SELECT id_presupuesto FROM proforma_documento WHERE solicitud=?', [key])
    if (existing) return read(conn, existing.id_presupuesto)
    const [result] = await conn.query("INSERT INTO presupuesto (id_vehiculo,fecha,estado,subtotal,iva,total,observaciones) VALUES (?,?,'pendiente',?,?,?,?)", [vehicleId, fecha, totals.subtotal, totals.iva, totals.total, obs])
    id = result.insertId
  }
  await conn.query(`INSERT INTO proforma_documento (id_presupuesto,version,fase,seguro,tramite,reclamo,mano_obra_global,datos,solicitud,creado_por)
    VALUES (?,?,'borrador',?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version), fase='borrador', seguro=VALUES(seguro), tramite=VALUES(tramite), reclamo=VALUES(reclamo), mano_obra_global=VALUES(mano_obra_global), datos=VALUES(datos), actualizado=CURRENT_TIMESTAMP`,
    [id, version, seguro, tramite, reclamo, totals.mano_obra_global, JSON.stringify(datos), body.solicitud || null, user])
  await conn.query('UPDATE proforma_documento SET es_cotizacion=? WHERE id_presupuesto=?', [quotation, id])
  for (const d of totals.detalles) await conn.query('INSERT INTO presupuesto_detalle (id_presupuesto,tipo_linea,descripcion,cantidad,precio_unitario,aplica_iva) VALUES (?,?,?,?,?,?)', [id, d.tipo_linea, d.descripcion, d.cantidad, d.precio_unitario, d.aplica_iva])
  await audit(conn, user, id, version === 1 ? 'crear' : 'editar', `Proforma v${version}: guardado completo; total ${totals.total}`)
  return read(conn, id)
}
async function emit(conn, id, version, user) {
  const p = await read(conn, id, true)
  if (p.version !== Number(version)) fail('La proforma cambió. Actualiza la pantalla.', 409)
  if (p.fase === 'anterior') fail('Revisa y guarda el presupuesto anterior antes de emitirlo.', 409)
  if (p.fase === 'anulada') fail('La proforma está anulada.', 409)
  if (p.fase !== 'borrador') return p
  if (!p.es_cotizacion && p.seguro === 'LAFISE') rules.claim(p.tramite, { label: 'Número de trámite de LAFISE (complétalo en Editar)' })
  if (!p.es_cotizacion && p.seguro === 'INISER') rules.claim(p.reclamo, { label: 'Número de reclamo de INISER (complétalo en Editar)' })
  if (!p.detalles.length || Number(p.total) <= 0) fail('Agrega trabajos o repuestos y un total mayor que cero antes de emitir.')
  const numero = p.numero ?? await nextNumber(conn)
  const documento = { ...p, numero, fase: 'emitida' }
  delete documento.vehiculo_actual
  await conn.query("UPDATE proforma_documento SET numero=?, fase='emitida', actualizado=CURRENT_TIMESTAMP WHERE id_presupuesto=?", [numero, id])
  await conn.query('INSERT INTO proforma_version (id_presupuesto,version,documento,creado_por,emitida) VALUES (?,?,?,?,UTC_TIMESTAMP())', [id, p.version, JSON.stringify(documento), user])
  await audit(conn, user, id, 'cambio_estado', `Emitida proforma ${numero}, versión ${p.version}`)
  return read(conn, id)
}
async function changeState(conn, id, body, user) {
  const p = await read(conn, id, true)
  if (p.version !== Number(body.version)) fail('La proforma cambió. Actualiza la pantalla.', 409)
  const fase = body.fase
  if (!['aprobada', 'rechazada', 'anulada'].includes(fase)) fail('Estado inválido.')
  if (p.ordenes.length || p.fase === 'anulada') fail('Esta proforma está cerrada para cambios.', 409)
  if (fase !== 'anulada' && !(p.es_cotizacion && p.fase === 'borrador') && !['emitida', 'aprobada', 'rechazada'].includes(p.fase)) fail('Emite la versión actual antes de cambiar su estado.', 409)
  if (fase === 'aprobada' && (!p.detalles.length || Number(p.total) <= 0)) fail('Completa los trabajos y un total mayor que cero antes de aceptar el presupuesto.')
  const motivo = text(body.motivo, 'Motivo', 500, fase === 'anulada')
  await conn.query('UPDATE proforma_documento SET fase=?,actualizado=CURRENT_TIMESTAMP WHERE id_presupuesto=?', [fase, id])
  await conn.query('UPDATE presupuesto SET estado=? WHERE id=?', [fase === 'aprobada' ? 'aprobado' : 'rechazado', id])
  await audit(conn, user, id, 'cambio_estado', `${fase}: ${motivo}`)
  return read(conn, id)
}
async function convert(conn, id, body, user) {
  const p = await read(conn, id, true)
  const [[converted]] = await conn.query('SELECT id_orden FROM proforma_conversion WHERE id_presupuesto=?', [id])
  if (converted) { const [[order]] = await conn.query('SELECT * FROM orden WHERE id=?', [converted.id_orden]); return {...order,matricula:p.datos.placa,nombre_cliente:p.datos.cliente} }
  if (p.ordenes.length) fail('El presupuesto ya está vinculado a una orden.', 409)
  if (p.fase !== 'aprobada' || Number(body.version) !== p.version) fail('Aprueba la versión actual antes de crear la orden.', 409)
  if (p.es_cotizacion && !p.id_vehiculo) {
    const vehicleId = body.registrar_desde_cotizacion === true ? await require('./quotationRegistration').register(conn, p, body.datos_alta) : body.id_vehiculo
    const selected = await context(conn, vehicleId)
    p.id_vehiculo = selected.id
    await conn.query('UPDATE presupuesto SET id_vehiculo=? WHERE id=?', [selected.id,id])
  }
  if (!['pintura','mecanica','mantenimiento'].includes(body.tipo)) fail('Selecciona el tipo de trabajo.')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.fecha_ingreso || '') || !Number.isFinite(Date.parse(body.fecha_ingreso))) fail('Fecha de ingreso inválida.')
  validateDates(body)
  const insured = p.seguro !== 'PARTICULAR'
  // Existing payment module only supports these insurers; never silently map another to a private payer.
  if (insured && !['LAFISE', 'INISER'].includes(p.seguro)) fail('Esta aseguradora puede cotizarse e imprimirse, pero los cobros del taller aún admiten solo LAFISE e INISER. No se creará una orden con un pagador incorrecto.', 409)
  const tramite = insured ? rules.claim(body.numero_tramite || (p.seguro === 'INISER' ? p.reclamo : p.tramite || p.reclamo), { label: p.seguro === 'INISER' ? 'Número de reclamo de INISER' : 'Número de trámite de LAFISE' }) : ''
  const seguroOrden = text(body.numero_orden_seguro, 'Orden del seguro', 50)
  if (body.id_orden_origen || body.danos_ocultos_inicial) fail('Para garantías o daños ocultos, crea una orden derivada sin convertir esta proforma.')
  const total = cents(p.total), cliente = insured ? 0 : total
  const seguro = insured ? total : 0
  if (insured && body.monto_cliente != null && cents(body.monto_cliente) !== 0) fail('Las nuevas órdenes con seguro se cobran por completo a la aseguradora.')
  const entrega = body.fecha_entrega_estimada || null
  if (entrega && (!/^\d{4}-\d{2}-\d{2}$/.test(entrega) || !Number.isFinite(Date.parse(entrega)))) fail('Fecha de entrega inválida.')
  const [result] = await conn.query(`INSERT INTO orden (id_vehiculo,id_presupuesto,tipo,fecha_ingreso,estado,tipo_pago,subtotal,iva,costo_total,monto_cliente,monto_seguro,numero_tramite,numero_orden_seguro,creado_por,cargos_desde_proforma,pagador_unico) VALUES (?,?,?,?,'recibido',?,?,?,?,?,?,?,?,?,TRUE,TRUE)`,
    [p.id_vehiculo,id,body.tipo,body.fecha_ingreso,insured ? p.seguro.toLowerCase() : 'particular',p.subtotal,p.iva,p.total,cliente/100,seguro/100,tramite,seguroOrden,user])
  const orderId = result.insertId
  await conn.query('UPDATE orden SET fecha_entrega_estimada=?,obra_externa=?,obra_interna=?,es_garantia=?,fecha_vencimiento_garantia=? WHERE id=?', [entrega,!!body.obra_externa,!!body.obra_interna,!!body.es_garantia,body.es_garantia ? body.fecha_vencimiento_garantia || null : null,orderId])
  const calculation = calculate(p)
  for (const d of calculation.detalles) {
    await conn.query('INSERT INTO orden_servicio (id_orden,descripcion,precio,aplica_iva,tipo_linea) VALUES (?,?,?,?,?)', [orderId, text(`${d.cantidad} × ${d.descripcion}`, 'Descripción de cargo', 255), d.base, d.aplica_iva, d.tipo_linea])
  }
  if (p.mano_obra_global !== null) await conn.query('INSERT INTO orden_servicio (id_orden,descripcion,precio,aplica_iva) VALUES (?,?,?,TRUE)', [orderId, `Mano de obra · Presupuesto ${p.numero || p.id} (ver detalle en documento)`, p.mano_obra_global])
  await conn.query('INSERT INTO proforma_conversion (id_presupuesto,id_orden,version) VALUES (?,?,?)', [id, orderId, p.version])
  await audit(conn, user, id, 'cambio_estado', `Convertida en orden ${orderId}; cargos copiados una vez; inventario sin movimientos.`)
  const [[order]] = await conn.query('SELECT * FROM orden WHERE id=?', [orderId])
  return {...order,matricula:p.datos.placa,nombre_cliente:p.datos.cliente}
}
module.exports = { quotationData, calculate, context, read, save, emit, changeState, convert, nextNumber, audit, json, text }
