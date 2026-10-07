import assert from 'node:assert/strict'
import test from 'node:test'
import { tripRequestQuoteSchema, tripRequestSchema } from '@/lib/trip-requests/schema'
import { quoteReadiness, sectionStatus, toQuotePayload, toSubmitPayload } from './sections'
import type { BuilderCatalog } from './types'

const stay = '00000000-0000-4000-8000-000000000001'
const upgrade = '00000000-0000-4000-8000-000000000002'
const trip = '00000000-0000-4000-8000-000000000003'

const minimalCatalog: BuilderCatalog = {
  today: '2026-10-01',
  schedule: { services: [], weeklyRules: [], exceptions: [], stayPatterns: [], recommendedCheckInWeekdays: [] },
  governorates: [],
  transferServices: [],
  accommodations: [],
  trips: [],
  packages: [],
  paymentPolicies: [],
}

test('quote and submit payloads preserve only applicable fields', () => {
  const stayOnly = toQuotePayload({ transport_mode: 'stay_only', arrival_date: '2026-10-10', departure_date: '2026-10-12', adults: 2, children: 0, accommodation_id: stay, room_allocations: [{ type: 'double', count: 1 }], meal_plan_key: 'breakfast', upgrade_id: upgrade, origin_governorate_code: 'cairo', stay_pattern_code: 'ignored', experiences: [{ kind: 'trip', id: trip, preferred_date: '2026-10-11' }] }, 'en')
  assert.equal(tripRequestQuoteSchema.safeParse(stayOnly).success, true)
  assert.equal('origin_governorate_code' in stayOnly, false)
  const bus = toQuotePayload({ transport_mode: 'package_bus', arrival_date: '2026-10-06', departure_date: 'ignored', adults: 1, children: 0, accommodation_id: stay, origin_governorate_code: 'cairo', stay_pattern_code: 'three', experiences: [] }, 'en')
  assert.equal(tripRequestQuoteSchema.safeParse(bus).success, true)
  assert.equal('departure_date' in bus, false)
  const hiace = toQuotePayload({ transport_mode: 'hiace', arrival_date: '2026-10-06', adults: 1, children: 0, origin_governorate_code: 'giza', stay_pattern_code: 'hiace', room_allocations: [{ type: 'double', count: 1 }], meal_plan_key: 'ignored', upgrade_id: upgrade, experiences: [] }, 'en')
  assert.equal(tripRequestQuoteSchema.safeParse(hiace).success, true)
  assert.equal('room_allocations' in hiace, false)
  assert.equal(tripRequestSchema.safeParse(toSubmitPayload(stayOnly, { name: 'Ada Lovelace', phone: '+201000000000' }, 'en')).success, true)
  assert.equal(toSubmitPayload(stayOnly, { name: 'Ada Lovelace', phone: '+201000000000' }, 'en').travellers_confirmed, true)
})

test('quote readiness reports each required missing section', () => {
  assert.deepEqual(quoteReadiness({ adults: 0, children: 0, experiences: [], contact: {} }).missing, ['transport', 'origin', 'dates', 'travelers'])
  assert.deepEqual(quoteReadiness({ transport_mode: 'stay_only', adults: 1, children: 0, experiences: [], contact: {} }).missing, ['dates', 'stay', 'travelers'])
  assert.deepEqual(quoteReadiness({ transport_mode: 'stay_only', adults: 1, children: 0, travellers_confirmed: true, experiences: [], contact: {} }).missing, ['dates', 'stay'])
})

test('a stay-only range is not ready until check-out is after check-in', async () => {
  const { quoteReadiness } = await import('./sections')
  const base = { transport_mode: 'stay_only' as const, accommodation_id: '00000000-0000-4000-8000-000000000001', adults: 1, children: 0, travellers_confirmed: true, experiences: [] }
  assert.deepEqual(quoteReadiness({ ...base, arrival_date: '2026-10-08', departure_date: '2026-10-08' }).missing, ['dates'])
  assert.deepEqual(quoteReadiness({ ...base, arrival_date: '2026-10-08' }).missing, ['dates'])
  assert.equal(quoteReadiness({ ...base, arrival_date: '2026-10-08', departure_date: '2026-10-11' }).ready, true)
})

test('travellers section requires an explicit confirmation, not just a default adult count', () => {
  const unconfirmed = sectionStatus({ adults: 1, children: 0, experiences: [] }, minimalCatalog)
  assert.equal(unconfirmed.travelers.status, 'needs_input')
  assert.equal(unconfirmed.travelers.reason, 'travellers_confirmation_required')

  const confirmed = sectionStatus({ adults: 1, children: 0, travellers_confirmed: true, experiences: [] }, minimalCatalog)
  assert.equal(confirmed.travelers.status, 'complete')

  // A draft saved before `travellers_confirmed` existed must come back unconfirmed, not complete.
  const oldDraft = sectionStatus({ adults: 2, children: 0, experiences: [] }, minimalCatalog)
  assert.equal(oldDraft.travelers.status, 'needs_input')
})
