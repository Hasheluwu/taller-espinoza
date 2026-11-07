// Los 15 departamentos y las 2 regiones autónomas de Nicaragua.
export const DEPARTAMENTOS = [
  'Boaco', 'Carazo', 'Chinandega', 'Chontales', 'Costa Caribe Norte', 'Costa Caribe Sur', 'Estelí', 'Granada', 'Jinotega',
  'León', 'Madriz', 'Managua', 'Masaya', 'Matagalpa', 'Nueva Segovia', 'Río San Juan', 'Rivas',
]

// Lowercase without accents, so "leon" finds "León" and "mana" finds "Managua".
export const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function findDepartamento(text) {
  const key = plain(text)
  return DEPARTAMENTOS.find(name => plain(name) === key) || null
}

// Names starting with the text first, then names containing it.
export function searchDepartamentos(text) {
  const q = plain(text)
  if (!q) return DEPARTAMENTOS
  const rank = name => { const key = plain(name); return key.startsWith(q) ? 0 : key.split(' ').some(word => word.startsWith(q)) ? 1 : key.includes(q) ? 2 : 9 }
  return DEPARTAMENTOS.filter(name => rank(name) < 9).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'es'))
}
