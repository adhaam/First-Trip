import 'server-only'

import { fromPricePerPersonPerNight } from '@/lib/stays'
import { effectiveTripPrice } from '@/lib/pricing'

import { getAccommodations, getSinaiTrips, getSiteSettings, getTransferPricing } from '@/lib/data'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport'
import { getTransportSchedule } from '@/lib/transport/load'
import { getTripPackages } from '@/lib/trip-packages'
import type { RoomUpgrade, SinaiTrip, TripPackage } from '@/lib/types'
import { compactList, compactText } from './package-quick-view'
import type { BuilderCatalog } from './types'

/** First non-empty photo — an empty-string cover must not shadow a real gallery image. */
function firstNonEmpty(...values: (string | null | undefined)[]): string {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? ''
}

async function roomUpgradesByAccommodation(ids: string[]): Promise<Map<string, RoomUpgrade[]>> {
  const grouped = new Map<string, RoomUpgrade[]>()
  if (!ids.length || !isSupabaseConfigured()) return grouped
  const { data, error } = await getSupabaseAdmin().from('accommodation_room_upgrades').select('*').in('accommodation_id', ids).eq('is_active', true).order('sort_order', { ascending: true })
  if (error) return grouped
  for (const row of (data ?? []) as RoomUpgrade[]) {
    const upgrades = grouped.get(row.accommodation_id) ?? []
    upgrades.push({ ...row, extra_price_per_night: Number(row.extra_price_per_night ?? 0) })
    grouped.set(row.accommodation_id, upgrades)
  }
  return grouped
}

function optionalFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>
}

/** sinai_trips.description_* / includes_* → short, lean quick-view fields; missing ones are simply absent. */
function tripQuickViewDetail(item: Pick<SinaiTrip, 'description_ar' | 'description_en' | 'includes_ar' | 'includes_en'>) {
  return optionalFields({
    description_ar: compactText(item.description_ar, 180),
    description_en: compactText(item.description_en, 180),
    includes_ar: compactList(item.includes_ar, 6, 80),
    includes_en: compactList(item.includes_en, 6, 80),
  })
}

/** trip_packages.short_description_* / description_* → compacted quick-view fields. */
function packageQuickViewDetail(item: Pick<TripPackage, 'short_description_ar' | 'short_description_en' | 'description_ar' | 'description_en'>) {
  return optionalFields({
    short_description_ar: compactText(item.short_description_ar, 200),
    short_description_en: compactText(item.short_description_en, 200),
    description_ar: compactText(item.description_ar, 600),
    description_en: compactText(item.description_en, 600),
  })
}

export async function getTripBuilderCatalog(): Promise<BuilderCatalog> {
  const [accommodations, trips, packages, transferPricing, schedule, paymentRules, settings] = await Promise.all([getAccommodations(), getSinaiTrips(), getTripPackages(), getTransferPricing(), getTransportSchedule(), getPaymentRules(), getSiteSettings()])
  const upgrades = await roomUpgradesByAccommodation(accommodations.map((item) => item.id))
  const services = transferPricing.settings.map((item) => ({ type: item.transfer_type, name_ar: item.name_ar, name_en: item.name_en, vehicle_ar: item.vehicle_ar, vehicle_en: item.vehicle_en, is_active: item.is_active }))
  const governorates = [...transferPricing.governorates.reduce((byCode, item) => {
    const existing = byCode.get(item.governorate_code) ?? { code: item.governorate_code, name_ar: item.name_ar, name_en: item.name_en, transfer_types: [] as BuilderCatalog['governorates'][number]['transfer_types'] }
    if (item.is_active && services.some((service) => service.type === item.transfer_type && service.is_active) && !existing.transfer_types.includes(item.transfer_type)) existing.transfer_types.push(item.transfer_type)
    byCode.set(item.governorate_code, existing)
    return byCode
  }, new Map<string, BuilderCatalog['governorates'][number]>()).values()]
  // Quick-view detail (description / includes) is only attached to trips that sit inside a package, to keep the payload lean.
  const packageTripIds = new Set(packages.flatMap((item) => item.trips?.map((trip) => trip.id) ?? []))
  return {
    schedule, today: todayInCairo(), paymentPolicies: paymentRules.policies, whatsappNumber: settings?.whatsapp_number,
    governorates,
    transferServices: services,
    accommodations: accommodations.map((item) => ({ id: item.id, name_ar: item.name_ar, name_en: item.name_en, type: item.type, ...(item.tier ? { tier: item.tier } : {}), image: firstNonEmpty(item.image_url, ...(item.images ?? [])), images: item.images, rating: item.rating, location_ar: item.location_ar ?? item.location, location_en: item.location_en ?? item.location, ...(item.latitude != null ? { latitude: item.latitude } : {}), ...(item.longitude != null ? { longitude: item.longitude } : {}), from_price_per_person_per_night: fromPricePerPersonPerNight(item), meal_plans: item.meal_plans.filter((meal) => meal.is_active), room_upgrades: (upgrades.get(item.id) ?? []).map(({ id, name_ar, name_en, extra_price_per_night }) => ({ id, name_ar, name_en, extra_price_per_night })), description_ar: item.description_ar, description_en: item.description_en, amenities_ar: item.amenities_ar, amenities_en: item.amenities_en })),
    // A trip's price is what the quote engine charges today (its active discount applied), never the
    // list price — otherwise the card and the quote disagree.
    trips: trips.map((item) => ({ id: item.id, name_ar: item.name_ar, name_en: item.name_en, image: firstNonEmpty(...(item.images ?? [])), duration_ar: item.duration, duration_en: item.duration_en, price: effectiveTripPrice(item).final, category_slugs: item.category_tags?.map((category) => category.slug) ?? [], category_labels: item.category_tags?.map((category) => ({ ar: category.name_ar, en: category.name_en })) ?? [], ...(packageTripIds.has(item.id) ? tripQuickViewDetail(item) : {}) })),
    packages: packages.map((item) => ({ id: item.id, slug: item.slug, name_ar: item.name_ar, name_en: item.name_en, image: item.image, payment_kind: 'experience_package' as const, ...(item.totals ? { public_total: item.totals.publicTotal, package_total: item.totals.packageTotal } : {}), trip_count: item.trips?.length ?? 0, trip_ids: item.trips?.map((trip) => trip.id) ?? [], ...packageQuickViewDetail(item) })),
  }
}
