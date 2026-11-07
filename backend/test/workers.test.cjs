const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validatePersonal, normalizeWorkers, assignWorkers } = require('../src/services/workers')

test('worker data is validated with clear messages', () => {
  assert.deepEqual(validatePersonal({ nombre: ' Ana ', tipo: 'interno', rol: 'pintor', telefono: '', fijo: true }), { nombre: 'Ana', tipo: 'interno', rol: 'pintor', telefono: null, fijo: 1 })
  assert.throws(() => validatePersonal({ nombre: '', tipo: 'interno', rol: 'pintor' }), /Nombre/)
  assert.throws(() => validatePersonal({ nombre: 'Ana', tipo: 'xx', rol: 'pintor' }), /Tipo/)
  assert.throws(() => validatePersonal({ nombre: 'Ana', tipo: 'interno', rol: 'chef' }), /Rol/)
})
test('several workers per job, each with its own amount', () => {
  assert.deepEqual(normalizeWorkers({ trabajadores: [{ id_personal: '1', monto_acordado: '800' }, { id_personal: 2, monto_acordado: '' }] }), [{ id_personal: 1, monto_acordado: 800 }, { id_personal: 2, monto_acordado: null }])
  assert.deepEqual(normalizeWorkers({ id_personal: 3, monto_acordado: 50 }), [{ id_personal: 3, monto_acordado: 50 }])
  assert.deepEqual(normalizeWorkers({}), [])
  assert.throws(() => normalizeWorkers({ trabajadores: [{ id_personal: 1 }, { id_personal: 1 }] }), /mismo trabajador/)
  assert.throws(() => normalizeWorkers({ trabajadores: [{ id_personal: 1, monto_acordado: '' }] }, { requireAmount: true }), /monto acordado/)
  assert.throws(() => normalizeWorkers({ trabajadores: [{ id_personal: 1, monto_acordado: -5 }] }), /Monto acordado/)
  assert.throws(() => normalizeWorkers({ trabajadores: 'x' }), /inválida/)
})

function fakeConn({ open = [], inactive = false } = {}) {
  const inserted = []
  return { inserted, async query(sql, args) {
    if (sql.startsWith('SELECT id, nombre, activo FROM personal')) return [args[0].map(id => ({ id, nombre: `T${id}`, activo: inactive ? 0 : 1 }))]
    if (sql.includes('FROM orden_personal op WHERE op.id_orden=?')) return [open.includes(args[1]) ? [{ id: 1 }] : []]
    if (sql.startsWith('INSERT INTO orden_personal')) { inserted.push(args); return [{ insertId: inserted.length }] }
    throw new Error(sql)
  } }
}
test('a worker joins an order team only once', async () => {
  const conn = fakeConn({ open: [1] })
  await assert.rejects(assignWorkers(conn, 5, [{ id_personal: 1, monto_acordado: 100 }]), /ya está en el equipo/)
  const ok = fakeConn()
  assert.deepEqual(await assignWorkers(ok, 5, [{ id_personal: 1, monto_acordado: 100 }, { id_personal: 2, monto_acordado: 0 }]), [1, 2])
})
test('deactivated workers and missing amounts are rejected', async () => {
  await assert.rejects(assignWorkers(fakeConn({ inactive: true }), 5, [{ id_personal: 1, monto_acordado: 1 }]), /dado de baja/)
  await assert.rejects(assignWorkers(fakeConn(), 5, [{ id_personal: 1, monto_acordado: null }]), /monto acordado/)
})
