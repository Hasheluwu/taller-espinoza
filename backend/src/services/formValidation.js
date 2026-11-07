// backend/src/services/formValidation.js
const { fail, number } = require('./validation')
const { date } = require('./workshop')
const rules = require('./fieldRules')

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Managua' })

function text(value, label, max, required = true) {
  if (!required && (value == null || value === '')) return ''
  if (typeof value !== 'string') fail(`${label}: ingresa texto válido.`)
  const result = value.trim()
  if ((required && !result) || result.length > max) {
    fail(`${label}: es obligatorio y admite hasta ${max} caracteres.`)
  }
  return result
}

function client(body) {
  body.nombre = rules.personName(body.nombre, { label: 'Nombre del cliente' })
  body.cedula = rules.cedula(body.cedula || body.numero_documento)
  body.telefono = rules.phone(body.telefono)
  body.municipio_residencia = text(body.municipio_residencia || body.municipio || 'Managua', 'Municipio', 100)
  body.direccion = text(body.direccion, 'Dirección', 255, false)
  if (body.fecha_nacimiento && date(body.fecha_nacimiento, 'Fecha de nacimiento') > today()) {
    fail('La fecha de nacimiento no puede estar en el futuro.')
  }
}

function vehicle(body) {
  number(body.id_cliente, 'Cliente', { positive: true, integer: true })
  body.matricula = rules.plate(body.matricula)
  for (const [key, label, max] of [
    ['marca', 'Marca', 80],
    ['modelo', 'Modelo', 80],
    ['color', 'Color', 50],
  ]) {
    body[key] = text(body[key], label, max)
  }
  body.chasis = rules.serial(body.chasis, { label: 'Chasis' })
  body.motor = rules.serial(body.motor, { label: 'Motor' })
  const year = number(body.anio_fabricacion, 'Año de fabricación', { integer: true })
  if (year < 1950 || year > Number(today().slice(0, 4)) + 1) {
    fail('Año de fabricación: usa un año entre 1950 y el próximo año modelo.')
  }
  if (!['ninguna', 'lafise', 'iniser'].includes(body.aseguradora)) {
    fail('Selecciona Particular, LAFISE o INISER.')
  }
}

function middleware(validate) {
  return (req, res, next) => {
    try {
      if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
        fail('Completa los datos del formulario.')
      }
      validate(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }
}

module.exports = { text, client, vehicle, middleware, today }