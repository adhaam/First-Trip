/**
 * Pure view-model for the Package quick view (PackageQuickView.tsx): shapes one
 * `CatalogPackage` + its included `CatalogTrip`s into exactly what the panel
 * renders. Everything is real catalogue data (trip_packages / sinai_trips) —
 * a field that is missing or blank is omitted, never filled in. The package
 * has no stored inclusions/exclusions of its own, so the only "what's
 * included" lists are each excursion's own `includes_*`.
 */
import { conflictingSelectedPackages, standaloneTripsCoveredBy, type ExperienceSelections } from './experiences'
import type { CatalogPackage, CatalogTrip } from './types'

/** Trims, and cuts overlong text at a word boundary with an ellipsis. Blank → undefined. */
export function compactText(value: string | null | undefined, max: number): string | undefined {
  const text = (value ?? '').trim()
  if (!text) return undefined
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.search(/\s\S*$/)
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.trimEnd()}…`
}

/** Drops blanks, caps item count and item length. Empty → undefined. */
export function compactList(
  values: readonly (string | null | undefined)[] | null | undefined,
  maxItems: number,
  maxLength: number,
): string[] | undefined {
  const out = (values ?? [])
    .map((value) => compactText(value, maxLength))
    .filter((value): value is string => Boolean(value))
    .slice(0, maxItems)
  return out.length ? out : undefined
}

export type PackageQuickViewTrip = {
  id: string
  name: string
  description?: string
  image?: string
  /** Only when the trip record has a duration. */
  duration?: string
  includes: string[]
}

export type PackageQuickViewData = {
  name: string
  /** trip_packages.short_description_* */
  summary?: string
  /** trip_packages.description_* (omitted when identical to the summary). */
  description?: string
  /** Package cover, else the first included excursion's photo; undefined → caller uses the neutral media. */
  heroImage?: string
  /** All included excursions, in package order. */
  trips: PackageQuickViewTrip[]
  /** Per-person package price (what the quote engine multiplies by travellers). */
  packageTotal?: number
  /** Sum of the included trips' regular prices, per person — what the package page calls "booked separately". */
  publicTotal?: number
  /** Per person; present ONLY when the stored public total genuinely exceeds the package total. */
  savings?: number
  /** Present only once the customer has confirmed travellers. */
  travellers?: number
  /** packageTotal × travellers, mirroring the quote engine. */
  groupTotal?: number
  /** Selected standalone trips this package would replace (they get removed on select). */
  coveredStandaloneTrips: { id: string; name: string }[]
  /** Other selected packages sharing a trip with this one — selecting both is rejected by the quote engine. */
  conflictingPackages: { id: string; name: string }[]
}

const nonBlank = (value: string | null | undefined): string | undefined => {
  const text = value?.trim()
  return text ? text : undefined
}

export function packageQuickViewData(
  pkg: CatalogPackage,
  trips: readonly CatalogTrip[],
  locale: 'ar' | 'en',
  {
    packages = [],
    experiences,
    travellers,
  }: { packages?: readonly CatalogPackage[]; experiences?: ExperienceSelections; travellers?: number } = {},
): PackageQuickViewData {
  const ar = locale === 'ar'
  const byId = new Map(trips.map((trip) => [trip.id, trip]))
  const included = pkg.trip_ids.map((id) => byId.get(id)).filter((trip): trip is CatalogTrip => Boolean(trip))

  const summary = nonBlank(ar ? pkg.short_description_ar : pkg.short_description_en)
  const rawDescription = nonBlank(ar ? pkg.description_ar : pkg.description_en)
  const description = rawDescription && rawDescription !== summary ? rawDescription : undefined

  const tripViews: PackageQuickViewTrip[] = included.map((trip) => {
    const tripDescription = nonBlank(ar ? trip.description_ar : trip.description_en)
    const image = nonBlank(trip.image)
    const duration = nonBlank(ar ? trip.duration_ar : trip.duration_en)
    return {
      id: trip.id,
      name: ar ? trip.name_ar : trip.name_en,
      ...(tripDescription ? { description: tripDescription } : {}),
      ...(image ? { image } : {}),
      ...(duration ? { duration } : {}),
      includes: ((ar ? trip.includes_ar : trip.includes_en) ?? []).map((item) => item.trim()).filter(Boolean),
    }
  })

  const heroImage = nonBlank(pkg.image) ?? tripViews.find((trip) => trip.image)?.image
  const packageTotal = pkg.package_total
  const publicTotal = pkg.public_total
  // "You save" only from the stored comparison the package page itself shows, and only while it is
  // still true: the stored separate-price total must equal what the included trips cost today (an
  // active trip discount makes the stored figure overstate the saving, so it is not shown).
  const separateToday = included.length === pkg.trip_ids.length
    ? included.reduce((sum, trip) => sum + trip.price, 0)
    : undefined
  const comparisonHolds = separateToday != null && publicTotal != null && Math.round(separateToday * 100) === Math.round(publicTotal * 100)
  const savings = comparisonHolds && packageTotal != null && publicTotal > packageTotal ? publicTotal - packageTotal : undefined
  const people = travellers != null && travellers >= 1 ? Math.floor(travellers) : undefined

  return {
    name: ar ? pkg.name_ar : pkg.name_en,
    ...(summary ? { summary } : {}),
    ...(description ? { description } : {}),
    ...(heroImage ? { heroImage } : {}),
    trips: tripViews,
    ...(packageTotal != null ? { packageTotal } : {}),
    ...(comparisonHolds && packageTotal != null ? { publicTotal } : {}),
    ...(savings != null ? { savings } : {}),
    ...(people != null ? { travellers: people } : {}),
    ...(people != null && packageTotal != null ? { groupTotal: packageTotal * people } : {}),
    coveredStandaloneTrips: standaloneTripsCoveredBy(pkg, trips, experiences).map((trip) => ({ id: trip.id, name: ar ? trip.name_ar : trip.name_en })),
    conflictingPackages: conflictingSelectedPackages(pkg, packages, experiences).map((other) => ({ id: other.id, name: ar ? other.name_ar : other.name_en })),
  }
}
