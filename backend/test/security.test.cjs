const { test } = require('node:test')
const assert = require('node:assert/strict')
const { allowedOrigin } = require('../src/middleware/security')
const { paymentDate } = require('../src/services/validation')

test('the API accepts this computer and the local network only', () => {
  for (const origin of [undefined, 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://192.168.1.20:5173', 'http://10.0.0.5:5173', 'http://172.20.1.2:5173']) assert.ok(allowedOrigin(origin, ''), origin)
  for (const origin of ['https://sitio-malicioso.example', 'http://localhost.evil.com', 'http://192.168.1.20.evil.com', 'http://172.32.0.1:5173']) assert.ok(!allowedOrigin(origin, ''), origin)
  assert.ok(allowedOrigin('https://taller.example.com', 'https://taller.example.com/, http://otro'))
})
test('payment dates must be real and not in the future', () => {
  assert.equal(paymentDate(''), null)
  assert.equal(paymentDate('2026-11-05'), '2026-11-05')
  assert.equal(paymentDate('2026-11-05T09:30'), '2026-11-05 09:30:00')
  for (const bad of ['no-es-fecha', '2026-02-30', '2026-11-05T25:00', '1999-12-31', '2099-01-01', 12345, { a: 1 }]) assert.throws(() => paymentDate(bad), /Fecha/, String(bad))
  assert.equal(paymentDate('2099-01-01', 'Fecha', { future: true }), '2099-01-01')
})
