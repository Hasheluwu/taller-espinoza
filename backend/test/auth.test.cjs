const { test } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
process.env.JWT_SECRET = 'unit-tests-only-not-a-real-secret'
let active = true
const poolPath = require.resolve('../src/db')
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { async query() { return [active ? [{ id: 1, rol: 'secretaria' }] : []] } } }
const auth = require('../src/middleware/authMiddleware')
async function request(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }
  const res = { code: 200, status(n) { this.code = n; return this }, json(data) { this.data = data; return this } }
  let passed = false
  await auth(req, res, err => { assert.ifError(err); passed = true })
  return { req, res, passed }
}
test('legacy indefinite, expired and invalid tokens are rejected', async () => {
  for (const token of [undefined, 'invalid', jwt.sign({ id: 1 }, process.env.JWT_SECRET), jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -1, jwtid: 's' })]) {
    assert.equal((await request(token)).res.code, 401)
  }
})
test('valid token requires a live server session and uses current database role', async () => {
  const token = jwt.sign({ id: 1, rol: 'administrador' }, process.env.JWT_SECRET, { expiresIn: '8h', jwtid: 's' })
  active = true
  const valid = await request(token)
  assert.equal(valid.passed, true); assert.equal(valid.req.usuario.rol, 'secretaria')
  const res = { status(n) { this.code = n; return this }, json() {} }
  auth.admin(valid.req, res, () => assert.fail('must not grant admin permission'))
  assert.equal(res.code, 403)
  active = false
  assert.equal((await request(token)).res.code, 401)
})
