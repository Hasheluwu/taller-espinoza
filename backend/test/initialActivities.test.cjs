const test = require('node:test')
const assert = require('node:assert/strict')
const calculate = require('../src/services/initialActivities')
test('activities total includes only selected IVA and rounds each line', () => {
  const result = calculate([{ descripcion: ' Pintura ', precio: '100.10', aplica_iva: true }, { descripcion: 'Revisión', precio: 200, aplica_iva: false }])
  assert.equal(result.total, 315.12)
  assert.equal(result.activities[0].descripcion, 'Pintura')
})
test('rejects missing activities, invalid descriptions, money and tax flags', () => {
  for (const items of [undefined, [], [null], [{ descripcion: ' ' }], [{ descripcion: 'a'.repeat(256) }], ...[-1, '', Infinity, 1.001, 999999999].map(precio => [{ descripcion: 'Trabajo', precio, aplica_iva: true }]), [{ descripcion: 'Trabajo', precio: 1, aplica_iva: 'false' }]]) {
    assert.throws(() => calculate(items), error => error.status === 400)
  }
})
test('allows a zero price for warranty work', () => {
  assert.equal(calculate([{ descripcion: 'Garantía', precio: 0, aplica_iva: false }]).total, 0)
})
