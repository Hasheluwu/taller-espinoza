const test = require('node:test')
const assert = require('node:assert/strict')
const { calculate } = require('../src/services/insuranceInvoices')
test('LAFISE: 20% on labor, then 15% VAT', () => {
  const r=calculate('lafise',[{tipo_linea:'servicio',importe:10000,aplica_iva:true}])
  assert.equal(r.descuento,2000);assert.equal(r.subtotal,8000);assert.equal(r.iva,1200);assert.equal(r.total,9200)
})
test('INISER: 15% on labor, then 15% VAT; parts are not discounted', () => {
  const r=calculate('iniser',[{tipo_linea:'servicio',importe:10000,aplica_iva:true},{tipo_linea:'repuesto',importe:2000,aplica_iva:false},{tipo_linea:'material',importe:100,aplica_iva:true}])
  assert.equal(r.descuento,1500);assert.equal(r.subtotal,10600);assert.equal(r.iva,1290);assert.equal(r.total,11890)
  assert.equal(r.detalles[1].descuento,0);assert.equal(r.detalles[2].descuento,0)
})
test('zero-priced activity detail does not duplicate global labor; fractional cents round per line',()=>{
  const r=calculate('iniser',[{tipo_linea:'servicio',importe:0},{tipo_linea:'servicio',importe:10.01}])
  assert.equal(r.descuento,1.5);assert.equal(r.subtotal,8.51);assert.equal(r.iva,1.28);assert.equal(r.total,9.79)
})
test('invalid insurers, negative and nonfinite amounts are rejected',()=>{
  assert.throws(()=>calculate('particular',[]))
  for(const importe of [-1,NaN,Infinity,''])assert.throws(()=>calculate('lafise',[{tipo_linea:'servicio',importe}]))
})
