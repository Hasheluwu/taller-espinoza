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
    const f = fixture(); const res = await f.request(state)
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
