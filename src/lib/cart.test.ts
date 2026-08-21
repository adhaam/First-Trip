import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCart, serializeCart, emptyCart, addItem, removeItem, updateQuantity,
  cartSubtotal, cartItemCount, addRentalDays,
} from './cart'
import type { CartMerchItem, CartRentalItem } from './commerce-types'

const merchItem: CartMerchItem = {
  kind: 'merch', lineId: 'a', productId: 'p1', variantId: 'v1', slug: 'tee',
  nameAr: 'تيشيرت', nameEn: 'Tee', image: '', optionSummaryAr: '', optionSummaryEn: '',
  unitPriceEstimate: 100, quantity: 2,
}

const rentalItem: CartRentalItem = {
  kind: 'rental', lineId: 'b', productId: 'p2', variantId: null, slug: 'tent',
  nameAr: 'خيمة', nameEn: 'Tent', image: '', optionSummaryAr: '', optionSummaryEn: '',
  durationDays: 3, durationLabelAr: '', durationLabelEn: '', startDate: '2026-09-01', endDate: '2026-09-03',
  quantity: 1, unitPriceEstimate: 300,
}

test('parseCart recovers to empty cart from malformed JSON', () => {
  assert.deepEqual(parseCart('not json'), emptyCart())
  assert.deepEqual(parseCart(null), emptyCart())
  assert.deepEqual(parseCart('{}'), emptyCart())
  assert.deepEqual(parseCart(JSON.stringify({ version: 1, items: [] })), emptyCart())
})

test('parseCart drops invalid line items but keeps valid ones', () => {
  const raw = JSON.stringify({
    version: 2,
    items: [merchItem, { kind: 'merch', productId: 'x' }, { kind: 'bogus' }],
    fulfillmentMethod: 'pickup',
    deliveryZoneId: null,
    deliveryAddress: '',
  })
  const parsed = parseCart(raw)
  assert.equal(parsed.items.length, 1)
  assert.equal(parsed.items[0].lineId, 'a')
})

test('serializeCart round-trips through parseCart', () => {
  const state = { ...emptyCart(), items: [merchItem, rentalItem], fulfillmentMethod: 'delivery' as const, deliveryAddress: 'Dahab' }
  const round = parseCart(serializeCart(state))
  assert.equal(round.items.length, 2)
  assert.equal(round.fulfillmentMethod, 'delivery')
  assert.equal(round.deliveryAddress, 'Dahab')
})

test('addItem merges identical merch product+variant lines by summing quantity', () => {
  const items = addItem([merchItem], { ...merchItem, lineId: 'a2', quantity: 3 })
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, 5)
})

test('addItem keeps distinct variants as separate lines', () => {
  const items = addItem([merchItem], { ...merchItem, lineId: 'a2', variantId: 'v2', quantity: 1 })
  assert.equal(items.length, 2)
})

test('addItem merges rental lines only when product+variant+start+duration all match', () => {
  const same = addItem([rentalItem], { ...rentalItem, lineId: 'b2', quantity: 2 })
  assert.equal(same.length, 1)
  assert.equal(same[0].quantity, 3)

  const differentStart = addItem([rentalItem], { ...rentalItem, lineId: 'b3', startDate: '2026-09-05' })
  assert.equal(differentStart.length, 2)
})

test('updateQuantity removes the line when quantity drops below 1', () => {
  const items = updateQuantity([merchItem], 'a', 0)
  assert.equal(items.length, 0)
})

test('removeItem drops only the targeted line', () => {
  const items = removeItem([merchItem, rentalItem], 'a')
  assert.equal(items.length, 1)
  assert.equal(items[0].lineId, 'b')
})

test('cartSubtotal and cartItemCount sum across mixed cart', () => {
  assert.equal(cartSubtotal([merchItem, rentalItem]), 100 * 2 + 300 * 1)
  assert.equal(cartItemCount([merchItem, rentalItem]), 2 + 1)
})

test('addRentalDays is inclusive of the start day (1 day -> same day return)', () => {
  assert.equal(addRentalDays('2026-09-01', 1), '2026-09-01')
  assert.equal(addRentalDays('2026-09-01', 3), '2026-09-03')
})
