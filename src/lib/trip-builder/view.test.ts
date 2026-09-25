import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteErrorKey } from './view'

test('maps quote errors to stable message keys', () => {
  assert.equal(quoteErrorKey('SCHEDULE_BLACKOUT'), 'quoteScheduleError')
  assert.equal(quoteErrorKey('429'), 'quoteRateLimited')
  assert.equal(quoteErrorKey('OTHER'), 'quoteError')
})
