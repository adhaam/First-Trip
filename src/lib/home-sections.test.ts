import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isFallbackCurated,
  packageLaneKind,
  selectCategoryTiles,
  selectCuratedPicks,
  selectShopRentVisibility,
  selectStaysLineup,
  selectUpcomingExperienceDates,
  splitPackageLanes,
  stayFromPricePerPersonPerNight,
} from './home-sections'
import type { Accommodation, Experience, ExperienceDate, SinaiTrip, TripPackage } from './types'

const NOW = new Date('2026-01-15T00:00:00')

function trip(overrides: Partial<SinaiTrip> = {}): SinaiTrip {
  return {
    id: 't1',
    name_ar: 'رحلة',
    name_en: 'Trip',
    description_ar: '',
    description_en: '',
    category_ar: '',
    category_en: '',
    images: [],
    duration: '',
    duration_en: '',
    price: 1000,
    includes_ar: [],
    includes_en: [],
    sort_order: 0,
    is_active: true,
    created_at: '2025-01-01',
    ...overrides,
  }
}

function pkg(overrides: Partial<TripPackage> = {}): TripPackage {
  return {
    id: 'p1',
    slug: 'p1',
    name_ar: 'باقة',
    name_en: 'Package',
    short_description_ar: '',
    short_description_en: '',
    description_ar: '',
    description_en: '',
    image: '',
    featured: false,
    is_active: true,
    sort_order: 0,
    created_at: '2025-01-01',
    ...overrides,
  }
}

function experienceDate(overrides: Partial<ExperienceDate> = {}): ExperienceDate {
  return {
    id: 'd1',
    experience_id: 'e1',
    start_date: '2026-02-01',
    end_date: '2026-02-03',
    total_spots: 10,
    status: 'open',
    is_open: true,
    ...overrides,
  }
}

function experience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: 'e1',
    slug: 'e1',
    title_ar: 'تجربة',
    title_en: 'Experience',
    short_description_ar: '',
    short_description_en: '',
    full_description_ar: '',
    full_description_en: '',
    included_ar: [],
    included_en: [],
    not_included_ar: [],
    not_included_en: [],
    itinerary: [],
    hero_image: '',
    gallery: [],
    duration_ar: '',
    duration_en: '',
    price: 0,
    currency: 'EGP',
    discount_label: '',
    featured: false,
    starting_from_price: false,
    status: 'published',
    sort_order: 0,
    created_at: '2025-01-01',
    dates: [],
    ...overrides,
  }
}

function accommodation(overrides: Partial<Accommodation> = {}): Accommodation {
  return {
    id: 'a1',
    name_ar: 'إقامة',
    name_en: 'Stay',
    type: 'hotel',
    description_ar: '',
    description_en: '',
    images: [],
    rating: 0,
    location: '',
    amenities_ar: [],
    amenities_en: [],
    price_per_night: 0,
    price_4day: 0,
    price_5day: 0,
    price_double_room: 0,
    price_single_room: 0,
    price_triple_room: 0,
    meal_plans: [],
    sort_order: 0,
    is_active: true,
    created_at: '2025-01-01',
    ...overrides,
  }
}

// ─── selectUpcomingExperienceDates ───

test('selectUpcomingExperienceDates keeps only open, future dates, soonest first', () => {
  const past = experience({ id: 'e1', dates: [experienceDate({ id: 'd1', experience_id: 'e1', start_date: '2026-01-01' })] })
  const closed = experience({ id: 'e2', dates: [experienceDate({ id: 'd2', experience_id: 'e2', start_date: '2026-03-01', status: 'cancelled' })] })
  const notOpenFlag = experience({ id: 'e3', dates: [experienceDate({ id: 'd3', experience_id: 'e3', start_date: '2026-03-01', is_open: false })] })
  const soon = experience({ id: 'e4', dates: [experienceDate({ id: 'd4', experience_id: 'e4', start_date: '2026-02-01' })] })
  const later = experience({ id: 'e5', dates: [experienceDate({ id: 'd5', experience_id: 'e5', start_date: '2026-04-01' })] })

  const result = selectUpcomingExperienceDates([past, closed, notOpenFlag, soon, later], NOW)

  assert.deepEqual(result.map((r) => r.date.id), ['d4', 'd5'])
})

// ─── selectCuratedPicks ───

test('selectCuratedPicks surfaces featured packages, featured trips, discounted trips and upcoming dates', () => {
  const featuredPkg = pkg({ id: 'p-feat', featured: true })
  const plainPkg = pkg({ id: 'p-plain', featured: false })
  const featuredTrip = trip({ id: 't-feat', sort_order: 5 })
  const discountedTrip = trip({
    id: 't-disc',
    sort_order: 1,
    discount_type: 'percentage',
    discount_value: 20,
  })
  const plainTrip = trip({ id: 't-plain', sort_order: 0 })
  const upcoming = experience({ id: 'e-up', dates: [experienceDate({ id: 'd-up', experience_id: 'e-up', start_date: '2026-02-01' })] })

  const picks = selectCuratedPicks({
    trips: [featuredTrip, discountedTrip, plainTrip],
    packages: [featuredPkg, plainPkg],
    experiences: [upcoming],
    featuredTripIds: ['t-feat'],
    now: NOW,
  })

  const keys = picks.map((p) => `${p.kind}:${p.id}`)
  assert.ok(keys.includes('package:p-feat'))
  assert.ok(!keys.includes('package:p-plain'))
  assert.ok(keys.includes('trip:t-feat'))
  assert.ok(keys.includes('trip:t-disc'))
  assert.ok(!keys.includes('trip:t-plain'))
  assert.ok(keys.includes('experience-date:e-up:d-up'))
  assert.ok(!isFallbackCurated(picks))
})

test('selectCuratedPicks falls back to sort_order picks, all tagged "curated", when nothing qualifies', () => {
  const trips = [trip({ id: 't2', sort_order: 2 }), trip({ id: 't1', sort_order: 1 }), trip({ id: 't3', sort_order: 3 })]
  const picks = selectCuratedPicks({ trips, packages: [], experiences: [], now: NOW, limit: 2 })

  assert.equal(picks.length, 2)
  assert.deepEqual(picks.map((p) => p.id), ['t1', 't2'])
  assert.ok(isFallbackCurated(picks))
})

test('selectCuratedPicks never duplicates a trip that is both featured and discounted, and respects limit', () => {
  const t = trip({ id: 't-both', discount_type: 'amount', discount_value: 100 })
  const picks = selectCuratedPicks({
    trips: [t],
    packages: [],
    experiences: [],
    featuredTripIds: ['t-both'],
    now: NOW,
    limit: 6,
  })
  assert.equal(picks.filter((p) => p.kind === 'trip' && p.id === 't-both').length, 1)
})

// ─── packages lanes ───

test('packageLaneKind resolves stay_package explicitly and defaults everything else to experience_package', () => {
  assert.equal(packageLaneKind({ id: 'p1', payment_kind: 'stay_package' }), 'stay_package')
  assert.equal(packageLaneKind({ id: 'p2', payment_kind: 'experience_package' }), 'experience_package')
  assert.equal(packageLaneKind({ id: 'p3', payment_kind: undefined }), 'experience_package')
})

test('splitPackageLanes separates stay packages from experience packages', () => {
  const stay = pkg({ id: 'stay', payment_kind: 'stay_package' })
  const experienceExplicit = pkg({ id: 'exp', payment_kind: 'experience_package' })
  const experienceImplicit = pkg({ id: 'exp-implicit', payment_kind: undefined })

  const lanes = splitPackageLanes([stay, experienceExplicit, experienceImplicit])

  assert.deepEqual(lanes.stayPackages.map((p) => p.id), ['stay'])
  assert.deepEqual(lanes.experiencePackages.map((p) => p.id), ['exp', 'exp-implicit'])
})

// ─── category tiles ───

test('selectCategoryTiles pairs each taxonomy chip with an image from a trip in that category', () => {
  const trips: SinaiTrip[] = [
    trip({
      id: 't1',
      trip_category_id: 'cat-sea',
      images: ['sea.jpg'],
      category: { id: 'cat-sea', slug: 'sea', name_ar: 'بحر', name_en: 'Sea', is_active: true, sort_order: 0, source: 'structured' },
    }),
    trip({
      id: 't2',
      trip_category_id: 'cat-desert',
      images: [],
      category: { id: 'cat-desert', slug: 'desert', name_ar: 'صحراء', name_en: 'Desert', is_active: true, sort_order: 1, source: 'structured' },
    }),
  ]

  const tiles = selectCategoryTiles(trips)

  assert.equal(tiles.length, 2)
  assert.equal(tiles[0].chip.id, 'cat-sea')
  assert.equal(tiles[0].image, 'sea.jpg')
  assert.equal(tiles[1].chip.id, 'cat-desert')
  assert.equal(tiles[1].image, null)
})

// ─── stays lineup ───

test('selectStaysLineup prefers owner-featured accommodations and falls back when the ids are stale', () => {
  const a1 = accommodation({ id: 'a1' })
  const a2 = accommodation({ id: 'a2' })
  const a3 = accommodation({ id: 'a3' })

  const featured = selectStaysLineup([a1, a2, a3], ['a2'])
  assert.equal(featured.hero?.id, 'a2')
  assert.deepEqual(featured.secondaries.map((a) => a.id), [])

  const stale = selectStaysLineup([a1, a2, a3], ['not-real'])
  assert.equal(stale.hero?.id, 'a1')
  assert.deepEqual(stale.secondaries.map((a) => a.id), ['a2', 'a3'])

  const none = selectStaysLineup([], [])
  assert.equal(none.hero, null)
})

test('stayFromPricePerPersonPerNight picks the cheapest configured room type', () => {
  // double: 2000 / 2 = 1000 per person
  // single: 1500 / 1 = 1500 per person
  // triple: unconfigured (0) falls back to double * 1.5 = 3000, / 3 = 1000 per person
  // cheapest of {1000, 1500, 1000} = 1000
  assert.equal(
    stayFromPricePerPersonPerNight({ price_double_room: 2000, price_single_room: 1500, price_triple_room: 0 }),
    1000,
  )

  // A cheap single with no double/triple configured must still win.
  assert.equal(
    stayFromPricePerPersonPerNight({ price_double_room: 0, price_single_room: 400 }),
    400,
  )
})

test('stayFromPricePerPersonPerNight returns 0 when nothing is priced', () => {
  assert.equal(stayFromPricePerPersonPerNight({ price_double_room: 0, price_single_room: 0 }), 0)
})

// ─── shop/rent visibility ───

test('selectShopRentVisibility only shows a lane with active inventory', () => {
  assert.deepEqual(selectShopRentVisibility(0, 0), { showShop: false, showRent: false })
  assert.deepEqual(selectShopRentVisibility(3, 0), { showShop: true, showRent: false })
  assert.deepEqual(selectShopRentVisibility(0, 2), { showShop: false, showRent: true })
  assert.deepEqual(selectShopRentVisibility(1, 1), { showShop: true, showRent: true })
})
