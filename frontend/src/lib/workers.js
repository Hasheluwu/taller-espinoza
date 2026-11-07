export const ROLE_LABELS = { pintor: 'Pintor', enderezador: 'Enderezador', mecanico: 'Mecánico', otro: 'Otro' }
export const TYPE_LABELS = { interno: 'Interno', externo: 'Externo' }

let next = 0
export const emptyWorkerRow = () => ({ key: `w${++next}`, id_personal: '', monto_acordado: '' })

// Rows with a chosen worker, ready for the API. Amount '' means "no labor charge".
export function workersPayload(rows, { requireAmount = false } = {}) {
  const list = rows.filter(row => row.id_personal)
  if (rows.some(row => !row.id_personal && row.monto_acordado !== '')) throw new Error('Elige el trabajador de cada monto que escribiste.')
  for (const row of list) {
    if (requireAmount && row.monto_acordado === '') throw new Error('Escribe el monto acordado de cada trabajador.')
    if (row.monto_acordado !== '' && !(Number(row.monto_acordado) >= 0)) throw new Error('Revisa los montos acordados: deben ser números positivos.')
  }
  return list.map(row => ({ id_personal: Number(row.id_personal), monto_acordado: row.monto_acordado }))
}
