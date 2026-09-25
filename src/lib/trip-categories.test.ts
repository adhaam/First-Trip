import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveTripCategoryChips,
  diffTripCategoryTags,
  resolveTripCategory,
  tripCategoryTags,
  tripMatchesCategoryChip,
} from './trip-categories'
import type { SinaiTrip, TripCategory } from './types'

const sea: TripCategory = { id: 'sea', slug: 'sea', name_ar: 'بحر', name_en: 'Sea', is_active: true, sort_order: 2 }
const desert: TripCategory = { id: 'desert', slug: 'desert', name_ar: 'صحراء', name_en: 'Desert', is_active: true, sort_order: 1 }
const inactive: TripCategory = { id: 'old', slug: 'old', name_ar: 'قديم', name_en: 'Old', is_active: false, sort_order: 0 }
const categories = new Map([[sea.id, sea], [desert.id, desert], [inactive.id, inactive]])

function trip(overrides: Partial<SinaiTrip>): SinaiTrip {
  return {
    id: 'trip-1', name_ar: '', name_en: '', description_ar: '', description_en: '', category_ar: '', category_en: '', images: [],
    duration: '', duration_en: '', price: 0, includes_ar: [], includes_en: [], sort_order: 0, is_active: true, created_at: '',
    ...overrides,
  }
}

test('resolveTripCategory prefers an active structured category and falls back to legacy text', () => {
  assert.equal(resolveTripCategory(trip({ trip_category_id: 'sea', category_en: 'Legacy' }), categories)?.source, 'structured')
  const legacy = resolveTripCategory(trip({ trip_category_id: 'old', category_ar: 'قديم', category_en: 'Legacy' }), categories)
  assert.deepEqual(legacy && { source: legacy.source, name_ar: legacy.name_ar, name_en: legacy.name_en }, {
    source: 'legacy', name_ar: 'قديم', name_en: 'Legacy',
  })
  assert.equal(resolveTripCategory(trip({}), categories), null)
})

test('tripCategoryTags keeps active tags, puts primary first, and removes duplicates', () => {
  assert.deepEqual(
    tripCategoryTags(trip({ trip_category_id: 'sea' }), [
      { trip_id: 'trip-1', category_id: 'desert' },
      { trip_id: 'trip-1', category_id: 'sea' },
      { trip_id: 'trip-1', category_id: 'old' },
      { trip_id: 'other', category_id: 'desert' },
    ], categories).map((category) => category.id),
    ['sea', 'desert'],
  )
})

test('deriveTripCategoryChips uses sorted structured categories and legacy only when no structured primary exists', () => {
  const chips = deriveTripCategoryChips([
    trip({ id: 'a', category: { ...sea, source: 'structured' }, category_tags: [sea] }),
    trip({ id: 'b', category: { ...desert, source: 'structured' }, category_tags: [desert, sea] }),
    trip({ id: 'c', category: { id: 'legacy:x', slug: 'legacy:x', name_ar: 'قديم', name_en: 'Legacy', is_active: true, sort_order: 0, source: 'legacy' } }),
  ])
  assert.deepEqual(chips.map((chip) => chip.id), ['desert', 'sea', 'legacy:x'])
  assert.equal(tripMatchesCategoryChip(trip({ category: { ...sea, source: 'structured' }, category_tags: [sea, desert] }), 'desert'), true)
})

test('diffTripCategoryTags inserts before deletions while retaining the primary category', () => {
  assert.deepEqual(diffTripCategoryTags(['sea', 'old'], ['desert', 'sea'], 'sea'), {
    insertCategoryIds: ['desert'], deleteCategoryIds: ['old'],
  })
})
