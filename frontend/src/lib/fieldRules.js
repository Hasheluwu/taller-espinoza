// Same rules as backend/src/services/fieldRules.js, for instant feedback while typing.
// format(): tidies the text as it is typed. check(): '' when valid, otherwise the message.

const validBirth = (dd, mm, yy) => [1900, 2000].some(c => { const d = new Date(Date.UTC(c + Number(yy), Number(mm) - 1, Number(dd))); return d.getUTCDate() === Number(dd) && d.getUTCMonth() === Number(mm) - 1 })

export const RULES = {
  phone: {
    placeholder: 'Ej: 8888-1234', inputMode: 'tel', maxLength: 16,
    format(v) {
      let d = v.replace(/\D/g, '')
      if (d.length > 8 && d.startsWith('505')) d = d.slice(3)
      d = d.slice(0, 8)
      return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d
    },
    check(v, label = 'Teléfono') {
      const d = v.replace(/\D/g, '')
      if (d.length !== 8) return `${label}: debe tener 8 dígitos (ej. 8888-1234).`
      if (!/^[2578]/.test(d)) return `${label}: empieza con 2 (fijo) o con 5, 7 u 8 (celular).`
      return ''
    },
  },
  cedula: {
    placeholder: 'Ej: 001-010190-0001A', maxLength: 16,
    format(v) {
      const c = v.toUpperCase().replace(/[^0-9A-Z]/g, '')
      const digits = c.replace(/[A-Z]/g, '').slice(0, 13)
      const letter = c.length > 13 && /[A-Z]$/.test(c) ? c.slice(-1) : ''
      return [digits.slice(0, 3), digits.slice(3, 9), digits.slice(9, 13) + letter].filter(Boolean).join('-')
    },
    check(v, label = 'Cédula') {
      const m = v.toUpperCase().replace(/[\s-]/g, '').match(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{4})([A-Z])$/)
      if (!m) return `${label}: usa el formato 001-010190-0001A.`
      if (Number(m[3]) < 1 || Number(m[3]) > 12 || !validBirth(m[2], m[3], m[4])) return `${label}: la fecha de nacimiento ${m[2]}/${m[3]}/${m[4]} no es válida.`
      return ''
    },
  },
  plate: {
    placeholder: 'Ej: M 123456', maxLength: 12,
    format: v => v.toUpperCase().replace(/[^A-Z0-9 -]/g, ''),
    check: (v, label = 'Matrícula') => /^[A-Z]{1,3}\d{3,6}$/.test(v.toUpperCase().replace(/[\s-]/g, '')) ? '' : `${label}: letras y números de la placa (ej. M 123456).`,
  },
  claim: {
    placeholder: 'Solo números', inputMode: 'numeric', maxLength: 20,
    format: v => v.replace(/\D/g, '').slice(0, 20),
    check: (v, label = 'Número') => /^\d{4,20}$/.test(v) ? '' : `${label}: solo números, entre 4 y 20 dígitos.`,
  },
  name: {
    maxLength: 150,
    format: v => v.replace(/\d/g, '').replace(/\s{2,}/g, ' '),
    check(v, label = 'Nombre') {
      const t = v.trim()
      if (t.length < 3) return `${label}: escribe al menos 3 letras.`
      return /^[\p{L}][\p{L} .'-]*$/u.test(t) ? '' : `${label}: usa solo letras y espacios.`
    },
  },
  serial: {
    maxLength: 30,
    format: v => v.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    check: (v, label = 'Número de serie') => /^[A-Z0-9-]{4,30}$/.test(v) ? '' : `${label}: letras y números, entre 4 y 30.`,
  },
  reference: {
    maxLength: 30,
    format: v => v.toUpperCase().replace(/[^\p{L}\d \-/#.]/gu, ''),
    check: (v, label = 'Referencia') => /^[\p{L}\d][\p{L}\d \-/#.]*$/u.test(v.trim()) ? '' : `${label}: letras, números, guiones o barras.`,
  },
}

// '' when the value is fine (or empty and optional), otherwise the message to show.
export function checkField(rule, value, { label, required = false } = {}) {
  const v = String(value ?? '')
  if (!v.trim()) return required ? `${label || 'Este campo'}: es obligatorio.` : ''
  return RULES[rule].check(v, label)
}
