const test = require('node:test')
const assert = require('node:assert/strict')
const calculate = require('../src/services/privateWork')
const work = { tipo_linea: 'servicio', descripcion: 'Pintura', cantidad: 2, precio_unitario: 100, aplica_iva: true }
test('private global labor charges once and keeps parts quantities', () => {
  const result = calculate({ mano_obra_global: 1000, detalles: [work, { ...work, tipo_linea: 'repuesto', aplica_iva: false }], observaciones: ' Revisar ' })
  assert.equal(result.total, 1350)
  assert.equal(result.activities[0].precio, 0)
  assert.equal(result.activities[1].precio, 200)
  assert.equal(result.activities[2].precio, 1000)
  assert.equal(result.observaciones, 'Revisar')
})
test('per-work charges quantities and IVA without global surcharge', () => {
  const result = calculate({ mano_obra_global: null, detalles: [work] })
  assert.equal(result.total, 230)
  assert.equal(result.activities.length, 1)
})
test('private work requires an activity and valid descriptions', () => {
  for (const detalles of [[], [null], [{ ...work, tipo_linea: 'repuesto' }], [{ ...work, descripcion: '' }]]) assert.throws(() => calculate({ detalles }), error => error.status === 400)
})
