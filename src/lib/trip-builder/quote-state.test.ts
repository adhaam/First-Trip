import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteReconciles, settledQuote } from './quote-state'
import type { QuoteView } from './view'

const quote = (total: number, amounts: number[]): QuoteView => ({
  total,
  lines: amounts.map((amount, index) => ({ key: `l${index}`, label_ar: '', label_en: '', amount })),
  payment: { kind: 'journey', rule: 'policy', upfrontPercent: 50, upfrontAmount: total / 2, balanceAmount: total / 2, upfrontDue: 'after_confirmation', balanceDue: 'on_arrival', payableNow: false },
})

test('a quote priced for older selections is never shown — the panel recalculates instead', () => {
  const answer = { key: 'with-hotel', quote: quote(9000, [6000, 3000]), errorKey: '' }
  assert.deepEqual(settledQuote(answer, 'without-hotel'), { quote: null, refreshing: true, errorKey: '' })
  assert.equal(settledQuote(answer, 'with-hotel').quote?.total, 9000)
})

test('no total at all while the builder is not ready to price (e.g. the stay was just removed)', () => {
  const answer = { key: 'with-hotel', quote: quote(9000, [6000, 3000]), errorKey: '' }
  assert.deepEqual(settledQuote(answer, null), { quote: null, refreshing: false, errorKey: '' })
})

test('a failed re-price shows the error and no total', () => {
  const answer = { key: 'p', quote: null, errorKey: 'quoteRoomsCapacity' }
  assert.deepEqual(settledQuote(answer, 'p'), { quote: null, refreshing: false, errorKey: 'quoteRoomsCapacity' })
})

test('reconciliation: lines must add up exactly to the total', () => {
  assert.equal(quoteReconciles(quote(9000, [6000, 3000])), true)
  assert.equal(quoteReconciles(quote(9000, [6000, 2000])), false)
  assert.equal(quoteReconciles(quote(0.3, [0.1, 0.2])), true)
})
