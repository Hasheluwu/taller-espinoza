const { test } = require('node:test')
const assert = require('node:assert/strict')
const createHandler = require('../src/handlers/changeOrderState')

function fixture(initial = 'recibido', failAudit = false) {
  let row = initial === null ? null : { id: 9, estado: initial, fecha_entrega_real: null }
  let snapshot
  const calls = []
  const conn = {
    async beginTransaction() { snapshot = row && { ...row }; calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { row = snapshot; calls.push('rollback') },
    release() { calls.push('release') },
    async query(sql, params) {
      if (sql.startsWith('SELECT')) return [row ? [{ ...row }] : []]
      if (sql.startsWith('UPDATE')) {
        assert.match(sql, /CURRENT_DATE/)
        row.estado = params[0]
        if (params[0] === 'entregado') row.fecha_entrega_real = '2026-10-05'
        calls.push('update')
      } else {
        calls.push('audit')
        if (failAudit) throw new Error('Simulated audit failure')
      }
      return [{}]
    },
  }
  const handler = createHandler({ async getConnection() { return conn } })
  async function request(estado, id = '9') {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(data) { this.body = data; return this } }
    await handler({ params: { id }, body: { estado }, usuario: { id: 1 } }, res)
    return res
  }
  return { request, calls, row: () => row }
}
for (const state of ['en_proceso', 'listo', 'entregado']) {
  test(`persists ${state} and audit atomically`, async () => {
    const f = fixture(state === 'entregado' ? 'listo' : 'recibido'); const res = await f.request(state)
    assert.equal(res.statusCode, 200); assert.equal(res.body.estado, state)
    assert.deepEqual(f.calls, ['begin', 'update', 'audit', 'commit', 'release'])
    assert.equal(res.body.fecha_entrega_real, state === 'entregado' ? '2026-10-05' : null)
  })
}
test('retry is idempotent', async () => {
  const f = fixture('entregado'); await f.request('entregado')
  assert.deepEqual(f.calls, ['begin', 'commit', 'release'])
})
test('missing order and invalid inputs', async () => {
  assert.equal((await fixture(null).request('listo')).statusCode, 404)
  const f = fixture()
  assert.equal((await f.request('inventado')).statusCode, 400)
  assert.equal((await f.request('listo', 'abc')).statusCode, 400)
  assert.deepEqual(f.calls, [])
})
test('closed orders cannot be reopened', async () => {
  for (const state of ['entregado', 'cancelado']) {
    const f = fixture(state)
    assert.equal((await f.request('en_proceso')).statusCode, 409)
    assert.equal(f.row().estado, state)
  }
})
test('audit failure rolls back the state and releases connection', async () => {
  const f = fixture('recibido', true)
  const res = await f.request('listo')
  assert.equal(res.statusCode, 500); assert.equal(f.row().estado, 'recibido')
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
})

test('delivery requires a ready order and leaves other states intact',async()=>{
 for(const state of ['recibido','en_proceso']){
  const f=fixture(state);const res=await f.request('entregado')
  assert.equal(res.statusCode,409);assert.equal(f.row().estado,state);assert.ok(!f.calls.includes('update'))
 }
})

function insuredFixture(services) {
  const order = { id: 5, estado: 'listo', tipo_pago: 'lafise', id_vehiculo: 3, subtotal: services.length ? 1000 : null, numero_tramite: 'T-1' }
  let invoice = null
  const calls = []
  const conn = {
    async beginTransaction() { calls.push('begin') }, async commit() { calls.push('commit') }, async rollback() { calls.push('rollback') }, release() {},
    async query(sql, params) {
      if (/^SELECT \* FROM orden WHERE id/.test(sql)) return [[{ ...order }]]
      if (/^SELECT \* FROM factura_seguro/.test(sql)) return [invoice ? [invoice] : []]
      if (/FROM vehiculo v JOIN cliente/.test(sql)) return [[{ cliente: 'Ana', municipio_residencia: 'Masaya', matricula: 'M-1' }]]
      if (/FROM orden_servicio/.test(sql)) return [services]
      if (/orden_material|orden_repuesto/.test(sql)) return [[]]
      if (/pago_cliente/.test(sql)) return [[{ cliente: 0, seguro: 0 }]]
      if (/^INSERT INTO factura_seguro/.test(sql)) { invoice = { id: 7, id_orden: 5, total: params[3], saldo_inicial: params[4], estado: params[5], documento: params[2] }; calls.push('invoice'); return [{ insertId: 7 }] }
      if (/^UPDATE orden SET estado/.test(sql)) { order.estado = params[0]; calls.push('update') }
      return [{}]
    },
  }
  const handler = createHandler({ async getConnection() { return conn } })
  return { calls, async request() {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(data) { this.body = data; return this } }
    await handler({ params: { id: '5' }, body: { estado: 'entregado' }, usuario: { id: 1 } }, res)
    return res
  } }
}
test('delivering an insured order issues its insurer invoice in the same transaction', async () => {
  const f = insuredFixture([{ descripcion: 'Pintura', precio: 1000, tipo_linea: 'servicio', aplica_iva: 0 }])
  const res = await f.request()
  assert.equal(res.statusCode, 200)
  assert.ok(f.calls.includes('invoice'))
  assert.equal(f.calls.at(-1), 'commit')
})
test('an insured order without charges is not delivered', async () => {
  const f = insuredFixture([])
  const res = await f.request()
  assert.equal(res.statusCode, 409)
  assert.match(res.body.message, /No se entregó el vehículo/)
  assert.ok(f.calls.includes('rollback'))
  assert.ok(!f.calls.includes('commit') && !f.calls.includes('invoice'))
})
