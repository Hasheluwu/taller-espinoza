import test from 'node:test'
import assert from 'node:assert/strict'
import {weekStart,weekDays,shiftDate} from '../src/lib/week.js'
test('week starts Monday and includes Sunday across years',()=>{
 assert.equal(weekStart('2027-01-03'),'2026-12-28')
 assert.deepEqual(weekDays('2026-12-28'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'])
 assert.equal(shiftDate('2028-02-28',1),'2028-02-29')
})
