import assert from 'node:assert/strict'
import test from 'node:test'
import { getTripIdFromRouteSlug, getTripRouteSlug, slugifyTripName } from './trips'

const id = '123e4567-e89b-12d3-a456-426614174000'

test('creates a readable trip slug with an authoritative UUID suffix', () => {
  assert.equal(
    getTripRouteSlug({ id, name_en: 'Blue Hole & Abu Galum' }),
    `blue-hole-abu-galum-${id}`,
  )
})

test('resolves both a readable slug and a plain UUID', () => {
  assert.equal(getTripIdFromRouteSlug(`blue-hole-${id}`), id)
  assert.equal(getTripIdFromRouteSlug(id), id)
  assert.equal(getTripIdFromRouteSlug('blue-hole'), null)
})

test('normalizes names without inventing route content', () => {
  assert.equal(slugifyTripName('  Mount Sinai / Sunrise  '), 'mount-sinai-sunrise')
  assert.equal(slugifyTripName('رحلة سيناء'), '')
})
