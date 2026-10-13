const { test } = require('node:test')
const assert = require('node:assert/strict')
let db
const poolPath = require.resolve('../src/db')
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { getConnection: () => db.connection(), query: (...args) => db.query(...args) } }
const router = require('../src/routes/inventario')
function database(quantity = 3) {
  const state = { quantity, movements: [], purchases: [] }
  let before
  const data = {
    state,
    async query(sql, values = []) {
      if (sql.startsWith('SELECT cantidad')) return [[{ cantidad: state.quantity }]]
      if (sql.startsWith('SELECT id FROM inventario')) return [[{ id: 1 }]]
      if (sql.startsWith('SELECT * FROM inventario')) return [[{ id: 1, cantidad: state.quantity }]]
      if (sql.includes('INSERT INTO compra_inventario')) { state.purchases.push(values); return [{ insertId: 1 }] }
      if (sql.includes('UPDATE inventario')) { state.quantity += values[0]; return [{ affectedRows: 1 }] }
      if (sql.includes('INSERT INTO movimiento_inventario')) { state.movements.push(values); return [{ insertId: 1 }] }
      throw new Error(`Unexpected query ${sql}`)
    },
    async connection() {
      return { query: data.query, async beginTransaction() { before = structuredClone(state) }, async rollback() { Object.assign(state, before) }, async commit() {}, release() {} }
    },
  }
  return data
}
async function request(path, body) {
  const layer = router.stack.find(l => l.route?.path === path && l.route.methods.post)
  const res = { code: 200, status(n) { this.code = n; return this }, json(data) { this.data = data; return this } }
  await layer.route.stack.at(-1).handle({ body, usuario: { id: 1, rol: 'administrador' } }, res)
  return res
}
test('removing ten units when only three exist changes neither stock nor ledger', async () => {
  db = database(3)
  const res = await request('/ajuste', { id_inventario: 1, tipo_ajuste: 'decremento', cantidad: 10 })
  assert.equal(res.code, 400); assert.equal(db.state.quantity, 3); assert.equal(db.state.movements.length, 0)
})
test('valid stock adjustment and ledger have exactly the same delta', async () => {
  db = database(3)
  assert.equal((await request('/ajuste', { id_inventario: 1, tipo_ajuste: 'decremento', cantidad: 2 })).code, 200)
  assert.equal(db.state.quantity, 1); assert.equal(db.state.movements[0][1], -2)
})
test('unknown adjustment type is rejected', async () => {
  db = database(3)
  assert.equal((await request('/ajuste', { id_inventario: 1, tipo_ajuste: 'typo', cantidad: 2 })).code, 400)
  assert.equal(db.state.quantity, 3)
})
test('purchase total is calculated from items, ignoring forged totals', async () => {
  db = database(3)
  const res = await request('/compra', { fecha: '2026-10-06', monto_subtotal: 1, monto_iva: 0, monto_total: 1, tiene_factura_iva: true, items: [{ id_inventario: 1, cantidad: 2, precio_unitario: 100 }] })
  assert.equal(res.code, 201); assert.deepEqual(db.state.purchases[0].slice(2, 5), [200, 30, 230])
  assert.equal(db.state.quantity, 5); assert.equal(db.state.movements[0][1], 2)
})
