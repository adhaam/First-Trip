/**
 * Pure data mapper for the Stay quick-view (StayQuickView.tsx): shapes one
 * `CatalogAccommodation` into exactly what that panel renders, so the
 * "which images / amenities show" logic is unit-testable without React.
 * Everything here is real catalog data — no placeholders are invented.
 */
import type { CatalogAccommodation } from './types'

export type StayQuickViewData = {
  name: string
  description: string
  /** Real images only, de-duplicated, capped at `maxImages`. */
  images: string[]
  /** Localized amenity labels, capped at `maxAmenities`. */
  amenities: string[]
  fromPricePerPersonPerNight: number
}

const DEFAULT_MAX_IMAGES = 8
const DEFAULT_MAX_AMENITIES = 6

/** De-dupes while preserving first-seen order, dropping any falsy/blank entries. */
function dedupe(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

export function stayQuickViewData(
  stay: CatalogAccommodation,
  locale: 'ar' | 'en',
  { maxImages = DEFAULT_MAX_IMAGES, maxAmenities = DEFAULT_MAX_AMENITIES }: { maxImages?: number; maxAmenities?: number } = {},
): StayQuickViewData {
  const imagesSource = stay.images?.length ? stay.images : stay.image ? [stay.image] : []
  const amenitiesSource = (locale === 'ar' ? stay.amenities_ar : stay.amenities_en) ?? []
  return {
    name: locale === 'ar' ? stay.name_ar : stay.name_en,
    description: (locale === 'ar' ? stay.description_ar : stay.description_en) ?? '',
    images: dedupe(imagesSource).slice(0, maxImages),
    amenities: dedupe(amenitiesSource).slice(0, maxAmenities),
    fromPricePerPersonPerNight: stay.from_price_per_person_per_night,
  }
}
