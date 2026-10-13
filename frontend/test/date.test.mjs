import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDateTime } from '../src/lib/date.js'
test('payment defaults use the local calendar date rather than the UTC next day', () => {
  const date = { getTime: () => Date.UTC(2026, 9, 6, 4, 30), getTimezoneOffset: () => 360 }
  assert.equal(localDateTime(date), '2026-10-05T22:30')
})
