import assert from 'node:assert/strict'
import test from 'node:test'
import { paymentPlanSummary, quoteSnapshotLines } from './trip-request-admin'

test('paymentPlanSummary describes the stored confirmation and arrival terms', () => {
  const plan = { upfrontPercent: 50, upfrontDue: 'after_confirmation', balanceDue: 'on_arrival' }
  assert.equal(paymentPlanSummary(plan, 'en'), '50% after confirmation · balance on arrival')
  assert.equal(paymentPlanSummary(plan, 'ar'), '50% بعد التأكيد · المتبقي عند الوصول')
})

test('quoteSnapshotLines accepts only display-safe frozen line data', () => {
  assert.deepEqual(quoteSnapshotLines({ lines: [{ label_ar: 'إقامة', label_en: 'Stay', amount: 1200 }, null, { label_en: 3 }] }, 'en'), [
    { label: 'Stay', detail: '', amount: 1200 },
  ])
  assert.deepEqual(quoteSnapshotLines({}, 'ar'), [])
})
