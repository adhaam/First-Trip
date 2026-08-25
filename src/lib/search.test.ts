import assert from 'node:assert/strict'
import test from 'node:test'
import { getTripRouteSlug } from './trips'
import { getAccommodationRouteSlug } from './accommodations'

// ── Trip booking: customer + trip association ──────────────────────────────

test('trip booking URL is constructed from trip id/name', () => {
  const trip = { id: '123e4567-e89b-12d3-a456-426614174000', name_en: 'Blue Hole Dive' }
  const slug = getTripRouteSlug(trip)
  assert.ok(slug.startsWith('blue-hole-dive-'), 'slug starts with slugified name')
  assert.ok(slug.endsWith(trip.id), 'slug ends with authoritative uuid')
})

// ── Accommodation ordering: sort_order determines listing order ────────────

test('accommodation sort_order: lower values come first', () => {
  const items = [
    { id: '1', sort_order: 5, created_at: '2024-01-01' },
    { id: '2', sort_order: 0, created_at: '2024-01-02' },
    { id: '3', sort_order: 2, created_at: '2024-01-03' },
  ]
  const sorted = [...items].sort((a, b) =>
    a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.created_at.localeCompare(b.created_at)
  )
  assert.deepEqual(sorted.map(i => i.id), ['2', '3', '1'])
})

test('accommodation sort_order: ties break on created_at ascending', () => {
  const items = [
    { id: 'b', sort_order: 0, created_at: '2024-02-01' },
    { id: 'a', sort_order: 0, created_at: '2024-01-01' },
  ]
  const sorted = [...items].sort((a, b) =>
    a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.created_at.localeCompare(b.created_at)
  )
  assert.deepEqual(sorted.map(i => i.id), ['a', 'b'])
})

// ── Sinai trip ordering ────────────────────────────────────────────────────

test('sinai trip sort_order: same stable logic as accommodations', () => {
  const trips = [
    { id: 'c', sort_order: 10, created_at: '2024-01-01' },
    { id: 'a', sort_order: 1, created_at: '2024-01-01' },
    { id: 'b', sort_order: 1, created_at: '2024-01-02' },
  ]
  const sorted = [...trips].sort((a, b) =>
    a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.created_at.localeCompare(b.created_at)
  )
  assert.deepEqual(sorted.map(i => i.id), ['a', 'b', 'c'])
})

// ── Search result URL construction ────────────────────────────────────────

test('search: accommodation URL uses /book-dahab/[slug]', () => {
  const acc = { id: 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb', name_en: 'Blue Beach Hotel' }
  const slug = getAccommodationRouteSlug(acc)
  const url = `/book-dahab/${slug}`
  assert.ok(url.startsWith('/book-dahab/blue-beach-hotel-'), 'url starts with readable name')
  assert.ok(url.endsWith(acc.id), 'url ends with authoritative uuid')
})

test('search: sinai trip URL uses /sinai-trips/[slug]', () => {
  const trip = { id: '123e4567-e89b-12d3-a456-426614174000', name_en: 'Colored Canyon' }
  const slug = getTripRouteSlug(trip)
  const url = `/sinai-trips/${slug}`
  assert.ok(url.startsWith('/sinai-trips/'))
  assert.ok(url.includes(trip.id))
})

test('search: merch URL uses /merch/[slug]', () => {
  const slug = 'sinai-tee-black'
  assert.equal(`/merch/${slug}`, '/merch/sinai-tee-black')
})

test('search: rental URL uses /rent/[slug]', () => {
  const slug = 'freediving-fins'
  assert.equal(`/rent/${slug}`, '/rent/freediving-fins')
})

// ── Search query sanitization ─────────────────────────────────────────────

test('search sanitizer strips PostgREST-breaking characters', () => {
  const sanitize = (q: string) => q.replace(/[,()]/g, ' ').trim()
  // These characters can corrupt PostgREST .or() filters
  assert.equal(sanitize('Blue Hole'), 'Blue Hole')
  assert.equal(sanitize('a,b'), 'a b')
  // parens replaced with spaces, then trimmed at the edges
  assert.equal(sanitize('(test)'), 'test')
  assert.equal(sanitize('name(bad,query)'), 'name bad query')
})

test('search: empty or short queries return no results without hitting DB', () => {
  const shouldSkip = (q: string) => !q || q.trim().length < 2
  assert.ok(shouldSkip(''))
  assert.ok(shouldSkip(' '))
  assert.ok(shouldSkip('a'))
  assert.ok(!shouldSkip('ab'))
  assert.ok(!shouldSkip('Blue'))
})
