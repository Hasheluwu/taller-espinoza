// backend/src/services/workers.js
const { fail, number, cents, packId } = require('./validation')
const rules = require('./fieldRules')

const TIPOS = ['interno', 'externo']
const ROLES = ['pintor', 'enderezador', 'mecanico', 'otro']

function validatePersonal(body = {}) {
  const { cedula, nombre, tipo, rol, telefono, fijo } = body
  const cleanCedula = rules.cedula(cedula, { label: 'Cédula del trabajador', required: true })
  const name = rules.personName(nombre, { label: 'Nombre del trabajador' })
  if (!TIPOS.includes(tipo)) fail('Tipo de personal inválido: elige interno o externo.')
  if (!ROLES.includes(rol)) fail('Rol inválido: elige pintor, enderezador, mecánico u otro.')
  const phone = rules.phone(telefono, { label: 'Teléfono del trabajador', required: false })
  return { cedula: cleanCedula, nombre: name, tipo, rol, telefono: phone || null, fijo: fijo ? 1 : 0 }
}

function normalizeWorkers(body = {}, { requireAmount = false } = {}) {
  const list = Array.isArray(body.trabajadores)
    ? body.trabajadores
    : body.id_personal != null && body.id_personal !== ''
      ? [{ id_personal: body.id_personal, monto_acordado: body.monto_acordado }]
      : []
  if (body.trabajadores != null && !Array.isArray(body.trabajadores)) fail('Lista de trabajadores inválida.')
  if (list.length > 20) fail('Asigna como máximo 20 trabajadores a la vez.')
  const seen = new Set()
  return list.map((item, index) => {
    if (!item || typeof item !== 'object') fail(`Trabajador ${index + 1}: datos inválidos.`)
    const id = number(item.id_personal, `Trabajador ${index + 1}`, { positive: true, integer: true })
    if (seen.has(id)) fail('Elegiste el mismo trabajador dos veces. Usa una sola fila por trabajador.')
    seen.add(id)
    const empty = item.monto_acordado === undefined || item.monto_acordado === null || item.monto_acordado === ''
    if (empty && requireAmount) fail(`Trabajador ${index + 1}: escribe el monto acordado.`)
    return {
      id_personal: id,
      monto_acordado: empty ? null : cents(item.monto_acordado, `Monto acordado del trabajador ${index + 1}`) / 100,
    }
  })
}

async function assignWorkers(conn, idOrden, workers) {
  if (!workers.length) return []
  const [rows] = await conn.query(
    'SELECT id_personal, nombre, activo FROM personal WHERE id_personal IN (?)',
    [workers.map(w => w.id_personal)]
  )
  const packedIds = []
  for (const worker of workers) {
    const person = rows.find(row => Number(row.id_personal) === Number(worker.id_personal))
    if (!person) fail('Trabajador no encontrado.', 404)
    if (person.activo === 0) {
      fail(`${person.nombre} está dado de baja. Reactívalo en Personal para asignarle trabajos.`, 409)
    }
    if (worker.monto_acordado === null) {
      fail(`Escribe el monto acordado con ${person.nombre}. Puedes poner 0 y editarlo después.`)
    }
    const [open] = await conn.query(
      `SELECT id_orden, id_personal FROM orden_personal
       WHERE id_orden = ? AND id_personal = ? FOR UPDATE`,
      [idOrden, worker.id_personal]
    )
    if (open.length) {
      fail(`${person.nombre} ya está en el equipo de esta orden. Edita su monto en lugar de agregarlo otra vez.`, 409)
    }
    await conn.query(
      'INSERT INTO orden_personal (id_orden, id_personal, monto_acordado) VALUES (?, ?, ?)',
      [idOrden, worker.id_personal, worker.monto_acordado]
    )
    packedIds.push(packId(idOrden, worker.id_personal))
  }
  return packedIds
}

async function requireTeamMember(conn, idOrden, idPersonal) {
  const [team] = await conn.query(
    `SELECT DISTINCT op.id_personal, p.nombre
     FROM orden_personal op
     JOIN personal p ON p.id_personal = op.id_personal
     WHERE op.id_orden = ?`,
    [idOrden]
  )
  if (!team.length) {
    fail('Esta orden no tiene trabajadores asignados. Asigna su equipo en Operaciones antes de usar materiales.', 409)
  }
  if (idPersonal == null || idPersonal === '') {
    return Number(team[0].id_personal)
  }
  const id = number(idPersonal, 'Trabajador', { positive: true, integer: true })
  if (!team.some(member => Number(member.id_personal) === id)) {
    fail(`Ese trabajador no está en el equipo de esta orden. Equipo: ${team.map(m => m.nombre).join(', ')}.`, 409)
  }
  return id
}

module.exports = { TIPOS, ROLES, validatePersonal, normalizeWorkers, assignWorkers, requireTeamMember }