const { client, vehicle } = require('./formValidation')
const { fail } = require('./validation')
// Called inside the conversion transaction; never writes during quoting.
async function register(conn, quote, supplied = {}) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) fail('Completa los datos faltantes.')
  const data = { ...quote.datos }
  for (const key of ['cliente','cedula','telefono','municipio_residencia','direccion','placa','marca','vehiculo','anio','color','chasis','motor']) {
    if (supplied[key] !== undefined) data[key] = supplied[key]
  }
  const person = { nombre:data.cliente,cedula:data.cedula,telefono:data.telefono,municipio_residencia:data.municipio_residencia,direccion:data.direccion }
  client(person)
  let [[existing]] = await conn.query('SELECT * FROM cliente WHERE cedula=? FOR UPDATE', [person.cedula])
  if (!existing) {
    try {
      const [result] = await conn.query('INSERT INTO cliente (nombre,cedula,telefono,municipio_residencia,direccion) VALUES (?,?,?,?,?)', [person.nombre,person.cedula,person.telefono,person.municipio_residencia,person.direccion || null])
      existing = {id:result.insertId}
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error
      ;[[existing]] = await conn.query('SELECT * FROM cliente WHERE cedula=? FOR UPDATE', [person.cedula])
      if (!existing) throw error
    }
  }
  const car = {id_cliente:existing.id,matricula:data.placa,marca:data.marca,modelo:data.vehiculo,anio_fabricacion:data.anio,color:data.color,chasis:data.chasis,motor:data.motor,aseguradora:quote.seguro==='PARTICULAR'?'ninguna':quote.seguro.toLowerCase()}
  vehicle(car)
  let [[saved]] = await conn.query('SELECT * FROM vehiculo WHERE matricula=? FOR UPDATE', [car.matricula])
  if (!saved) {
    try {
      const [result] = await conn.query('INSERT INTO vehiculo (id_cliente,matricula,marca,modelo,anio_fabricacion,aseguradora,color,chasis,motor) VALUES (?,?,?,?,?,?,?,?,?)', [car.id_cliente,car.matricula,car.marca,car.modelo,car.anio_fabricacion,car.aseguradora,car.color,car.chasis || null,car.motor || null])
      saved = {id:result.insertId,id_cliente:car.id_cliente}
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error
      ;[[saved]] = await conn.query('SELECT * FROM vehiculo WHERE matricula=? FOR UPDATE', [car.matricula])
      if (!saved) throw error
    }
  }
  if (Number(saved.id_cliente) !== Number(existing.id)) fail('La matrícula ya pertenece a otro cliente. Revisa la cédula y matrícula de la cotización antes de crear la orden.',409)
  return saved.id
}
module.exports = { register }
