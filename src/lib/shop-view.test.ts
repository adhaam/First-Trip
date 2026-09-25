import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applicableCategories, catalogView, cheapestRentalTier, filterCatalog, isOutOfStock,
  productMinPrice, rentalCategoryLabels, rentalDurationLabel, sortCatalog,
} from './shop-view'
import type { CommerceCategory, CommerceProduct } from './commerce-types'

function product(overrides: Partial<CommerceProduct> = {}): CommerceProduct {
  return {
    id: overrides.id || 'p1',
    category_id: null,
    product_type: 'sale',
    slug: 'item',
    name_ar: 'قميص',
    name_en: 'Shirt',
    description_ar: '',
    description_en: '',
    images: [],
    base_price: 100,
    compare_at_price: null,
    badge_text: '',
    sku: null,
    track_inventory: true,
    requires_delivery: false,
    pickup_enabled: true,
    delivery_enabled: false,
    deposit_amount: 0,
    rental_requirements: [],
    pickup_instructions_ar: '',
    pickup_instructions_en: '',
    is_active: true,
    is_featured: false,
    sort_order: 0,
    ...overrides,
  }
}

function category(overrides: Partial<CommerceCategory> = {}): CommerceCategory {
  return {
    id: overrides.id || 'c1',
    slug: 'gear',
    applies_to: 'both',
    name_ar: 'معدات',
    name_en: 'Gear',
    description_ar: '',
    description_en: '',
    image_url: '',
    icon: '',
    is_active: true,
    is_featured: false,
    sort_order: 0,
    ...overrides,
  }
}

// ─── catalogView ───

test('catalogView: zero products -> curating', () => {
  assert.equal(catalogView([]), 'curating')
})

test('catalogView: at least one product -> catalogue', () => {
  assert.equal(catalogView([product()]), 'catalogue')
})

// ─── filterCatalog ───

test('filterCatalog filters by category id', () => {
  const list = [product({ id: 'a', category_id: 'c1' }), product({ id: 'b', category_id: 'c2' })]
  const result = filterCatalog(list, { categoryId: 'c1' })
  assert.deepEqual(result.map((p) => p.id), ['a'])
})

test('filterCatalog "all" category id is a no-op', () => {
  const list = [product({ id: 'a', category_id: 'c1' }), product({ id: 'b', category_id: 'c2' })]
  assert.equal(filterCatalog(list, { categoryId: 'all' }).length, 2)
})

test('filterCatalog matches query against either locale name, case-insensitively', () => {
  const list = [
    product({ id: 'a', name_ar: 'خيمة', name_en: 'Tent' }),
    product({ id: 'b', name_ar: 'دراجة', name_en: 'Bike' }),
  ]
  assert.deepEqual(filterCatalog(list, { query: 'TENT' }).map((p) => p.id), ['a'])
  assert.deepEqual(filterCatalog(list, { query: 'خيمة' }).map((p) => p.id), ['a'])
})

test('filterCatalog combines category and query', () => {
  const list = [
    product({ id: 'a', category_id: 'c1', name_en: 'Tent' }),
    product({ id: 'b', category_id: 'c1', name_en: 'Bike' }),
    product({ id: 'c', category_id: 'c2', name_en: 'Tent' }),
  ]
  assert.deepEqual(filterCatalog(list, { categoryId: 'c1', query: 'tent' }).map((p) => p.id), ['a'])
})

// ─── sortCatalog ───

test('sortCatalog price_asc/price_desc order by cheapest variant', () => {
  const list = [
    product({ id: 'a', base_price: 300 }),
    product({ id: 'b', base_price: 100 }),
    product({ id: 'c', base_price: 200 }),
  ]
  assert.deepEqual(sortCatalog(list, 'price_asc').map((p) => p.id), ['b', 'c', 'a'])
  assert.deepEqual(sortCatalog(list, 'price_desc').map((p) => p.id), ['a', 'c', 'b'])
})

test('sortCatalog featured puts is_featured first, then sort_order', () => {
  const list = [
    product({ id: 'a', is_featured: false, sort_order: 0 }),
    product({ id: 'b', is_featured: true, sort_order: 5 }),
    product({ id: 'c', is_featured: false, sort_order: 1 }),
  ]
  assert.deepEqual(sortCatalog(list, 'featured').map((p) => p.id), ['b', 'a', 'c'])
})

test('sortCatalog does not mutate the input array', () => {
  const list = [product({ id: 'a', base_price: 300 }), product({ id: 'b', base_price: 100 })]
  const original = [...list]
  sortCatalog(list, 'price_asc')
  assert.deepEqual(list, original)
})

// ─── productMinPrice ───

test('productMinPrice falls back to base_price with no variants', () => {
  assert.equal(productMinPrice(product({ base_price: 250 })), 250)
})

test('productMinPrice takes the cheapest variant override', () => {
  const p = product({
    base_price: 250,
    commerce_product_variants: [
      { id: 'v1', product_id: 'p1', sku: null, option_value_ids: [], price_override: 300, inventory_quantity: 5, is_active: true, image_url: '', sort_order: 0 },
      { id: 'v2', product_id: 'p1', sku: null, option_value_ids: [], price_override: 180, inventory_quantity: 5, is_active: true, image_url: '', sort_order: 1 },
      { id: 'v3', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 5, is_active: true, image_url: '', sort_order: 2 },
    ],
  })
  // v3 has no override -> falls back to base_price (250), still not the min.
  assert.equal(productMinPrice(p), 180)
})

// ─── isOutOfStock ───

test('isOutOfStock is false for rentals regardless of variant stock', () => {
  const p = product({
    product_type: 'rental',
    track_inventory: true,
    commerce_product_variants: [{ id: 'v1', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 0, is_active: true, image_url: '', sort_order: 0 }],
  })
  assert.equal(isOutOfStock(p), false)
})

test('isOutOfStock is false when track_inventory is off', () => {
  const p = product({ track_inventory: false, commerce_product_variants: [{ id: 'v1', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 0, is_active: true, image_url: '', sort_order: 0 }] })
  assert.equal(isOutOfStock(p), false)
})

test('isOutOfStock is true only when every variant has zero inventory', () => {
  const some = product({
    commerce_product_variants: [
      { id: 'v1', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 0, is_active: true, image_url: '', sort_order: 0 },
      { id: 'v2', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 3, is_active: true, image_url: '', sort_order: 1 },
    ],
  })
  assert.equal(isOutOfStock(some), false)
  const all = product({
    commerce_product_variants: [
      { id: 'v1', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 0, is_active: true, image_url: '', sort_order: 0 },
      { id: 'v2', product_id: 'p1', sku: null, option_value_ids: [], price_override: null, inventory_quantity: 0, is_active: true, image_url: '', sort_order: 1 },
    ],
  })
  assert.equal(isOutOfStock(all), true)
})

// ─── cheapestRentalTier ───

test('cheapestRentalTier only considers product-level (variant_id null) tiers', () => {
  const p = product({
    product_type: 'rental',
    rental_pricing_tiers: [
      { id: 't1', product_id: 'p1', variant_id: 'v1', duration_days: 1, label_ar: '', label_en: '', price: 50, sort_order: 0, is_active: true },
      { id: 't2', product_id: 'p1', variant_id: null, duration_days: 3, label_ar: '', label_en: '', price: 300, sort_order: 1, is_active: true },
      { id: 't3', product_id: 'p1', variant_id: null, duration_days: 7, label_ar: '', label_en: '', price: 500, sort_order: 2, is_active: true },
    ],
  })
  assert.equal(cheapestRentalTier(p)?.id, 't2')
})

test('cheapestRentalTier is null with no tiers', () => {
  assert.equal(cheapestRentalTier(product({ product_type: 'rental' })), null)
})

// ─── rentalDurationLabel ───

test('rentalDurationLabel prefers the admin label per locale', () => {
  assert.equal(rentalDurationLabel({ durationDays: 3, labelAr: '٣ أيام', labelEn: '3 days' }, true), '٣ أيام')
  assert.equal(rentalDurationLabel({ durationDays: 3, labelAr: '٣ أيام', labelEn: '3 days' }, false), '3 days')
})

test('rentalDurationLabel falls back to a plain count when unlabelled', () => {
  assert.equal(rentalDurationLabel({ durationDays: 1 }, false), '1 day')
  assert.equal(rentalDurationLabel({ durationDays: 5 }, false), '5 days')
  assert.equal(rentalDurationLabel({ durationDays: 5 }, true), '5 يوم')
})

// ─── applicableCategories / rentalCategoryLabels ───

test('applicableCategories includes "both" plus the matching type, excludes the other type', () => {
  const cats = [
    category({ id: 'a', applies_to: 'sale' }),
    category({ id: 'b', applies_to: 'rental' }),
    category({ id: 'c', applies_to: 'both' }),
    category({ id: 'd', applies_to: 'sale', is_active: false }),
  ]
  assert.deepEqual(applicableCategories(cats, 'rental').map((c) => c.id), ['b', 'c'])
  assert.deepEqual(applicableCategories(cats, 'sale').map((c) => c.id), ['a', 'c'])
})

test('rentalCategoryLabels reads real category names only, never invents items', () => {
  const cats = [
    category({ id: 'a', applies_to: 'rental', name_ar: 'دراجات', name_en: 'Bikes' }),
    category({ id: 'b', applies_to: 'sale', name_ar: 'ملابس', name_en: 'Clothing' }),
    category({ id: 'c', applies_to: 'both', name_ar: '', name_en: '' }),
  ]
  assert.deepEqual(rentalCategoryLabels(cats, false), ['Bikes'])
})
