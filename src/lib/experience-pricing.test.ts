// ─── Signature Experience pricing / partner-privacy tests ───
// Run with:  npx tsx --test src/lib/experience-pricing.test.ts

import test from 'node:test'
import assert from 'node:assert/strict'
import { discountedExperiencePrice, validateExperiencePublishable, toPublicPartners } from './experience-pricing'

test('no discount — price is unchanged', () => {
  assert.equal(discountedExperiencePrice({ price: 5000 }), 5000)
})

test('amount discount subtracts a flat value', () => {
  assert.equal(discountedExperiencePrice({ price: 5000, discount_value: 500, discount_type: 'amount' }), 4500)
})

test('percentage discount computes correctly', () => {
  assert.equal(discountedExperiencePrice({ price: 5000, discount_value: 20, discount_type: 'percentage' }), 4000)
})

test('discount never pushes price below 0', () => {
  assert.equal(discountedExperiencePrice({ price: 100, discount_value: 500, discount_type: 'amount' }), 0)
})

test('Signature price is independent of any Trip Package/trip data — the function never reads trip fields at all', () => {
  // discountedExperiencePrice only ever accepts {price, discount_value, discount_type} — there is
  // no code path by which a linked trip's `package_price` (or anything else) could influence it.
  const withExtraTripLikeFields = { price: 3000, discount_value: null, discount_type: null, package_price: 1, trips: [{ package_price: 1 }] } as never
  assert.equal(discountedExperiencePrice(withExtraTripLikeFields), 3000)
})

test('publish validation rejects zero, negative, null, and undefined price', () => {
  assert.ok(validateExperiencePublishable(0))
  assert.ok(validateExperiencePublishable(-5))
  assert.ok(validateExperiencePublishable(null))
  assert.ok(validateExperiencePublishable(undefined))
})

test('publish validation passes for a real positive price', () => {
  assert.equal(validateExperiencePublishable(3500), null)
})

test('toPublicPartners strips every private field, even when present on the input row', () => {
  const rows = [
    {
      id: 'p1', name: 'Dahab Divers', public_description_ar: 'وصف', public_description_en: 'desc',
      public_credit_enabled: true,
      contact_name: 'Secret Name', contact_phone: '0100000000', contact_email: 'secret@example.com',
      internal_notes: 'Do not show this ever',
    },
  ]
  const result = toPublicPartners(rows)
  assert.equal(result.length, 1)
  assert.deepEqual(Object.keys(result[0]).sort(), ['id', 'name', 'public_description_ar', 'public_description_en'].sort())
  assert.equal(JSON.stringify(result).includes('Secret'), false)
  assert.equal(JSON.stringify(result).includes('0100000000'), false)
  assert.equal(JSON.stringify(result).includes('secret@example.com'), false)
  assert.equal(JSON.stringify(result).includes('Do not show'), false)
})

test('toPublicPartners drops a partner entirely when public_credit_enabled is false', () => {
  const rows = [
    { id: 'p1', name: 'Hidden Partner', public_description_ar: '', public_description_en: '', public_credit_enabled: false },
    { id: 'p2', name: 'Shown Partner', public_description_ar: '', public_description_en: '', public_credit_enabled: true },
  ]
  const result = toPublicPartners(rows)
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'p2')
})
