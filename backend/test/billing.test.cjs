const { test } = require('node:test')
const assert = require('node:assert/strict')
const { calculateSummary, validatePayment } = require('../src/services/billing')
const { cents } = require('../src/services/validation')
const validateNumbers = require('../src/middleware/validateNumbers')
const particular = { id: 1, tipo_pago: 'particular', costo_total: '50000.00', estado: 'en_proceso' }
const insured = { ...particular, tipo_pago: 'lafise', monto_cliente: '10000.00', monto_seguro: '40000.00' }

test('50,000 debt: 5,000 + 3,000 + 42,000 closes and rejects more money', () => {
  const payments = [{ monto: 5000, tipo: 'adelanto' }, { monto: 3000, tipo: 'abono' }]
  let b = calculateSummary(particular, payments)
  assert.equal(b.saldo_cliente, 42000); assert.equal(b.pagado, false)
  assert.equal(validatePayment(particular, b, 42000, 'cliente'), 42000)
  b = calculateSummary(particular, [...payments, { monto: 42000, tipo: 'saldo' }])
  assert.equal(b.saldo_cliente, 0); assert.equal(b.pagado, true); assert.equal(b.puede_cobrar_cliente, false)
  assert.throws(() => validatePayment(particular, b, 1, 'cliente'), /saldo disponible/)
})
test('payment labels never create separate balances', () => {
  for (const tipo of ['abono', 'saldo', 'adelanto']) {
    assert.equal(calculateSummary(particular, [{ monto: 5000, tipo }]).saldo_cliente, 45000)
  }
})
test('excess, negative, zero, NaN and fractions of a cent rejected', () => {
  const b = calculateSummary(particular)
  for (const amount of [50000.01, -1, 0, 'abc', NaN, Infinity, .001, '', null, true]) {
    assert.throws(() => validatePayment(particular, b, amount, 'cliente'))
  }
})
test('money is accumulated in integer cents', () => {
  const order = { ...particular, costo_total: '0.30' }
  assert.equal(calculateSummary(order, [{ monto: '.10' }, { monto: '.20' }]).pagado, true)
  assert.equal(cents('50000.01'), 5000001)
})
test('client and insurer have independent balances', () => {
  const b = calculateSummary(insured, [{ monto: 10000 }], [{ monto: 5000, estado: 'recibido' }])
  assert.equal(b.cliente_pagado, true); assert.equal(b.pagado, false)
  assert.equal(b.saldo_seguro, 35000); assert.equal(b.puede_cobrar_cliente, false)
  assert.throws(() => validatePayment(insured, b, 1, 'cliente'))
})
test('pending insurance reserves capacity without counting as received', () => {
  const b = calculateSummary(insured, [{ monto: 10000 }], [{ monto: 40000, estado: 'pendiente' }])
  assert.equal(b.pagado, false); assert.equal(b.gran_total, 10000)
  assert.equal(b.saldo_seguro, 40000); assert.equal(b.disponible_seguro, 0)
  assert.throws(() => validatePayment(insured, b, 40000, 'seguro'))
  assert.equal(calculateSummary(insured, [{ monto: 10000 }], [{ monto: 40000, estado: 'recibido' }]).pagado, true)
})
test('unknown or inconsistent total/distribution blocks collections', () => {
  for (const order of [{ ...particular, costo_total: null }, { ...particular, costo_total: 0 }, { ...insured, monto_cliente: null }, { ...insured, monto_seguro: 30000 }]) {
    const b = calculateSummary(order)
    assert.equal(b.configurado, false)
    assert.throws(() => validatePayment(order, b, 100, 'cliente'))
  }
})
test('legacy overpayments are reported without changing history', () => {
  const b = calculateSummary(particular, [{ monto: 51000 }])
  assert.equal(b.excedente, 1000); assert.equal(b.puede_cobrar_cliente, false)
})

test('an insurer excess cannot hide the separate unpaid client balance', () => {
  const balance=calculateSummary({id:1,estado:'en_proceso',tipo_pago:'lafise',costo_total:20000,monto_cliente:9000,monto_seguro:11000},[],[{monto:21000,estado:'recibido'}])
  assert.equal(balance.saldo_total,9000);assert.equal(balance.pagado,false)
  assert.equal(balance.excedente_seguro,10000);assert.equal(balance.aplicado_a_deuda,11000)
})
test('cancelled orders and insurance on a private order cannot receive money', () => {
  assert.throws(() => validatePayment({ ...particular, estado: 'cancelado' }, calculateSummary(particular), 100, 'cliente'))
  assert.throws(() => validatePayment(particular, calculateSummary(particular), 100, 'seguro'))
})
test('numeric middleware rejects invalid inventory and purchase requests', () => {
  for (const body of [{ cantidad_usada: -5 }, { precio: 'bad' }, { monto: 0 }, { items: [{ id_inventario: 1, cantidad: -5, precio_unitario: 10 }] }, { items: [] }]) {
    let error
    validateNumbers({ method: 'POST', body }, {}, e => { error = e })
    assert.ok(error); assert.equal(error.status, 400)
  }
})
