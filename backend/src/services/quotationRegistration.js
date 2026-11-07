// backend/src/services/quotationRegistration.js
const { client, vehicle } = require('./formValidation')
const { fail } = require('./validation')
const {
  detectTipoDocumentoId,
  ensureMunicipioId,
  ensureModeloId,
  aseguradoraToId,
} = require('./catalogs')

async function register(conn, quote, supplied = {}) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
    fail('Completa los datos faltantes.')
  }
  const data = { ...quote.datos }
  for (const key of [
    'cliente',
    'cedula',
    'telefono',
    'municipio_residencia',
    'direccion',
    'placa',
    'marca',
    'vehiculo',
    'anio',
    'color',
    'chasis',
    'motor',
  ]) {
    if (supplied[key] !== undefined) data[key] = supplied[key]
  }
  const person = {
    nombre: data.cliente,
    cedula: data.cedula,
    telefono: data.telefono,
    municipio_residencia: data.municipio_residencia || 'Managua',
    direccion: data.direccion,
  }
  client(person)

  let [[existing]] = await conn.query(
    'SELECT id_cliente AS id FROM cliente WHERE numero_documento = ? FOR UPDATE',
    [person.cedula]
  )
  if (!existing) {
    const idMun = await ensureMunicipioId(conn, person.municipio_residencia)
    const idTipoDoc = detectTipoDocumentoId(person.cedula)
    const [result] = await conn.query(
      `INSERT INTO cliente (id_tipo_documento, numero_documento, nombre, telefono, id_municipio, direccion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idTipoDoc, person.cedula, person.nombre, person.telefono, idMun, person.direccion || null]
    )
    existing = { id: result.insertId }
  }

  const car = {
    id_cliente: existing.id,
    matricula: data.placa,
    marca: data.marca,
    modelo: data.vehiculo,
    anio_fabricacion: data.anio,
    color: data.color || 'Blanco',
    chasis: data.chasis,
    motor: data.motor,
    aseguradora: quote.seguro === 'PARTICULAR' ? 'ninguna' : quote.seguro.toLowerCase(),
  }
  vehicle(car)

  let [[saved]] = await conn.query('SELECT matricula, id_cliente FROM vehiculo WHERE matricula = ? FOR UPDATE', [
    car.matricula,
  ])
  if (!saved) {
    const idModelo = await ensureModeloId(conn, car.marca, car.modelo)
    await conn.query(
      `INSERT INTO vehiculo (matricula, id_cliente, id_modelo, anio_fabricacion, color, chasis, motor)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        car.matricula,
        car.id_cliente,
        idModelo,
        car.anio_fabricacion,
        car.color,
        car.chasis || null,
        car.motor || null,
      ]
    )
    const idAseg = aseguradoraToId(car.aseguradora)
    if (idAseg) {
      await conn.query('INSERT IGNORE INTO vehiculo_aseguradora (matricula, id_aseguradora) VALUES (?, ?)', [
        car.matricula,
        idAseg,
      ])
    }
    saved = { matricula: car.matricula, id_cliente: car.id_cliente }
  }

  if (Number(saved.id_cliente) !== Number(existing.id)) {
    fail(
      'La matrícula ya pertenece a otro cliente. Revisa la cédula y matrícula de la cotización antes de crear la orden.',
      409
    )
  }
  return saved.matricula
}

module.exports = { register }