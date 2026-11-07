const { test } = require('node:test')
const assert = require('node:assert/strict')
const { calculate } = require('../src/services/proformas')
const line = (tipo, precio, extra={}) => ({tipo_linea:tipo,descripcion:'Trabajo de prueba',cantidad:1,precio_unitario:precio,aplica_iva:tipo==='servicio',...extra})
test('global labor is charged once even with several descriptions',()=>{
  const r=calculate({mano_obra_global:1000,detalles:[line('servicio',700),line('servicio',900),line('repuesto',500)]})
  assert.equal(r.subtotal,1500);assert.equal(r.iva,150);assert.equal(r.total,1650);assert.equal(r.detalles[0].precio_unitario,0)
})
test('per-line tax and quantities use rounded cents and ignore a forged total',()=>{
  const r=calculate({mano_obra_global:null,total:1,detalles:[line('servicio',100,{cantidad:1.5}),line('repuesto',200,{cantidad:2})]})
  assert.equal(r.subtotal,550);assert.equal(r.iva,22.5);assert.equal(r.total,572.5)
})
test('empty drafts are valid but invalid money, quantities and tax flags are rejected',()=>{
  assert.equal(calculate({detalles:[]}).total,0)
  for(const changes of [{cantidad:0},{cantidad:-1},{cantidad:0.001},{precio_unitario:-1},{precio_unitario:0.001},{precio_unitario:'NaN'},{aplica_iva:'false'},{tipo_linea:'otro'},{descripcion:''}]) assert.throws(()=>calculate({detalles:[line('servicio',10,changes)]}))
})
test('large documents and out of range totals cannot overflow SQL money columns',()=>{
  assert.throws(()=>calculate({detalles:Array(151).fill(line('servicio',1))}));assert.throws(()=>calculate({detalles:[line('servicio',99999999,{cantidad:99999})]}))
})
