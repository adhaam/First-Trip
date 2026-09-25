import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone } from './phone'
import { findOrCreateCustomerWithClient } from './customer-resolution'
import { createFakeSupabase } from './testing/fake-supabase'

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

// ─── findOrCreateCustomerWithClient (the core of findOrCreateCustomerByPhone) ───

const existingCustomer = {
  id: 'cust-1',
  name: 'Mona Adel',
  phone: '01012345678',
  normalized_phone: '+201012345678',
  email: 'mona@example.com',
  whatsapp_phone: null,
  merged_into: null,
}

test('an existing customer is matched on normalized phone and name/email are never overwritten', async () => {
  const { client, tables, ops } = createFakeSupabase({ customers: [existingCustomer] })
  const c = await findOrCreateCustomerWithClient(client, {
    phone: '+20 10 1234 5678',
    name: 'Someone Else',
    email: 'other@example.com',
  })
  assert.equal(c.id, 'cust-1')
  assert.equal(tables.customers.length, 1)
  assert.equal(tables.customers[0].name, 'Mona Adel')
  assert.equal(tables.customers[0].email, 'mona@example.com')
  const update = ops.find((o) => o.kind === 'update')
  assert.ok(update)
  assert.deepEqual(Object.keys(update.values!), ['last_activity_at'])
})

test('blank email and placeholder name (= phone) on an existing customer are filled in', async () => {
  const { client, tables } = createFakeSupabase({
    customers: [{ ...existingCustomer, name: '01012345678', email: null }],
  })
  await findOrCreateCustomerWithClient(client, { phone: '01012345678', name: 'Mona Adel', email: 'mona@example.com' })
  assert.equal(tables.customers[0].name, 'Mona Adel')
  assert.equal(tables.customers[0].email, 'mona@example.com')
})

test('a merged (superseded) duplicate is never matched — only canonical rows are', async () => {
  const { client, tables } = createFakeSupabase({
    customers: [{ ...existingCustomer, id: 'dupe', merged_into: 'cust-canon' }],
  })
  const c = await findOrCreateCustomerWithClient(client, { phone: '01012345678', name: 'Mona' })
  assert.notEqual(c.id, 'dupe')
  assert.equal(tables.customers.length, 2)
})

test('an unknown phone creates a customer with the normalized phone', async () => {
  const { client, tables } = createFakeSupabase({ customers: [] })
  const c = await findOrCreateCustomerWithClient(client, { phone: '010 9999 0000', name: 'New Person', email: null })
  assert.equal(tables.customers.length, 1)
  assert.equal(c.normalized_phone, '+201099990000')
  assert.equal(c.name, 'New Person')
  assert.equal(c.phone, '010 9999 0000')
})

test('losing an insert race returns the concurrent winner instead of failing', async () => {
  const { client } = createFakeSupabase(
    { customers: [] },
    {
      beforeInsert: (table, _row, tables) => {
        if (table !== 'customers') return null
        tables.customers.push({ ...existingCustomer, id: 'winner' })
        return { message: 'duplicate key value violates unique constraint', code: '23505' }
      },
    },
  )
  const c = await findOrCreateCustomerWithClient(client, { phone: '01012345678', name: 'Mona' })
  assert.equal(c.id, 'winner')
})
