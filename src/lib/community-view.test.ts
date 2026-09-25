// Run with: npx tsx --test src/lib/community-view.test.ts

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeTripCategorySlugs,
  communityCategoryFacets,
  estimateReadingMinutes,
  matchingTripCategorySlug,
  selectFeaturedPost,
  selectSecondaryPosts,
  sortCommunityPosts,
} from './community-view'
import type { CommunityPost, TripCategory } from './types'

function post(overrides: Partial<CommunityPost>): CommunityPost {
  return {
    id: 'p1',
    slug: 'p1',
    title_ar: '',
    title_en: '',
    content_ar: '',
    content_en: '',
    category: 'stories',
    sort_order: 0,
    is_pinned: false,
    is_published: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

test('sortCommunityPosts puts pinned first, then sort_order, then newest', () => {
  const a = post({ id: 'a', sort_order: 2, created_at: '2026-01-01T00:00:00.000Z' })
  const b = post({ id: 'b', sort_order: 1, created_at: '2026-01-02T00:00:00.000Z' })
  const c = post({ id: 'c', sort_order: 5, is_pinned: true, created_at: '2025-12-01T00:00:00.000Z' })
  assert.deepEqual(sortCommunityPosts([a, b, c]).map((p) => p.id), ['c', 'b', 'a'])
})

test('selectFeaturedPost returns the top of the canonical order', () => {
  const a = post({ id: 'a', sort_order: 0 })
  const b = post({ id: 'b', sort_order: 0, is_pinned: true })
  assert.equal(selectFeaturedPost([a, b])?.id, 'b')
})

test('selectFeaturedPost returns null for an empty list', () => {
  assert.equal(selectFeaturedPost([]), null)
})

test('selectSecondaryPosts excludes exactly the featured post', () => {
  const a = post({ id: 'a', sort_order: 1 })
  const b = post({ id: 'b', sort_order: 0, is_pinned: true })
  const c = post({ id: 'c', sort_order: 2 })
  const secondary = selectSecondaryPosts([a, b, c])
  assert.deepEqual(secondary.map((p) => p.id), ['a', 'c'])
})

test('communityCategoryFacets only returns categories with at least one post, in taxonomy order, with correct counts', () => {
  const posts = [
    post({ id: 'a', category: 'diving' }),
    post({ id: 'b', category: 'stories' }),
    post({ id: 'c', category: 'diving' }),
  ]
  const facets = communityCategoryFacets(posts)
  assert.deepEqual(facets, [
    { category: 'stories', count: 1 },
    { category: 'diving', count: 2 },
  ])
})

test('communityCategoryFacets returns empty for no posts', () => {
  assert.deepEqual(communityCategoryFacets([]), [])
})

test('estimateReadingMinutes rounds up and floors at 1 minute', () => {
  assert.equal(estimateReadingMinutes(''), 1)
  assert.equal(estimateReadingMinutes('word '.repeat(50)), 1)
  assert.equal(estimateReadingMinutes('word '.repeat(201)), 2)
  assert.equal(estimateReadingMinutes('word '.repeat(400)), 2)
})

const activeSea: TripCategory = { id: 'sea', slug: 'diving', name_ar: 'غوص', name_en: 'Diving', is_active: true, sort_order: 0 }
const inactiveHiking: TripCategory = { id: 'hk', slug: 'hiking', name_ar: 'هايكينج', name_en: 'Hiking', is_active: false, sort_order: 1 }
const legacy: TripCategory = { id: 'legacy:x', slug: 'legacy:x', name_ar: 'قديم', name_en: 'Legacy', is_active: true, sort_order: 2 }

test('activeTripCategorySlugs keeps only active, non-legacy slugs', () => {
  const slugs = activeTripCategorySlugs([
    { category_tags: [activeSea, inactiveHiking, legacy] },
  ])
  assert.deepEqual([...slugs], ['diving'])
})

test('activeTripCategorySlugs de-duplicates across trips and handles missing tags', () => {
  const slugs = activeTripCategorySlugs([
    { category_tags: [activeSea] },
    { category_tags: [activeSea] },
    {},
  ])
  assert.deepEqual([...slugs], ['diving'])
})

test('matchingTripCategorySlug requires a literal slug match — never a fuzzy one', () => {
  const slugs = new Set(['diving'])
  assert.equal(matchingTripCategorySlug({ category: 'diving' }, slugs), 'diving')
  assert.equal(matchingTripCategorySlug({ category: 'freediving' }, slugs), null)
  assert.equal(matchingTripCategorySlug({ category: 'stories' }, slugs), null)
})
