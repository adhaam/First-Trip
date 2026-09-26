// ─── WEEMAP Editions domain logic tests ───
// Run with:  npx tsx --test src/lib/editions.test.ts

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isPubliclyVisible,
  ctaIntentFor,
  sortedProgram,
  paymentSchedule,
  worksheet,
  editionAdminSchema,
  editionRequestSchema,
} from './editions'

// ─── isPubliclyVisible ───

test('unpublished Editions are never publicly visible', () => {
  assert.equal(isPubliclyVisible({ published: false, status: 'OPEN' }), false)
})

test('HIDDEN Editions are never publicly visible, even when published', () => {
  assert.equal(isPubliclyVisible({ published: true, status: 'HIDDEN' }), false)
})

test('published + non-HIDDEN status is publicly visible', () => {
  assert.equal(isPubliclyVisible({ published: true, status: 'COMING_SOON' }), true)
  assert.equal(isPubliclyVisible({ published: true, status: 'COMPLETED' }), true)
})

// ─── ctaIntentFor ───

test('COMING_SOON maps to NOTIFY', () => {
  assert.equal(ctaIntentFor('COMING_SOON'), 'NOTIFY')
})

test('bookable statuses map to JOIN', () => {
  assert.equal(ctaIntentFor('OPEN'), 'JOIN')
  assert.equal(ctaIntentFor('GUARANTEED'), 'JOIN')
  assert.equal(ctaIntentFor('FEW_SPOTS'), 'JOIN')
})

test('WAITLIST and SOLD_OUT map to ASK', () => {
  assert.equal(ctaIntentFor('WAITLIST'), 'ASK')
  assert.equal(ctaIntentFor('SOLD_OUT'), 'ASK')
})

test('COMPLETED and HIDDEN have no CTA', () => {
  assert.equal(ctaIntentFor('COMPLETED'), null)
  assert.equal(ctaIntentFor('HIDDEN'), null)
})

// ─── sortedProgram ───

test('program ordering follows the stored array index, not a separate field', () => {
  const program = [
    { label_en: '1', label_ar: '1', title_en: 'Arrive', title_ar: '', description_en: '', description_ar: '' },
    { label_en: '2', label_ar: '2', title_en: 'Dive', title_ar: '', description_en: '', description_ar: '' },
  ]
  const result = sortedProgram({ program })
  assert.deepEqual(result.map((p) => p.title_en), ['Arrive', 'Dive'])
})

test('sortedProgram never mutates the input array', () => {
  const program = [
    { label_en: '1', label_ar: '1', title_en: 'A', title_ar: '', description_en: '', description_ar: '' },
  ]
  const result = sortedProgram({ program })
  assert.notEqual(result, program)
})

// ─── paymentSchedule (Coming Soon has no commercial fields rendered) ───

test('missing payment_mode renders no payment descriptor (Coming Soon Editions)', () => {
  assert.equal(
    paymentSchedule({
      payment_mode: null, deposit_value: null, balance_due_days_before_start: null, price_per_person_egp: null,
    }),
    null,
  )
})

test('missing price renders no payment descriptor even if payment_mode is set', () => {
  assert.equal(
    paymentSchedule({
      payment_mode: 'PAY_IN_FULL', deposit_value: null, balance_due_days_before_start: null, price_per_person_egp: null,
    }),
    null,
  )
})

test('PAY_IN_FULL descriptor', () => {
  const d = paymentSchedule({
    payment_mode: 'PAY_IN_FULL', deposit_value: null, balance_due_days_before_start: null, price_per_person_egp: 5000,
  })
  assert.deepEqual(d, {
    kind: 'PAY_IN_FULL', depositPercent: null, depositAmountEgp: null, balanceDueDaysBeforeStart: null,
  })
})

test('PERCENT_DEPOSIT descriptor carries the percent and balance window', () => {
  const d = paymentSchedule({
    payment_mode: 'PERCENT_DEPOSIT', deposit_value: 30, balance_due_days_before_start: 14, price_per_person_egp: 5000,
  })
  assert.deepEqual(d, {
    kind: 'PERCENT_DEPOSIT', depositPercent: 30, depositAmountEgp: null, balanceDueDaysBeforeStart: 14,
  })
})

test('PERCENT_DEPOSIT with an out-of-range percent is invalid config → null', () => {
  assert.equal(
    paymentSchedule({
      payment_mode: 'PERCENT_DEPOSIT', deposit_value: 150, balance_due_days_before_start: 14,
      price_per_person_egp: 5000,
    }),
    null,
  )
  assert.equal(
    paymentSchedule({
      payment_mode: 'PERCENT_DEPOSIT', deposit_value: 0, balance_due_days_before_start: 14,
      price_per_person_egp: 5000,
    }),
    null,
  )
})

test('FIXED_DEPOSIT descriptor carries the EGP amount', () => {
  const d = paymentSchedule({
    payment_mode: 'FIXED_DEPOSIT', deposit_value: 1500, balance_due_days_before_start: 7, price_per_person_egp: 5000,
  })
  assert.deepEqual(d, {
    kind: 'FIXED_DEPOSIT', depositPercent: null, depositAmountEgp: 1500, balanceDueDaysBeforeStart: 7,
  })
})

test('FIXED_DEPOSIT with a missing/zero amount is invalid config → null', () => {
  assert.equal(
    paymentSchedule({
      payment_mode: 'FIXED_DEPOSIT', deposit_value: null, balance_due_days_before_start: 7, price_per_person_egp: 5000,
    }),
    null,
  )
})

// ─── worksheet (decision support only, never mutates price) ───

test('worksheet computes cost/contribution/margin at min group size', () => {
  const w = worksheet({
    min_group_size: 6, price_per_person_egp: 5000,
    cost_variable_per_guest_egp: 2000, cost_fixed_egp: 3000, contingency_pct: 10,
  })
  assert.ok(w)
  // (6*2000 + 3000) * 1.10 = 16500
  assert.equal(w!.costAtMin, 16500)
  // revenue = 30000, contribution = 30000 - 16500 = 13500
  assert.equal(w!.contributionAtMin, 13500)
  assert.equal(Math.round(w!.marginPct * 100) / 100, 45)
})

test('worksheet is null when min_group_size is missing (never divides by zero)', () => {
  assert.equal(
    worksheet({
      min_group_size: null, price_per_person_egp: 5000,
      cost_variable_per_guest_egp: 2000, cost_fixed_egp: 3000, contingency_pct: 0,
    }),
    null,
  )
})

test('worksheet is null when either cost input is missing', () => {
  assert.equal(
    worksheet({
      min_group_size: 6, price_per_person_egp: 5000,
      cost_variable_per_guest_egp: null, cost_fixed_egp: 3000, contingency_pct: 0,
    }),
    null,
  )
  assert.equal(
    worksheet({
      min_group_size: 6, price_per_person_egp: 5000,
      cost_variable_per_guest_egp: 2000, cost_fixed_egp: null, contingency_pct: 0,
    }),
    null,
  )
})

test('worksheet defaults contingency_pct to 0 when null', () => {
  const w = worksheet({
    min_group_size: 5, price_per_person_egp: 1000,
    cost_variable_per_guest_egp: 100, cost_fixed_egp: 0, contingency_pct: null,
  })
  assert.equal(w!.costAtMin, 500)
})

// ─── zod: editionAdminSchema ───

test('editionAdminSchema accepts a minimal valid Coming Soon record', () => {
  const result = editionAdminSchema.safeParse({
    slug: 'deep-blue', title_en: 'Deep Blue', title_ar: 'ديب بلو', category: 'LEARN',
  })
  assert.equal(result.success, true)
})

test('editionAdminSchema rejects an uppercase/invalid slug', () => {
  const result = editionAdminSchema.safeParse({
    slug: 'Deep Blue', title_en: 'Deep Blue', title_ar: 'ديب بلو', category: 'LEARN',
  })
  assert.equal(result.success, false)
})

test('editionAdminSchema rejects an unknown category', () => {
  const result = editionAdminSchema.safeParse({
    slug: 'deep-blue', title_en: 'Deep Blue', title_ar: 'ديب بلو', category: 'SCUBA',
  })
  assert.equal(result.success, false)
})

test('editionAdminSchema rejects end_date before start_date', () => {
  const result = editionAdminSchema.safeParse({
    slug: 'deep-blue', title_en: 'Deep Blue', title_ar: 'ديب بلو', category: 'LEARN',
    start_date: '2026-05-10', end_date: '2026-05-01',
  })
  assert.equal(result.success, false)
})

test('editionAdminSchema partner_id is optional — an Edition need not have a partner', () => {
  const result = editionAdminSchema.safeParse({
    slug: 'reset-sinai', title_en: 'Reset Sinai', title_ar: 'ريست سيناء', category: 'RETREAT',
  })
  assert.equal(result.success, true)
  assert.equal(result.data?.partner_id, undefined)
})

// ─── zod: editionRequestSchema ───

test('editionRequestSchema requires edition_id', () => {
  const result = editionRequestSchema.safeParse({
    intent: 'JOIN', customer_name: 'Sara', phone: '01012345678', locale: 'en',
  })
  assert.equal(result.success, false)
})

test('editionRequestSchema accepts a minimal valid JOIN request', () => {
  const result = editionRequestSchema.safeParse({
    edition_id: '11111111-1111-1111-1111-111111111111',
    intent: 'JOIN', customer_name: 'Sara', phone: '01012345678', locale: 'en',
  })
  assert.equal(result.success, true)
})

test('editionRequestSchema rejects an unknown intent', () => {
  const result = editionRequestSchema.safeParse({
    edition_id: '11111111-1111-1111-1111-111111111111',
    intent: 'BOOK', customer_name: 'Sara', phone: '01012345678', locale: 'en',
  })
  assert.equal(result.success, false)
})
