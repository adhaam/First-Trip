import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone } from './phone'

test('normalizePhone resolves common Egyptian variants to the same E.164 number', () => {
  const expected = '+201012345678'
  assert.equal(normalizePhone('01012345678'), expected)
  assert.equal(normalizePhone('+201012345678'), expected)
  assert.equal(normalizePhone('00201012345678'), expected)
  assert.equal(normalizePhone('201012345678'), expected)
  assert.equal(normalizePhone('1012345678'), expected)
})

test('normalizePhone strips formatting characters', () => {
  assert.equal(normalizePhone('010 1234 5678'), '+201012345678')
  assert.equal(normalizePhone('+20 10 1234 5678'), '+201012345678')
  assert.equal(normalizePhone('(010) 123-45678'), '+201012345678')
})

test('normalizePhone falls back to a generic + prefix for non-Egyptian numbers without reordering digits', () => {
  assert.equal(normalizePhone('447911123456'), '+447911123456')
  assert.equal(normalizePhone('00447911123456'), '+447911123456')
})

test('normalizePhone returns null for unparsable input', () => {
  assert.equal(normalizePhone(''), null)
  assert.equal(normalizePhone(null), null)
  assert.equal(normalizePhone(undefined), null)
  assert.equal(normalizePhone('123'), null)
})
