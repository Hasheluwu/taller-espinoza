import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RULES, checkField } from '../src/lib/fieldRules.js'

test('fields are tidied while typing', () => {
  assert.equal(RULES.phone.format('+505 88881234'), '8888-1234')
  assert.equal(RULES.phone.format('888812345678'), '8888-1234')
  assert.equal(RULES.cedula.format('0010101900001a'), '001-010190-0001A')
  assert.equal(RULES.cedula.format('001010'), '001-010')
  assert.equal(RULES.claim.format('LAF 2026-0012'), '20260012')
  assert.equal(RULES.plate.format('m 123-456'), 'M 123-456')
  assert.equal(RULES.name.format('Ana 2 Pérez'), 'Ana Pérez')
})
test('messages match the server rules', () => {
  assert.equal(checkField('phone', '8888-1234'), '')
  assert.match(checkField('phone', '9888-1234'), /empieza con 2/)
  assert.equal(checkField('cedula', '001-010190-0001A'), '')
  assert.match(checkField('cedula', '001-320190-0001A'), /no es válida/)
  assert.equal(checkField('claim', '123'), 'Número: solo números, entre 4 y 20 dígitos.')
  assert.equal(checkField('plate', 'M 123456'), '')
  assert.equal(checkField('phone', '', { required: false }), '')
  assert.match(checkField('name', '', { label: 'Nombre', required: true }), /obligatorio/)
})
