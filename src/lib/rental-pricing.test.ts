import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteRental, resolveDeliveryFee, type RentalPricingTier } from './rental-pricing'

const scooterTiers: RentalPricingTier[] = [
  { id: '1', product_id: 'p1', variant_id: null, duration_days: 1, price: 500, is_active: true },
  { id: '2', product_id: 'p1', variant_id: null, duration_days: 3, price: 1350, is_active: true },
  { id: '3', product_id: 'p1', variant_id: null, duration_days: 7, price: 2800, is_active: true },
  { id: '4', product_id: 'p1', variant_id: null, duration_days: 14, price: 5000, is_active: true },
  { id: '5', product_id: 'p1', variant_id: null, duration_days: 30, price: 8500, is_active: true },
]

test('quoteRental picks the exact duration tier and multiplies by quantity', () => {
  const quote = quoteRental({ tiers: scooterTiers, requestedDays: 7, quantity: 2 })
  assert.ok(quote)
  assert.equal(quote!.durationDays, 7)
  assert.equal(quote!.unitPrice, 2800)
  assert.equal(quote!.subtotal, 5600)
  assert.equal(quote!.roundedUp, false)
})

test('quoteRental rounds up to the next covering tier when no exact match exists', () => {
  // Product only exposes 1 / 7 / 30 day tiers — a 5-day request must round up to 7.
  const limitedTiers = scooterTiers.filter((t) => [1, 7, 30].includes(t.duration_days))
  const quote = quoteRental({ tiers: limitedTiers, requestedDays: 5, quantity: 1 })
  assert.ok(quote)
  assert.equal(quote!.durationDays, 7)
  assert.equal(quote!.roundedUp, true)
})

test('quoteRental scopes tiers to the requested variant', () => {
  const withVariant: RentalPricingTier[] = [
    ...scooterTiers,
    { id: '6', product_id: 'p1', variant_id: 'v1', duration_days: 1, price: 700, is_active: true },
  ]
  const quote = quoteRental({ tiers: withVariant, variantId: 'v1', requestedDays: 1, quantity: 1 })
  assert.ok(quote)
  assert.equal(quote!.unitPrice, 700)
})

test('quoteRental returns null when no active tier is configured', () => {
  assert.equal(quoteRental({ tiers: [], requestedDays: 3, quantity: 1 }), null)
})

test('resolveDeliveryFee returns 0 for pickup, the fixed fee for a fixed zone, and 0 for quote zones', () => {
  assert.equal(resolveDeliveryFee({ fulfillmentMethod: 'pickup', zone: { fee_type: 'fixed', fixed_fee: 100 } }), 0)
  assert.equal(resolveDeliveryFee({ fulfillmentMethod: 'delivery', zone: { fee_type: 'fixed', fixed_fee: 100 } }), 100)
  assert.equal(resolveDeliveryFee({ fulfillmentMethod: 'delivery', zone: { fee_type: 'free', fixed_fee: 0 } }), 0)
  assert.equal(resolveDeliveryFee({ fulfillmentMethod: 'delivery', zone: { fee_type: 'quote', fixed_fee: 0 } }), 0)
  assert.equal(resolveDeliveryFee({ fulfillmentMethod: 'delivery', zone: null }), 0)
})
