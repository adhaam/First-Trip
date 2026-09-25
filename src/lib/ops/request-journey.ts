/**
 * Read model of a submitted Trip Builder request for the Operations Center.
 * Money comes ONLY from the request's frozen quote_snapshot / payment_plan
 * (migration 032) — never recomputed. Names (origin, meal plan, trips) are
 * looked up for readability; they are labels, not part of the priced truth.
 */
export type Named = { name_ar: string; name_en: string }

export type JourneyLookups = {
  origins: Record<string, Named>
  trips: Record<string, Named>
  packages: Record<string, Named>
  mealPlans: { key: string; label_ar?: string; label_en?: string }[]
}

export type JourneyExperience = Named & {
  kind: 'trip' | 'trip_package'
  id: string
  preferred_date: string | null
  /** Frozen price for the whole group, from the snapshot. */
  total: number | null
}

export type JourneyQuoteLine = {
  key: 'accommodation' | 'meals' | 'transfer' | 'trips' | 'packages'
  amount: number
}

export type RequestJourney = {
  origin: (Named & { code: string }) | null
  meal_plan: (Named & { key: string }) | null
  experiences: JourneyExperience[]
  nights: number | null
  quote_lines: JourneyQuoteLine[]
  quote_total: number | null
  payment: { after_confirmation: number | null; on_arrival: number | null } | null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(obj) : []
}

function fallbackName(id: string): Named {
  return { name_ar: id, name_en: id }
}

export function requestJourney(record: Record<string, unknown>, lookups: JourneyLookups): RequestJourney {
  const snapshot = obj(record.quote_snapshot)
  const people = Number(record.adults ?? 0) + Number(record.children ?? 0)
  const extraTrips = list(snapshot.extra_trips)
  const tripPackages = list(snapshot.trip_packages)

  const originCode = typeof record.origin_governorate_code === 'string' ? record.origin_governorate_code : null
  const mealKey = typeof record.meal_plan_key === 'string' ? record.meal_plan_key : null
  const meal = mealKey ? lookups.mealPlans.find((plan) => plan.key === mealKey) : undefined

  const experiences = list(record.experiences).flatMap((experience): JourneyExperience[] => {
    const id = typeof experience.id === 'string' ? experience.id : null
    if (!id || (experience.kind !== 'trip' && experience.kind !== 'trip_package')) return []
    const preferred = typeof experience.preferred_date === 'string' ? experience.preferred_date : null
    if (experience.kind === 'trip') {
      const line = extraTrips.find((trip) => trip.trip_id === id)
      const price = num(line?.price)
      return [{
        kind: 'trip', id, preferred_date: preferred, total: price === null ? null : price * people,
        ...(lookups.trips[id] ?? fallbackName(id)),
      }]
    }
    const line = tripPackages.find((pkg) => pkg.package_id === id)
    return [{
      kind: 'trip_package', id, preferred_date: preferred, total: num(line?.total),
      ...(lookups.packages[id] ?? fallbackName(id)),
    }]
  })

  const lineSources: [JourneyQuoteLine['key'], unknown][] = [
    ['accommodation', snapshot.accommodation_subtotal],
    ['meals', snapshot.meal_subtotal],
    ['transfer', snapshot.transfer_subtotal],
    ['trips', snapshot.extra_trips_subtotal],
    ['packages', snapshot.trip_packages_subtotal],
  ]
  const quote_lines = lineSources.flatMap(([key, value]) => {
    const amount = num(value)
    return amount ? [{ key, amount }] : []
  })

  const plan = record.payment_plan ? obj(record.payment_plan) : null

  return {
    origin: originCode ? { code: originCode, ...(lookups.origins[originCode] ?? fallbackName(originCode)) } : null,
    meal_plan: mealKey
      ? { key: mealKey, name_ar: meal?.label_ar || mealKey, name_en: meal?.label_en || mealKey }
      : null,
    experiences,
    nights: num(snapshot.nights),
    quote_lines,
    quote_total: num(snapshot.total) ?? num(Number(record.quoted_total)),
    payment: plan ? { after_confirmation: num(plan.upfrontAmount), on_arrival: num(plan.balanceAmount) } : null,
  }
}
