import 'server-only'

import { getAccommodations, getSinaiTrips, getSiteSettings, getTransferPricing } from '@/lib/data'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport'
import { getTransportSchedule } from '@/lib/transport/load'
import { getTripPackages } from '@/lib/trip-packages'
import type { RoomUpgrade } from '@/lib/types'
import type { BuilderCatalog } from './types'

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

function fromNightlyRate(item: { price_double_room: number; price_single_room: number; price_triple_room: number }) {
  return Math.min(...[item.price_double_room / 2, item.price_single_room, item.price_triple_room / 3].filter((price) => Number.isFinite(price) && price > 0), 0) || 0
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
  return {
    schedule, today: todayInCairo(), paymentPolicies: paymentRules.policies, whatsappNumber: settings?.whatsapp_number,
    governorates,
    transferServices: services,
    accommodations: accommodations.map((item) => ({ id: item.id, name_ar: item.name_ar, name_en: item.name_en, type: item.type, ...(item.tier ? { tier: item.tier } : {}), image: item.image_url ?? item.images[0] ?? '', images: item.images, rating: item.rating, location_ar: item.location_ar ?? item.location, location_en: item.location_en ?? item.location, ...(item.latitude != null ? { latitude: item.latitude } : {}), ...(item.longitude != null ? { longitude: item.longitude } : {}), from_price_per_person_per_night: fromNightlyRate(item), meal_plans: item.meal_plans.filter((meal) => meal.is_active), room_upgrades: (upgrades.get(item.id) ?? []).map(({ id, name_ar, name_en, extra_price_per_night }) => ({ id, name_ar, name_en, extra_price_per_night })) })),
    trips: trips.map((item) => ({ id: item.id, name_ar: item.name_ar, name_en: item.name_en, image: item.images[0] ?? '', duration_ar: item.duration, duration_en: item.duration_en, price: item.price, category_slugs: item.category_tags?.map((category) => category.slug) ?? [], category_labels: item.category_tags?.map((category) => ({ ar: category.name_ar, en: category.name_en })) ?? [] })),
    packages: packages.map((item) => ({ id: item.id, slug: item.slug, name_ar: item.name_ar, name_en: item.name_en, image: item.image, payment_kind: item.payment_kind ?? 'experience_package', ...(item.totals ? { public_total: item.totals.publicTotal, package_total: item.totals.packageTotal } : {}), trip_count: item.trips?.length ?? 0 })),
  }
}
