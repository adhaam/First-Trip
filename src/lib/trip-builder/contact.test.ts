import assert from 'node:assert/strict'
import test from 'node:test'
import { contactErrors } from './contact'

test('contactErrors is empty for a valid contact', () => {
  assert.deepEqual(contactErrors({ name: 'Ada Lovelace', phone: '+201000000000' }), {})
  assert.deepEqual(contactErrors({ name: 'Ada Lovelace', phone: '+201000000000', email: '' }), {})
})

test('contactErrors flags each invalid field by its message key', () => {
  assert.deepEqual(contactErrors({}), { name: 'errorName', phone: 'errorPhone' })
  assert.deepEqual(contactErrors({ name: 'Al', phone: '123' }), { name: 'errorName', phone: 'errorPhone' })
  assert.deepEqual(contactErrors({ name: 'Ada Lovelace', phone: '+201000000000', email: 'not-an-email' }), { email: 'errorEmail' })
})
