import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_POLICIES,
  bookingKindFor,
  paymentPlan,
  paymentPlanForParts,
} from './payment-rules'

const migration = readFileSync(new URL('../../supabase/migrations/030_payment_policies.sql', import.meta.url), 'utf8')

function insertValues(table: 'payment_policies' | 'payment_methods') {
  const match = migration.match(new RegExp(`INSERT INTO public\\.${table}[^]*?VALUES\\s*([^]*?)\\s*ON CONFLICT`))
  assert.ok(match, `Could not find ${table} seed INSERT`)
  return [...match[1].matchAll(/\(([^()]*)\)/g)].map((row) =>
    [...row[1].matchAll(/(?:'((?:''|[^'])*)')|(true|false|NULL)|(-?\d+(?:\.\d+)?)/g)].map((value) => {
      if (value[1] !== undefined) return value[1].replace(/''/g, "'")
      if (value[2] === 'NULL') return null
      if (value[2] !== undefined) return value[2] === 'true'
      return Number(value[3])
    }),
  )
}

test('default payment policies exactly mirror the 030 migration seed', () => {
  const rows = insertValues('payment_policies').map(([booking_kind, upfront_percent, upfront_due, balance_due]) => ({ booking_kind, upfront_percent, upfront_due, balance_due }))
  assert.deepEqual(DEFAULT_PAYMENT_POLICIES, rows)
})

test('default payment methods exactly mirror the 030 migration seed', () => {
  const rows = insertValues('payment_methods').map(([code, name_ar, name_en, on_request_only, sort_order]) => ({ code, name_ar, name_en, on_request_only, sort_order }))
  assert.deepEqual(DEFAULT_PAYMENT_METHODS, rows)
})

test('bookingKindFor maps accommodation and trip request table vocabularies', () => {
  assert.equal(bookingKindFor({ booking_type: 'package' }), 'accommodation_package')
  assert.equal(bookingKindFor({ booking_type: 'accommodation-only' }), 'accommodation_stay')
  assert.equal(bookingKindFor({ booking_type: 'transfer-only' }), 'transfer')
  assert.equal(bookingKindFor({ table: 'trip_bookings', context: 'package' }), 'trip_package')
  assert.equal(bookingKindFor({ table: 'trip_bookings', context: 'standalone' }), 'trip')
  assert.equal(bookingKindFor('signature'), 'signature')
})

test('payment plans round EGP half up and always wait for confirmation', () => {
  assert.deepEqual(paymentPlan('accommodation_stay', 2001), {
    kind: 'accommodation_stay', rule: 'policy', upfrontPercent: 50,
    upfrontAmount: 1001, balanceAmount: 1000, upfrontDue: 'after_confirmation',
    balanceDue: 'on_arrival', payableNow: false,
  })
})

test('100 percent transfer and trip-package policies have no balance', () => {
  for (const kind of ['transfer', 'trip_package'] as const) {
    const plan = paymentPlan(kind, 800)
    assert.equal(plan.upfrontAmount, 800)
    assert.equal(plan.balanceAmount, 0)
    assert.equal(plan.balanceDue, null)
    assert.equal(plan.payableNow, false)
  }
})

test('kinds without an active policy are per quote', () => {
  assert.deepEqual(paymentPlan('signature', 5000), {
    kind: 'signature', rule: 'per_quote', upfrontPercent: null, upfrontAmount: null,
    balanceAmount: null, upfrontDue: 'after_confirmation', balanceDue: null, payableNow: false,
  })
})

test('combined plans add independently rounded part amounts', () => {
  const combined = paymentPlanForParts([
    { kind: 'accommodation_package', total: 2001 },
    { kind: 'trip', total: 499 },
  ])
  assert.equal(combined.upfrontAmount, 1500)
  assert.equal(combined.balanceAmount, 1000)
  assert.equal(combined.payableNow, false)
})

test('invalid totals are rejected', () => {
  assert.throws(() => paymentPlan('trip', -1))
  assert.throws(() => paymentPlan('trip', Number.NaN))
})
