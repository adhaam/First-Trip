import assert from 'node:assert/strict'
import test from 'node:test'
import { ledgerOnlyFieldsIn } from './ledger-fields'

test('detects every ledger-only field and nothing else', () => {
  assert.deepEqual(ledgerOnlyFieldsIn({ status: 'confirmed', notes: 'x' }), [])
  assert.deepEqual(ledgerOnlyFieldsIn({ amount_paid: 10, payment_status: 'paid' }), ['payment_status', 'amount_paid'])
  assert.deepEqual(ledgerOnlyFieldsIn({ payment_notes: 'kept' }), [])
  assert.deepEqual(ledgerOnlyFieldsIn(null), [])
})
