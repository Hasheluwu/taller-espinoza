// Format rules for Nicaraguan data. Each rule validates, normalizes and returns the stored value.
// An optional empty field returns '' ; a required empty field fails with a clear message.
const { fail } = require('./validation')

const empty = value => value === undefined || value === null || String(value).trim() === ''
function start(value, label, required) {
  if (empty(value)) { if (required) fail(`${label}: es obligatorio.`); return null }
  if (typeof value !== 'string' && typeof value !== 'number') fail(`${label}: ingresa un valor válido.`)
  return String(value).trim()
}

// Mobile (5, 7, 8) or landline (2), 8 digits, optional +505. Stored as 8888-1234.
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

// Nicaraguan cédula: 3 digits, birth date DDMMYY, 4 digits and a letter. Stored as 001-010190-0001A.
function cedula(value, { label = 'Cédula', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const match = raw.toUpperCase().replace(/[\s-]/g, '').match(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{4})([A-Z])$/)
  if (!match) fail(`${label}: usa el formato 001-010190-0001A (3 números, fecha de nacimiento, 4 números y una letra).`)
  const [, place, dd, mm, yy, serial, letter] = match
  const valid = century => { const d = new Date(Date.UTC(century + Number(yy), Number(mm) - 1, Number(dd))); return d.getUTCDate() === Number(dd) && d.getUTCMonth() === Number(mm) - 1 }
  if (Number(mm) < 1 || Number(mm) > 12 || !(valid(1900) || valid(2000))) fail(`${label}: los números ${dd}${mm}${yy} no son una fecha de nacimiento válida (día, mes y año).`)
  return `${place}-${dd}${mm}${yy}-${serial}${letter}`
}

// Plate: 1 to 3 letters and 3 to 6 digits. Stored as M-123456.
function plate(value, { label = 'Matrícula', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const match = raw.toUpperCase().replace(/[\s-]/g, '').match(/^([A-Z]{1,3})(\d{3,6})$/)
  if (!match) fail(`${label}: usa letras y números de la placa (ej. M 123456 o MT 12345).`)
  return `${match[1]}-${match[2]}`
}

// Insurer claim (INISER) or procedure (LAFISE) number: digits only.
function claim(value, { label = 'Número de trámite', required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const digits = raw.replace(/\s/g, '')
  if (!/^\d{4,20}$/.test(digits)) fail(`${label}: usa solo números, entre 4 y 20 dígitos.`)
  return digits
}

// Person's name: letters, spaces, dots, apostrophes and hyphens.
function personName(value, { label = 'Nombre', max = 150, required = true } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const name = raw.replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > max) fail(`${label}: escribe entre 3 y ${max} caracteres.`)
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) fail(`${label}: usa solo letras y espacios, sin números.`)
  return name
}

// Chassis (VIN) or engine number: letters, digits and hyphens. Stored in uppercase.
function serial(value, { label = 'Chasis', required = false } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  const text = raw.toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z0-9-]{4,30}$/.test(text)) fail(`${label}: usa letras y números, entre 4 y 30 caracteres.`)
  return text
}

// Receipt, invoice or bank reference: letters, digits and - / # .
function reference(value, { label = 'Referencia', max = 30, required = false } = {}) {
  const raw = start(value, label, required)
  if (raw === null) return ''
  if (raw.length > max) fail(`${label}: admite hasta ${max} caracteres.`)
  if (!/^[\p{L}\d][\p{L}\d \-/#.]*$/u.test(raw)) fail(`${label}: usa letras, números, guiones o barras.`)
  return raw.toUpperCase()
}

module.exports = { phone, cedula, plate, claim, personName, serial, reference }
