const test = require('node:test'), assert = require('node:assert/strict')
const { client, vehicle } = require('../src/services/formValidation')
const person = () => ({ nombre:' Ana ',cedula:'001-010190-0001a',telefono:'+505 8888-0000',municipio_residencia:' Managua ' })
test('client validation normalizes names and supports international phone formats', () => {
  const value=person();client(value);assert.equal(value.nombre,'Ana');assert.equal(value.municipio_residencia,'Managua');assert.equal(value.telefono,'8888-0000');assert.equal(value.cedula,'001-010190-0001A')
})
test('client rejects whitespace, wrong types, future birth and invalid phones', () => {
  for(const bad of [{nombre:'   '},{nombre:123},{nombre:'a'.repeat(151)},{municipio_residencia:' '},{telefono:'abcdefgh'},{telefono:'123'},{fecha_nacimiento:'2099-01-01'},{fecha_nacimiento:'2026-02-30'}]) assert.throws(()=>client({...person(),...bad}),e=>e.status===400)
})
test('vehicle validates year, owner identifier, catalog and text', () => {
  const car={id_cliente:1,matricula:'m 123456',marca:'Toyota',modelo:'Hilux',color:'Blanco',aseguradora:'ninguna',anio_fabricacion:2020}
  vehicle({...car})
  for(const bad of [{marca:' '},{modelo:123},{anio_fabricacion:2099},{anio_fabricacion:2020.5},{anio_fabricacion:1899},{aseguradora:'unknown'},{id_cliente:-1}]) assert.throws(()=>vehicle({...car,...bad}),e=>e.status===400)
})
