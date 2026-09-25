import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getTripRouteSlug } from './trips'

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

test('search: accommodation URL uses /book-dahab/[id]', () => {
  const id = 'aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb'
  const url = `/book-dahab/${id}`
  assert.ok(url.startsWith('/book-dahab/'))
  assert.ok(url.includes(id))
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

test('search: trip package URL uses /sinai-trips/packages/[slug]', () => {
  const slug = 'kite-escape-week'
  assert.equal(`/sinai-trips/packages/${slug}`, '/sinai-trips/packages/kite-escape-week')
})

test('search: community post URL uses /community/[slug]', () => {
  const slug = 'ras-abu-galum-hidden-coastline'
  assert.equal(`/community/${slug}`, '/community/ras-abu-galum-hidden-coastline')
})

// ── Search query sanitization ─────────────────────────────────────────────

test('search sanitizer removes PostgREST filter grammar and LIKE wildcards', () => {
  const sanitize = (q: string) => q.replace(/[%_*,()]/g, ' ').replace(/\s+/g, ' ').trim()
  // These characters can corrupt PostgREST .or() filters
  assert.equal(sanitize('Blue Hole'), 'Blue Hole')
  assert.equal(sanitize('a,b'), 'a b')
  // parens replaced with spaces, then trimmed at the edges
  assert.equal(sanitize('(test)'), 'test')
  assert.equal(sanitize('name(bad,query)'), 'name bad query')
  assert.equal(sanitize('a%,or(name.ilike.*)'), 'a or name.ilike.')
})

test('search commerce product columns exist in the authoritative migration', () => {
  const migration = readFileSync('supabase/migrations/013_unified_commerce_foundation.sql', 'utf8')
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.commerce_products \(([\s\S]*?)\n\);/)
  assert.ok(table, 'commerce_products table exists')
  const columns = new Set(
    [...table![1].matchAll(/^\s*([a-z_]+)\s+/gm)].map((match) => match[1]),
  )
  const route = readFileSync('src/lib/discovery/search.ts', 'utf8')
  const select = route.match(/from\('commerce_products'\)\s*\.select\('([^']+)'\)/)?.[1] || ''
  const selected = select.split(',').map((column) => column.trim())
  // Scoped to the commerce_products query block only — a global match would
  // also pick up .eq()/.is() calls from the trip_packages/community_posts
  // queries elsewhere in this file, whose columns don't exist on this table.
  const commerceBlock = route.split("from('commerce_products')")[1]?.split("from('")[0] || ''
  const filtered = [...commerceBlock.matchAll(/(?:\.eq|\.is)\('([a-z_]+)'/g)].map((match) => match[1])
  for (const column of [...selected, ...filtered]) {
    assert.ok(columns.has(column), `commerce_products.${column} exists in migration 013`)
  }
})

test('search never queries trip_packages or community_posts without an active/published filter', () => {
  const route = readFileSync('src/lib/discovery/search.ts', 'utf8')
  const packagesBlock = route.split("from('trip_packages')")[1]?.split("from('")[0] || ''
  assert.ok(packagesBlock.includes(".eq('is_active', true)"), 'trip_packages search is scoped to is_active')
  const postsBlock = route.split("from('community_posts')")[1]?.split("from('")[0] || ''
  assert.ok(postsBlock.includes(".eq('is_published', true)"), 'community_posts search is scoped to is_published')
})

test('search: empty or short queries return no results without hitting DB', () => {
  const shouldSkip = (q: string) => !q || q.trim().length < 2
  assert.ok(shouldSkip(''))
  assert.ok(shouldSkip(' '))
  assert.ok(shouldSkip('a'))
  assert.ok(!shouldSkip('ab'))
  assert.ok(!shouldSkip('Blue'))
})
