import assert from 'node:assert/strict'
import test from 'node:test'

import { todayInCairo } from './today'

test('todayInCairo returns the Africa/Cairo calendar date, not the UTC one', () => {
  // Summer (Cairo is UTC+3): 22:30 UTC is already past midnight in Cairo.
  assert.equal(todayInCairo(new Date('2026-09-24T22:30:00Z')), '2026-09-25')

  // Winter (Cairo is UTC+2): the boundary sits at 22:00 UTC.
  assert.equal(todayInCairo(new Date('2026-01-10T21:59:00Z')), '2026-01-10')
  assert.equal(todayInCairo(new Date('2026-01-10T22:01:00Z')), '2026-01-11')
})
