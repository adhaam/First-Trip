import assert from 'node:assert/strict'
import test from 'node:test'
import { filterTripsByCategory, tripCategories } from './experiences'
import type { CatalogTrip } from './types'

const diving: CatalogTrip = { id: 'a', name_ar: 'غطس', name_en: 'Diving', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 500, category_slugs: ['diving'], category_labels: [{ ar: 'غطس', en: 'Diving' }] }
const hiking: CatalogTrip = { id: 'b', name_ar: 'سفاري', name_en: 'Hiking', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 700, category_slugs: ['hiking', 'diving'], category_labels: [{ ar: 'رحلات', en: 'Hiking' }, { ar: 'غطس', en: 'Diving' }] }
const uncategorized: CatalogTrip = { id: 'c', name_ar: 'مفاجأة', name_en: 'Surprise', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 300, category_slugs: [], category_labels: [] }

test('tripCategories collects unique categories in first-seen order', () => {
  assert.deepEqual(tripCategories([diving, hiking, uncategorized]), [
    { slug: 'diving', name_ar: 'غطس', name_en: 'Diving' },
    { slug: 'hiking', name_ar: 'رحلات', name_en: 'Hiking' },
  ])
})

test('filterTripsByCategory shows everything for null and only matches for a slug', () => {
  assert.deepEqual(filterTripsByCategory([diving, hiking, uncategorized], null), [diving, hiking, uncategorized])
  assert.deepEqual(filterTripsByCategory([diving, hiking, uncategorized], 'diving'), [diving, hiking])
  assert.deepEqual(filterTripsByCategory([diving, hiking, uncategorized], 'hiking'), [hiking])
})
