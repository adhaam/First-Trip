import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_POLICIES,
  paymentKindFor,
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

test('paymentKindFor prioritizes stored payment_kind over legacy fallbacks', () => {
  assert.equal(paymentKindFor({ payment_kind: 'experience_package', table: 'trip_bookings', trip_package_id: 'package-id' }), 'experience_package')
  assert.equal(paymentKindFor({ payment_kind: 'stay_package', booking_type: 'accommodation-only' }), 'stay_package')
})

test('paymentKindFor uses only explicit legacy classifications during the migration rollout', () => {
  assert.equal(paymentKindFor({ booking_type: 'package' }), 'stay_package')
  assert.equal(paymentKindFor({ booking_type: 'accommodation-only' }), 'stay')
  assert.equal(paymentKindFor({ booking_type: 'transfer-only' }), 'transfer')
  assert.equal(paymentKindFor({ table: 'trip_bookings', trip_package_id: 'package-id', trip_package: { payment_kind: 'stay_package' } }), 'stay_package')
  assert.equal(paymentKindFor({ table: 'trip_bookings', trip_package_id: 'package-id' }), 'experience_package')
  assert.equal(paymentKindFor({ trip_package_id: null }), 'trip')
  assert.equal(paymentKindFor({ table: 'trip_bookings' }), 'trip')
})

test('Dahab stay package and stay only split 2,001 EGP after confirmation and on arrival', () => {
  for (const kind of ['stay_package', 'stay'] as const) {
    assert.deepEqual(paymentPlan(kind, 2001), {
      kind, rule: 'policy', upfrontPercent: 50,
      upfrontAmount: 1001, balanceAmount: 1000, upfrontDue: 'after_confirmation',
      balanceDue: 'on_arrival', payableNow: false,
    })
  }
})

test('experience packages, standalone trips, and transfers are fully due after confirmation', () => {
  for (const kind of ['experience_package', 'trip', 'transfer'] as const) {
    const plan = paymentPlan(kind, 800)
    assert.equal(plan.upfrontAmount, 800)
    assert.equal(plan.balanceAmount, 0)
    assert.equal(plan.upfrontDue, 'after_confirmation')
    assert.equal(plan.balanceDue, null)
    assert.equal(plan.payableNow, false)
  }
})

test('signature requests remain per quote', () => {
  assert.deepEqual(paymentPlan('signature', 5000), {
    kind: 'signature', rule: 'per_quote', upfrontPercent: null, upfrontAmount: null,
    balanceAmount: null, upfrontDue: 'after_confirmation', balanceDue: null, payableNow: false,
  })
})

test('payment plans are never payable immediately', () => {
  for (const kind of ['stay', 'stay_package', 'transfer', 'trip', 'experience_package', 'signature', 'commerce', 'rental'] as const) {
    assert.equal(paymentPlan(kind, 100).payableNow, false)
  }
})

test('combined plans add a stay package, experience package, and trip independently', () => {
  const combined = paymentPlanForParts([
    { kind: 'stay_package', total: 2001 },
    { kind: 'experience_package', total: 499 },
    { kind: 'trip', total: 800 },
  ])
  assert.deepEqual(combined, {
    kind: 'combined', rule: 'policy', upfrontPercent: null,
    upfrontAmount: 2300, balanceAmount: 1000, upfrontDue: 'after_confirmation',
    balanceDue: null, payableNow: false,
  })
})

test('invalid totals are rejected', () => {
  assert.throws(() => paymentPlan('trip', -1))
  assert.throws(() => paymentPlan('trip', Number.NaN))
})
