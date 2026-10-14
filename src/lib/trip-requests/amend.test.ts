import assert from 'node:assert/strict'
import test from 'node:test'
import {
  amendedJourneyPayload,
  amendmentBlocker,
  amendRequestSummary,
  applyBodySchema,
  isAvailabilityConfirmedStatus,
  journeyFromRow,
  parseJourney,
  previewBodySchema,
  resetsAvailability,
  roundMoney,
  type AmendableRow,
} from './amend'
import { buildRevisionViews, revisionListItems, type RevisionRow } from './revisions'

const ACC = '11111111-1111-4111-8111-111111111111'
const TRIP = '22222222-2222-4222-8222-222222222222'
const UPG = '33333333-3333-4333-8333-333333333333'

const row: AmendableRow & { created_at: string } = {
  id: '44444444-4444-4444-8444-444444444444',
  reference: 'WR-2610-0001',
  status: 'checking_availability',
  updated_at: '2026-10-14T10:00:00.123456+00:00',
  created_at: '2026-10-10T08:00:00+00:00',
  source: 'website',
  customer_name: 'Nour Ahmed',
  transport_mode: 'hiace',
  origin_governorate_code: 'CAI',
  stay_pattern_code: 'hiace_5d4n',
  arrival_date: '2026-11-06',
  departure_date: '2026-11-10',
  adults: 2,
  children: 1,
  accommodation_id: ACC,
  room_allocations: [{ type: 'double', count: 1, upgrade_id: UPG }, { type: 'single', count: 1, upgrade_id: null }],
  meal_plan_key: 'half_board',
  experiences: [{ kind: 'trip', id: TRIP, preferred_date: null }],
  amount_paid: '0.00',
  agreed_total: null,
  quoted_total: '9500.00',
  converted_booking_id: null,
}

test('amendmentBlocker: closed statuses and any payment block an amendment', () => {
  const open = { amount_paid: 0, has_payments: false }
  assert.equal(amendmentBlocker({ status: 'checking_availability', ...open }), null)
  assert.equal(amendmentBlocker({ status: 'awaiting_payment', ...open }), null)
  assert.equal(amendmentBlocker({ status: 'confirmed', ...open }), null)
  assert.equal(amendmentBlocker({ status: 'cancelled', ...open }), 'amendment_closed')
  assert.equal(amendmentBlocker({ status: 'completed', ...open }), 'amendment_closed')
  const paid = 'amendment_paid_journey'
  assert.equal(amendmentBlocker({ status: 'confirmed', amount_paid: 100, has_payments: true }), paid)
  assert.equal(amendmentBlocker({ status: 'confirmed', amount_paid: '250.00', has_payments: false }), paid)
  assert.equal(amendmentBlocker({ status: 'confirmed', amount_paid: 0, has_payments: true }), paid)
  assert.equal(amendmentBlocker({ status: 'new', amount_paid: null, has_payments: false }), null)
  // Closed wins over paid: the reason to show first is that nothing can change at all.
  assert.equal(amendmentBlocker({ status: 'cancelled', amount_paid: 50, has_payments: true }), 'amendment_closed')
})

test('availability helpers', () => {
  assert.equal(isAvailabilityConfirmedStatus('awaiting_payment'), true)
  assert.equal(isAvailabilityConfirmedStatus('completed'), true)
  assert.equal(isAvailabilityConfirmedStatus('checking_availability'), false)
  assert.equal(resetsAvailability('confirmed'), true)
  assert.equal(resetsAvailability('awaiting_payment'), true)
  assert.equal(resetsAvailability('completed'), false)
  assert.equal(resetsAvailability('new'), false)
})

test('journeyFromRow round-trips through tripRequestQuoteSchema', () => {
  const journey = journeyFromRow(row)
  assert.deepEqual(journey, {
    transport_mode: 'hiace',
    origin_governorate_code: 'CAI',
    stay_pattern_code: 'hiace_5d4n',
    arrival_date: '2026-11-06',
    departure_date: '2026-11-10',
    adults: 2,
    children: 1,
    accommodation_id: ACC,
    room_allocations: [{ type: 'double', count: 1, upgrade_id: UPG }, { type: 'single', count: 1 }],
    meal_plan_key: 'half_board',
    experiences: [{ kind: 'trip', id: TRIP }],
  })
  const parsed = parseJourney(journey, row.source)
  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.equal(parsed.data.locale, 'en')
  assert.equal(parsed.data.source, 'website')
  const rest: Record<string, unknown> = { ...parsed.data }
  delete rest.locale
  delete rest.source
  assert.deepEqual(rest, journey)
})

test('journeyFromRow handles a stay-only row with nulls and no allocations', () => {
  const journey = journeyFromRow({
    transport_mode: 'stay_only', origin_governorate_code: null, stay_pattern_code: null,
    arrival_date: '2026-12-01T00:00:00+00:00', departure_date: '2026-12-05', adults: 1, children: null,
    accommodation_id: ACC, room_allocations: [], meal_plan_key: null, experiences: null,
  })
  assert.deepEqual(journey, {
    transport_mode: 'stay_only', arrival_date: '2026-12-01', departure_date: '2026-12-05', adults: 1,
    children: 0, accommodation_id: ACC, experiences: [],
  })
  assert.equal(parseJourney(journey, 'manual').success, true)
})

test('parseJourney validates with the Trip Builder schema, strips client totals, defaults the source', () => {
  const parsed = parseJourney({ ...journeyFromRow(row), quoted_total: 1, total: 1, locale: 'ar' }, 'nonsense')
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.locale, 'en')
    assert.equal(parsed.data.source, 'website')
    assert.equal('quoted_total' in parsed.data, false)
  }
  assert.equal(parseJourney({ ...journeyFromRow(row), adults: 0 }).success, false)
  assert.equal(parseJourney({ ...journeyFromRow(row), arrival_date: '06/11/2026' }).success, false)
  assert.equal(parseJourney({ transport_mode: 'stay_only', arrival_date: '2026-12-01', adults: 1 }).success, false)
  assert.equal(parseJourney(null).success, false)
  assert.equal(parseJourney([]).success, false)
})

test('amendRequestSummary exposes the screen fields with numeric money', () => {
  const summary = amendRequestSummary(row)
  assert.equal(summary.id, row.id)
  assert.equal(summary.converted, false)
  assert.equal(summary.amount_paid, 0)
  assert.equal(summary.agreed_total, null)
  assert.equal(summary.quoted_total, 9500)
  assert.equal(summary.updated_at, row.updated_at)
  assert.equal(amendRequestSummary({ ...row, converted_booking_id: ACC, agreed_total: '9500.00' }).converted, true)
  assert.equal(amendRequestSummary({ ...row, agreed_total: '9500.00' }).agreed_total, 9500)
})

test('amendedJourneyPayload sends what was priced, with nulls for absent optionals', () => {
  const input = journeyFromRow(row)
  const payload = amendedJourneyPayload({
    input, departureDate: '2026-11-10', roomAllocations: [{ type: 'double', count: 2, upgrade_id: UPG }],
  })
  assert.equal(payload.room_allocations[0].count, 2)
  assert.equal(payload.stay_pattern_code, 'hiace_5d4n')
  const stayOnly = amendedJourneyPayload({
    input: {
      transport_mode: 'stay_only', stay_pattern_code: 'leftover', arrival_date: '2026-12-01', adults: 1,
      children: 0, experiences: [],
    },
    departureDate: '2026-12-03',
  })
  assert.equal(stayOnly.stay_pattern_code, null)
  assert.equal(stayOnly.origin_governorate_code, null)
  assert.equal(stayOnly.accommodation_id, null)
  assert.deepEqual(stayOnly.room_allocations, [])
})

test('request bodies are strict: totals and unknown keys are rejected', () => {
  const journey = journeyFromRow(row)
  assert.equal(previewBodySchema.safeParse({ journey }).success, true)
  assert.equal(previewBodySchema.safeParse({ journey, total: 1 }).success, false)
  const ok = { journey, expected_updated_at: row.updated_at, reason: 'Customer added a child' }
  assert.equal(applyBodySchema.safeParse(ok).success, true)
  assert.equal(applyBodySchema.safeParse({ ...ok, quoted_total: 100 }).success, false)
  assert.equal(applyBodySchema.safeParse({ ...ok, reason: ' ' }).success, false)
  assert.equal(applyBodySchema.safeParse({ ...ok, expected_updated_at: 'yesterday' }).success, false)
  assert.equal(applyBodySchema.safeParse({ journey, reason: 'long enough' }).success, false)
})

test('roundMoney removes float noise', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3)
  assert.equal(roundMoney(1500), 1500)
  assert.equal(roundMoney(-1200.004), -1200)
})

test('a never-amended request shows its current state as virtual revision 1', () => {
  const views = buildRevisionViews([], { ...row, quote_snapshot: { total: 9500 } })
  assert.equal(views.length, 1)
  assert.equal(views[0].revision_number, 1)
  assert.equal(views[0].kind, 'original')
  assert.equal(views[0].virtual, true)
  assert.equal(views[0].is_current, true)
  assert.equal(views[0].quoted_total, 9500)
  assert.equal(views[0].availability_confirmed, false)
  assert.equal(views[0].journey.arrival_date, '2026-11-06')
})

test('revisions are chained: only the latest is current, older ones point at their successor', () => {
  const base = {
    journey: {}, quote_snapshot: { total: 1 }, payment_plan: null, status_at_revision: 'awaiting_payment',
    availability_confirmed: true, created_by: 'staff@weemap', created_at: '2026-10-11T00:00:00Z',
  }
  const rows: RevisionRow[] = [
    {
      ...base, revision_number: 2, kind: 'amendment', quoted_total: '11000.00', previous_total: '9500',
      difference: '1500', reason: 'Added child',
    },
    {
      ...base, revision_number: 1, kind: 'original', quoted_total: '9500.00', previous_total: null,
      difference: null, reason: null,
    },
    {
      ...base, revision_number: 3, kind: 'amendment', quoted_total: '10000', previous_total: '11000',
      difference: '-1000', reason: 'Dropped trip', availability_confirmed: false,
    },
  ]
  const views = buildRevisionViews(rows, { ...row, quote_snapshot: null })
  assert.deepEqual(
    views.map((v) => [v.revision_number, v.is_current, v.superseded_by]),
    [[1, false, 2], [2, false, 3], [3, true, null]],
  )
  assert.equal(views[2].difference, -1000)
  assert.equal(views[0].virtual, false)
  const list = revisionListItems(views)
  assert.deepEqual(list.map((item) => item.revision_number), [3, 2, 1])
  assert.deepEqual(Object.keys(list[0]).sort(), [
    'availability_confirmed', 'created_at', 'created_by', 'difference', 'is_current', 'kind', 'previous_total',
    'quoted_total', 'reason', 'revision_number', 'status_at_revision',
  ])
})
