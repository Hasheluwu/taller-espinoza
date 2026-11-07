// backend/src/services/fieldRules.js
const { fail } = require('./validation')

const empty = value => value === undefined || value === null || String(value).trim() === ''
function start(value, label, required) {
  if (empty(value)) {
    if (required) fail(`${label}: es obligatorio.`)
    return null
  }
  if (typeof value !== 'string' && typeof value !== 'number') fail(`${label}: ingresa un valor válido.`)
  return String(value).trim()
}

function phone(value, { label = 'Teléfono', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  if (!/^[+\d\s().-]+$/.test(raw)) fail(`${label}: usa solo números, espacios o guiones.`)
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('505')) digits = digits.slice(3)
  if (digits.length !== 8) fail(`${label}: debe tener 8 dígitos (ej. 8888-1234).`)
  if (!/^[2578]/.test(digits)) fail(`${label}: los números de Nicaragua empiezan con 2 (fijo) o con 5, 7 u 8 (celular).`)
  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}

// Soporta Cédula (001-150585-0023A), RUC (J0310000456789), Residencia (RES-00991122) y Pasaporte (US-998877665)
function cedula(value, { label = 'Documento / Cédula', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const upper = raw.toUpperCase().trim()

  // Caso 1: RUC (ej. J0310000456789)
  if (/^J\d{10,14}$/.test(upper.replace(/[\s-]/g, ''))) {
    return upper.replace(/[\s-]/g, '')
  }
  // Caso 2: Cédula de Residencia o Pasaporte (ej. RES-00991122, US-998877665)
  if (/^(RES|[A-Z]{1,3})-[A-Z0-9]{5,15}$/.test(upper)) {
    return upper
  }

  // Caso 3: Cédula nicaragüense estándar
  const match = upper.replace(/[\s-]/g, '').match(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{4})([A-Z])$/)
  if (!match) {
    fail(`${label}: usa formato de Cédula (001-010190-0001A), RUC (J0310000456789) o Pasaporte/Residencia.`)
  }
  const [, place, dd, mm, yy, serial, letter] = match
  const valid = century => {
    const d = new Date(Date.UTC(century + Number(yy), Number(mm) - 1, Number(dd)))
    return d.getUTCDate() === Number(dd) && d.getUTCMonth() === Number(mm) - 1
  }
  if (Number(mm) < 1 || Number(mm) > 12 || !(valid(1900) || valid(2000))) {
    fail(`${label}: los números ${dd}${mm}${yy} no son una fecha de nacimiento válida.`)
  }
  return `${place}-${dd}${mm}${yy}-${serial}${letter}`
}

// Matrícula normalizada con espacio (ej. M 111001, MY 444004) como en el modelo v7
function plate(value, { label = 'Matrícula', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const match = raw.toUpperCase().replace(/[\s-]/g, '').match(/^([A-Z]{1,3})(\d{3,6})$/)
  if (!match) fail(`${label}: usa letras y números de la placa (ej. M 123456 o MY 444004).`)
  return `${match[1]} ${match[2]}`
}

function claim(value, { label = 'Número de trámite', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const clean = raw.trim().toUpperCase()
  if (!/^[A-Z0-9-]{4,50}$/.test(clean)) {
    fail(`${label}: usa entre 4 y 50 caracteres alfanuméricos o guiones.`)
  }
  return clean
}

function personName(value, { label = 'Nombre', max = 150, required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const name = raw.replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > max) fail(`${label}: escribe entre 3 y ${max} caracteres.`)
  if (!/^[\p{L}\d][\p{L}\d .,'&-]*$/u.test(name)) fail(`${label}: contiene caracteres inválidos.`)
  return name
}

function serial(value, { label = 'Chasis', required = false } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const text = raw.toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z0-9-]{4,50}$/.test(text)) fail(`${label}: usa letras, números o guiones (4 a 50 caracteres).`)
  return text
}

function reference(value, { label = 'Referencia', max = 50, required = false } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  if (raw.length > max) fail(`${label}: admite hasta ${max} caracteres.`)
  if (!/^[\p{L}\d][\p{L}\d \-/#.]*$/u.test(raw)) fail(`${label}: usa letras, números, guiones o barras.`)
  return raw.toUpperCase()
}

module.exports = { phone, cedula, plate, claim, personName, serial, reference }