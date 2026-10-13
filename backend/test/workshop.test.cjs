const {test}=require('node:test')
const assert=require('node:assert/strict')
const {date,photo,profit}=require('../src/services/workshop')
test('calendar rejects impossible dates and retains local date',()=>{
 assert.equal(date('2028-02-29'),'2028-02-29')
 for(const value of ['2026-02-29','2026-13-01','2026-04-31','',null])assert.throws(()=>date(value),/inválida/)
})
test('photos reject disguised HTML and oversized payloads',()=>{
 assert.throws(()=>photo('data:image/png;base64,'+Buffer.from('<html>test</html>').toString('base64')),/formato/)
 assert.throws(()=>photo('data:text/html;base64,AAAA'),/imagen/)
 assert.throws(()=>photo('data:image/jpeg;base64,'+Buffer.alloc(3*1024*1024+1).toString('base64')),/3 MB/)
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
 assert.deepEqual(photo('data:image/png;base64,'+png.toString('base64')).bytes,png)
})
test('profit excludes sales tax, includes labor once and does not invent missing costs',()=>{
 const order={subtotal:20000,costo_total:23000,iva:3000}
 assert.equal(profit(order,null,5000).ganancia,null)
 const result=profit(order,{materiales:2500,repuestos:1500,otros:1000},5000)
 assert.equal(result.costo_total,10000)
 assert.equal(result.ganancia,10000)
 assert.equal(profit(order,{materiales:25000,repuestos:0,otros:0},5000).ganancia,-10000)
})
