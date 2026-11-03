import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesJourneyStaySearch, toJourneyStayRows, type JourneyStayRequest } from './journey-stays'

const base: JourneyStayRequest = {
  id: '00000000-0000-4000-8000-000000000001', reference: 'WR-2611-0011', status: 'new',
  customer_name: 'Guest A', customer_phone: '01000000001', accommodation_id: 'acc-1',
  arrival_date: '2026-11-20', departure_date: '2026-11-22', adults: 2, children: 1,
  submitted_at: '2026-11-03T09:00:00Z', created_at: '2026-11-03T08:59:00Z',
  converted_booking_id: null, converted_at: null,
}

test('an unconverted Build Your Trip hotel request is listed as requested, with no booking', () => {
  const [row] = toJourneyStayRows([base], [])
  assert.equal(row.state, 'requested')
  assert.equal(row.reference, 'WR-2611-0011')
  assert.equal(row.component, null)
  assert.equal(row.people, 3)
})

test('a converted journey is listed once, with its hotel booking linked to the parent', () => {
  const converted = { ...base, id: '00000000-0000-4000-8000-000000000002', reference: 'WR-2610-0008', status: 'confirmed', converted_booking_id: 'd51a6951-0000-4000-8000-000000000000', converted_at: '2026-10-25T10:00:00Z' }
  const rows = toJourneyStayRows([converted], [{ id: 'd51a6951-0000-4000-8000-000000000000', trip_request_id: converted.id, status: 'confirmed' }])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].state, 'converted')
  assert.deepEqual(rows[0].component, { id: 'd51a6951-0000-4000-8000-000000000000', reference: 'BK-D51A6951', status: 'confirmed' })
})

test('journeys without accommodation (trips only, transport only) are not stays', () => {
  assert.equal(toJourneyStayRows([{ ...base, accommodation_id: null }], []).length, 0)
})

test('cancelled requests stay findable but are marked cancelled', () => {
  assert.equal(toJourneyStayRows([{ ...base, status: 'cancelled' }], [])[0].state, 'cancelled')
})

test('newest submission first, stable on ties, falling back to created_at when never submitted', () => {
  const older = { ...base, id: '00000000-0000-4000-8000-0000000000a1', reference: 'WR-2610-0001', submitted_at: '2026-10-01T09:00:00Z' }
  const tieA = { ...base, id: '00000000-0000-4000-8000-0000000000b1', reference: 'WR-2611-0002' }
  const tieB = { ...base, id: '00000000-0000-4000-8000-0000000000b2', reference: 'WR-2611-0003' }
  const draft = { ...base, id: '00000000-0000-4000-8000-0000000000c1', reference: 'WR-2611-0004', submitted_at: null, created_at: '2026-11-04T00:00:00Z' }
  const order = (list: JourneyStayRequest[]) => toJourneyStayRows(list, []).map((r) => r.reference)
  assert.deepEqual(order([older, tieA, tieB, draft]), ['WR-2611-0004', 'WR-2611-0003', 'WR-2611-0002', 'WR-2610-0001'])
  assert.deepEqual(order([tieB, draft, older, tieA]), ['WR-2611-0004', 'WR-2611-0003', 'WR-2611-0002', 'WR-2610-0001'])
})

test('search matches WR and BK references, customer and hotel name', () => {
  const [row] = toJourneyStayRows([{ ...base, converted_booking_id: 'd51a6951-x' }], [{ id: 'd51a6951-0000-4000-8000-000000000000', trip_request_id: base.id, status: 'new' }])
  for (const q of ['wr-2611', 'BK-D51A', 'guest a', '0100000', 'cabana']) {
    assert.equal(matchesJourneyStaySearch(row, q, 'Cabana House – Velvet'), true, q)
  }
  assert.equal(matchesJourneyStaySearch(row, 'nothing-like-this', 'Cabana House'), false)
})
