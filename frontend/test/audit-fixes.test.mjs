import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isExpired } from '../src/lib/date.js'
import { appointmentReason } from '../src/lib/agenda.js'
test('expiry compares calendar dates and allows use through expiration day',()=>{
 assert.equal(isExpired('2026-11-03T00:00:00.000Z','2026-11-04'),true)
 for(const value of [null,'','2026-11-04','2026-11-05'])assert.equal(isExpired(value,'2026-11-04'),false)
})
test('agenda shows a fallback for missing and legacy placeholder reasons',()=>{
 for(const value of [null,undefined,'','  ','NULL',' undefined '])assert.equal(appointmentReason(value),'')
 assert.equal(appointmentReason('  Revisar frenos  '),'Revisar frenos')
})
