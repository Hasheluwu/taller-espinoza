const { test } = require('node:test')
const assert = require('node:assert/strict')
const poolPath = require.resolve('../src/db')
let currentPool
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { getConnection: () => currentPool.getConnection() } }
const router = require('../src/routes/pagos')

function database(order, initial = []) {
  const state = { order: { id: 1, estado: 'en_proceso', tipo_pago: 'particular', costo_total: 50000, ...order }, client: initial, insurance: [], audit: [] }
  let queue = Promise.resolve()
  let failAudit = false
  return {
    state, failNextAudit() { failAudit = true },
    async getConnection() {
      let unlock, snapshot
      return {
        async beginTransaction() {},
        async query(sql, params = []) {
          if (sql.startsWith('SET TRANSACTION')) return [{}]
          if (sql.startsWith('SELECT * FROM orden')) {
            const previous = queue
            queue = new Promise(resolve => { unlock = resolve })
            await previous
            snapshot = structuredClone(state)
            return [[{ ...state.order }]]
          }
          if (sql.startsWith('SELECT * FROM factura_seguro')) return [[]]
          const table = sql.includes('pago_cliente') ? 'client' : 'insurance'
          if (sql.startsWith('SELECT * FROM pago_')) {
            const rows = sql.includes('WHERE id_orden') ? state[table] : state[table].filter(p => p.id === Number(params[0]))
            return [structuredClone(rows)]
          }
          if (sql.startsWith('INSERT INTO pago_')) {
            const id = state[table].length + 1
            const record = table === 'client'
              ? { id, id_orden: params[0], monto: params[1], tipo: params[3], metodo: params[4] }
              : { id, id_orden: params[0], monto: params[1], estado: params[4] }
            state[table].push(record); return [{ insertId: id }]
          }
          if (sql.startsWith('INSERT INTO auditoria')) {
            if (failAudit) { failAudit = false; throw new Error('audit unavailable') }
            state.audit.push(params); return [{}]
          }
          if (sql.startsWith('UPDATE pago_seguro SET monto')) { state.insurance.find(p => p.id === params[1]).monto = params[0]; return [{}] }
          if (sql.startsWith('UPDATE pago_seguro')) {
            const record = state.insurance.find(p => p.id === params[3]); record.estado = params[0]; return [{}]
          }
          if (sql.startsWith('UPDATE orden SET monto_cliente')) { state.order.monto_cliente = params[0]; state.order.monto_seguro = params[1]; return [{}] }
          if (sql.startsWith('DELETE FROM pago_')) { state[table] = state[table].filter(p => p.id !== Number(params[0])); return [{}] }
          throw new Error(`Unexpected SQL: ${sql}`)
        },
        async commit() {},
        async rollback() { if (snapshot) Object.assign(state, snapshot) },
        release() { unlock?.() },
      }
    },
  }
}
async function request(method, path, body = {}, params = { id_orden: '1' }, role = 'administrador') {
  const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method])
  assert.ok(layer, `route ${path} exists`)
  const handler = layer.route.stack.at(-1).handle
  const res = { code: 200, status(n) { this.code = n; return this }, json(data) { this.data = data; return this } }
  await handler({ body, params, usuario: { id: 1, rol: role } }, res, err => { res.code = err.status || 500; res.data = { message: err.message } })
  return res
}
const abono = monto => ({ monto, tipo: 'abono', metodo: 'efectivo' })

test('insurance orders reject new client or insurer installments even with excess confirmation', async () => {
  for (const tipo_pago of ['lafise','iniser']) {
    currentPool=database({tipo_pago,costo_total:20000,monto_cliente:9000,monto_seguro:11000})
    const before=structuredClone(currentPool.state)
    assert.equal((await request('post','/:id_orden/cliente',abono(9000))).code,409)
    for (const role of ['administrador','secretaria']) {
      const r=await request('post','/:id_orden/seguro',{monto:12000,concepto:'pago_principal',estado:'recibido',confirmar_excedente:true,motivo_excedente:'Antes se permitía el excedente'},{id_orden:'1'},role)
      assert.equal(r.code,409);assert.match(r.data.message,/factura/)
    }
    assert.deepEqual(currentPool.state,before)
  }
})
test('legacy insurance receipts and pending entries are read-only and remain available',async()=>{
 currentPool=database({tipo_pago:'lafise',costo_total:34500,monto_cliente:9500,monto_seguro:25000,estado:'entregado'},[{id:1,monto:9500}])
 currentPool.state.insurance=[{id:1,id_orden:1,monto:25000,estado:'pendiente'},{id:2,id_orden:1,monto:5700,estado:'recibido'}]
 const before=structuredClone(currentPool.state)
 assert.equal((await request('patch','/seguro/:id/estado',{estado:'recibido',confirmar_excedente:true,motivo_excedente:'Importe verificado'},{id:'1'})).code,409)
 assert.equal((await request('put','/seguro/:id/pendiente',{monto:19300,motivo:'Corrección anterior'},{id:'1'})).code,409)
 const balance=(await request('get','/:id_orden/resumen')).data
 assert.equal(balance.seguro_recibido,5700);assert.equal(balance.total_cliente,9500)
 assert.equal(balance.puede_cobrar_seguro,false);assert.equal(balance.puede_cobrar_cliente,false)
 assert.deepEqual(currentPool.state,before)
})

test('actual payment route persists installments and rejects the next payment after settlement', async () => {
  currentPool = database()
  for (const monto of [5000, 3000, 42000]) assert.equal((await request('post', '/:id_orden/cliente', abono(monto))).code, 201)
  const balance = await request('get', '/:id_orden/resumen')
  assert.equal(balance.data.pagado, true); assert.equal(balance.data.saldo_cliente, 0)
  assert.equal((await request('post', '/:id_orden/cliente', abono(1))).code, 409)
  assert.equal(currentPool.state.client.length, 3)
  assert.equal((await request('delete', '/cliente/:id', {}, { id: '1' })).code, 409)
})
test('two concurrent final installments cannot overpay', async () => {
  currentPool = database({}, [{ id: 1, id_orden: 1, monto: 40000 }])
  const results = await Promise.all([request('post', '/:id_orden/cliente', abono(10000)), request('post', '/:id_orden/cliente', abono(10000))])
  assert.deepEqual(results.map(r => r.code).sort(), [201, 409])
  assert.equal(currentPool.state.client.reduce((s, p) => s + p.monto, 0), 50000)
})
test('audit failure rolls back the installment', async () => {
  currentPool = database(); currentPool.failNextAudit()
  assert.equal((await request('post', '/:id_orden/cliente', abono(5000))).code, 500)
  assert.equal(currentPool.state.client.length, 0)
})
test('insurance payment distribution and deletion are blocked without altering history',async()=>{
 currentPool=database({tipo_pago:'iniser',monto_cliente:10000,monto_seguro:40000},[{id:1,id_orden:1,monto:5000}])
 currentPool.state.insurance=[{id:1,id_orden:1,monto:10000,estado:'recibido'}]
 const before=structuredClone(currentPool.state)
 assert.equal((await request('put','/:id_orden/distribucion',{monto_cliente:4000,monto_seguro:46000})).code,409)
 assert.equal((await request('delete','/cliente/:id',{},{id:'1'})).code,409)
 assert.equal((await request('delete','/seguro/:id',{},{id:'1'})).code,409)
 assert.deepEqual(currentPool.state,before)
})
