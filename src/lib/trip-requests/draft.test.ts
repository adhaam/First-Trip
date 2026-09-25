import assert from 'node:assert/strict'
import test from 'node:test'
import { DRAFT_VERSION, parseDraft, serializeDraft } from './draft'

test('round-trips a draft through serialize/parse', () => {
  const now = new Date('2026-09-25T12:00:00.000Z')
  const serialized = serializeDraft({
    locale: 'ar',
    transport_mode: 'package_bus',
    origin_governorate_code: 'CAI',
    stay_pattern_code: 'bus_4d3n',
    arrival_date: '2026-10-01',
    adults: 2,
    children: 1,
    experiences: [{ kind: 'trip', id: '22222222-2222-2222-2222-222222222222' }],
    contact: { name: 'Nour' },
  }, now)

  const result = parseDraft(serialized)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.draft.version, DRAFT_VERSION)
  assert.equal(result.draft.updated_at, now.toISOString())
  assert.equal(result.draft.transport_mode, 'package_bus')
  assert.equal(result.draft.adults, 2)
  assert.deepEqual(result.draft.experiences, [{ kind: 'trip', id: '22222222-2222-2222-2222-222222222222' }])
  assert.equal(result.draft.contact?.name, 'Nour')
})

test('rejects an empty or missing value', () => {
  assert.equal(parseDraft(null).ok, false)
  assert.equal(parseDraft(undefined).ok, false)
  assert.equal(parseDraft('').ok, false)
})

test('rejects invalid JSON', () => {
  const result = parseDraft('{not json')
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.reason, 'invalid_json')
})

test('rejects an old/unsupported draft version', () => {
  const stale = JSON.stringify({ version: 0, updated_at: new Date().toISOString(), locale: 'ar' })
  const result = parseDraft(stale)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.reason, 'unsupported_version')

  const future = JSON.stringify({ version: 99, updated_at: new Date().toISOString(), locale: 'ar' })
  const futureResult = parseDraft(future)
  assert.equal(futureResult.ok, false)
  if (futureResult.ok) return
  assert.equal(futureResult.reason, 'unsupported_version')
})

test('rejects a tampered draft with an invalid shape', () => {
  const tampered = JSON.stringify({
    version: DRAFT_VERSION,
    updated_at: new Date().toISOString(),
    adults: 'a lot', // tampered: should be a number
  })
  const result = parseDraft(tampered)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.reason, 'invalid_shape')
})

test('rejects a tampered draft carrying unknown fields (strict schema)', () => {
  const tampered = JSON.stringify({
    version: DRAFT_VERSION,
    updated_at: new Date().toISOString(),
    visitor_id: 'should-never-exist',
  })
  const result = parseDraft(tampered)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.reason, 'invalid_shape')
})
