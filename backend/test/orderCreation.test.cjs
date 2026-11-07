const test = require('node:test')
const assert = require('node:assert/strict')
const { validateDates, requestKey } = require('../src/services/orderCreation')
test('delivery accepts same calendar day even after midnight and warranty is optional', () => {
  validateDates({ fecha_ingreso: '2026-11-04T23:59', fecha_entrega_estimada: '2026-11-04' })
  validateDates({ fecha_ingreso: '2028-02-29T00:00', fecha_vencimiento_garantia: '2028-03-01' })
})
test('dates reject impossible dates, invalid hours and chronology', () => {
  for (const fecha_ingreso of ['2026-02-29T10:00', '2026-11-04T24:00', '2026-11-04T10:60', 'bad']) assert.throws(() => validateDates({ fecha_ingreso }), e => e.status === 400)
  for (const key of ['fecha_entrega_estimada','fecha_vencimiento_garantia']) assert.throws(() => validateDates({ fecha_ingreso: '2026-11-04T10:00', [key]: '2026-11-03' }), /anterior/)
})
test('missing or malformed save keys cannot silently create unprotected orders', () => {
  for (const key of [undefined, '', 'short', {}, 'x'.repeat(65)]) assert.throws(() => requestKey(key), e => e.status === 400)
  assert.equal(requestKey('test-request-1234'),'test-request-1234')
})
