// backend/src/services/catalogs.js
// Traductor centralizado entre los catálogos 3FN de MySQL y los slugs del Frontend.

function rolToSlug(idRol, nombreRol = '') {
  if (Number(idRol) === 1 || Number(idRol) === 3 || /admin|propiet/i.test(nombreRol)) {
    return 'administrador'
  }
  return 'secretaria'
}

function detectTipoDocumentoId(numero = '', tipoExplicit = null) {
  if (tipoExplicit && Number.isInteger(Number(tipoExplicit))) return Number(tipoExplicit)
  const clean = String(numero).trim().toUpperCase()
  if (/^J\d{8,14}$/i.test(clean) || /^RUC/i.test(clean)) return 4 // RUC
  if (/^RES-/i.test(clean)) return 3 // Cédula de Residencia
  if (/^\d{3}-\d{6}-\d{4}[A-Z]$/i.test(clean)) return 1 // Cédula nicaragüense
  if (/^[A-Z]{1,3}-?[A-Z0-9]{5,12}$/i.test(clean)) return 2 // Pasaporte
  return 1
}

async function ensureMunicipioId(conn, nombreMunicipio) {
  const nombre = String(nombreMunicipio || 'Managua').trim() || 'Managua'
  const [rows] = await conn.query(
    'SELECT id_municipio FROM municipio WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
    [nombre]
  )
  if (rows.length > 0) return rows[0].id_municipio
  const [res] = await conn.query('INSERT INTO municipio (nombre) VALUES (?)', [nombre])
  return res.insertId
}

async function ensureModeloId(conn, nombreMarca, nombreModelo) {
  const marcaClean = String(nombreMarca || 'Genérica').trim() || 'Genérica'
  const modeloClean = String(nombreModelo || 'Estándar').trim() || 'Estándar'

  const [marcaRows] = await conn.query(
    'SELECT id_marca FROM marca WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
    [marcaClean]
  )
  let idMarca
  if (marcaRows.length > 0) {
    idMarca = marcaRows[0].id_marca
  } else {
    const [resMarca] = await conn.query('INSERT INTO marca (nombre) VALUES (?)', [marcaClean])
    idMarca = resMarca.insertId
  }

  const [modeloRows] = await conn.query(
    'SELECT id_modelo FROM modelo WHERE id_marca = ? AND LOWER(nombre) = LOWER(?) LIMIT 1',
    [idMarca, modeloClean]
  )
  if (modeloRows.length > 0) return modeloRows[0].id_modelo

  const [resModelo] = await conn.query(
    'INSERT INTO modelo (id_marca, nombre) VALUES (?, ?)',
    [idMarca, modeloClean]
  )
  return resModelo.insertId
}

async function resolveMatricula(conn, idOrMatricula) {
  if (idOrMatricula === undefined || idOrMatricula === null || String(idOrMatricula).trim() === '') {
    return null
  }
  const raw = String(idOrMatricula).trim()
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, '')
  const [rows] = await conn.query(
    `SELECT matricula FROM vehiculo
     WHERE matricula = ? OR REPLACE(REPLACE(UPPER(matricula), ' ', ''), '-', '') = ?
     LIMIT 1`,
    [raw, normalized]
  )
  if (rows.length > 0) return rows[0].matricula
  return null
}

function aseguradoraToId(slugOrName) {
  const s = String(slugOrName || '').trim().toLowerCase()
  if (s.includes('lafise') || s === '1') return 1
  if (s.includes('iniser') || s === '2') return 2
  return null
}

function aseguradoraToSlug(idAseguradora, nombre = '') {
  if (Number(idAseguradora) === 1 || /lafise/i.test(nombre)) return 'lafise'
  if (Number(idAseguradora) === 2 || /iniser/i.test(nombre)) return 'iniser'
  return 'ninguna'
}

function tipoOrdenToId(slug) {
  const s = String(slug || '').trim().toLowerCase()
  if (s === 'mecanica' || s === 'mecánica') return 1
  if (s === 'enderezado' || s === 'enderezado y pintura') return 2
  if (s === 'pintura') return 3
  if (s === 'mantenimiento') return 4
  return 1
}

function tipoOrdenToSlug(idTipoOrden, nombre = '') {
  const id = Number(idTipoOrden)
  if (id === 1 || /mec/i.test(nombre)) return 'mecanica'
  if (id === 2 || id === 3 || /pintura|enderezado/i.test(nombre)) return 'pintura'
  if (id === 4 || /mantenimiento/i.test(nombre)) return 'mantenimiento'
  return 'mecanica'
}

async function ensureUnidadId(conn, slugOrName) {
  const s = String(slugOrName || 'unidad').trim().toLowerCase()
  const map = {
    galon: 'Galón',
    'galón': 'Galón',
    litro: 'Litro',
    unidad: 'Unidad',
    pliego: 'Pliego',
    kilo: 'Kilo',
    metro: 'Metro',
    otro: 'Otro',
  }
  const target = map[s] || slugOrName
  const [rows] = await conn.query(
    'SELECT id_unidad FROM unidad_medida WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
    [target]
  )
  if (rows.length > 0) return rows[0].id_unidad
  const [res] = await conn.query('INSERT INTO unidad_medida (nombre) VALUES (?)', [target])
  return res.insertId
}

function unidadToSlug(nombre = '') {
  const s = String(nombre)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (['galon', 'litro', 'unidad', 'pliego', 'kilo', 'metro', 'otro'].includes(s)) return s
  return 'unidad'
}

function metodoPagoToId(slug) {
  const s = String(slug || '').trim().toLowerCase()
  if (s === 'efectivo') return 1
  if (s === 'transferencia') return 2
  if (s === 'tarjeta') return 3
  return 4
}

function metodoPagoToSlug(idMetodo, nombre = '') {
  const id = Number(idMetodo)
  if (id === 1 || /efectivo/i.test(nombre)) return 'efectivo'
  if (id === 2 || /transferencia/i.test(nombre)) return 'transferencia'
  if (id === 3 || /tarjeta/i.test(nombre)) return 'tarjeta'
  return 'otro'
}

function condicionRepuestoToId(slug) {
  const s = String(slug || '').trim().toLowerCase()
  if (s === 'nuevo') return 1
  if (s === 'usado_bueno' || s === 'usado bueno') return 2
  if (s === 'usado_regular' || s === 'usado regular') return 3
  if (s === 'para_reparar' || s === 'para reparar') return 4
  return 1
}

function condicionRepuestoToSlug(idCondicion) {
  const map = { 1: 'nuevo', 2: 'usado_bueno', 3: 'usado_regular', 4: 'para_reparar' }
  return map[Number(idCondicion)] || 'nuevo'
}

function especialidadToId(slug) {
  const s = String(slug || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (s === 'mecanico') return 1
  if (s === 'enderezador') return 2
  if (s === 'pintor') return 3
  return 4
}

function especialidadToSlug(idEspecialidad, nombre = '') {
  const id = Number(idEspecialidad)
  if (id === 1 || /mec/i.test(nombre)) return 'mecanico'
  if (id === 2 || /enderez/i.test(nombre)) return 'enderezador'
  if (id === 3 || /pintor/i.test(nombre)) return 'pintor'
  return 'otro'
}

module.exports = {
  rolToSlug,
  detectTipoDocumentoId,
  ensureMunicipioId,
  ensureModeloId,
  resolveMatricula,
  aseguradoraToId,
  aseguradoraToSlug,
  tipoOrdenToId,
  tipoOrdenToSlug,
  ensureUnidadId,
  unidadToSlug,
  metodoPagoToId,
  metodoPagoToSlug,
  condicionRepuestoToId,
  condicionRepuestoToSlug,
  especialidadToId,
  especialidadToSlug,
}