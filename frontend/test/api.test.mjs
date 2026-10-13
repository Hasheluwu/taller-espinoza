import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiFetch } from '../src/lib/api.js'

test('inventory requests go to backend and retain authentication', async t => {
  let received
  t.mock.method(globalThis, 'fetch', async (...args) => {
    received = args
    return new Response('[]', { headers: { 'content-type': 'application/json' } })
  })
  const options = { headers: { Authorization: 'Bearer test' } }
  const res = await apiFetch('/api/inventario?q=pintura', options)
  assert.equal(received[0], 'http://localhost:3001/api/inventario?q=pintura')
  assert.equal(received[1], options); assert.deepEqual(await res.json(), [])
})
test('HTML fallback yields actionable error instead of JSON syntax exception', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }))
  await assert.rejects(apiFetch('/api/inventario'), /dirección de la API/)
})
test('network failures explain backend connection problem', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(apiFetch('/api/inventario'), /backend esté disponible/)
})
test('HTTP errors preserve the server message for forms', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"message":"Token expirado"}', { status: 401, headers: { 'content-type': 'application/json' } }))
  const res = await apiFetch('/api/ordenes')
  assert.equal(res.ok, false); assert.equal((await res.json()).message, 'Token expirado')
})
