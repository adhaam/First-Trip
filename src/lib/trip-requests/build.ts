/**
 * M2 Trip Builder — pure mapping from a validated TripRequestInput to:
 *   1. resolved journey dates (resolveJourneyDates)
 *   2. a quote engine request (toQuoteRequest)
 *   3. the payment parts that decide the payment plan (tripRequestPaymentParts)
 *   4. the trip_requests DB row (buildTripRequestRow)
 *
 * No server imports — schedule config, quote results and payment rules are
 * always passed in, never fetched here. See src/lib/trip-requests/service.ts
 * for the server-side orchestration.
 */
import type { QuoteInput, QuoteResult } from '@/lib/quote-data'
import type { CombinedPaymentPlan, PaymentKind } from '@/lib/payment-rules'
import { resolveStayPattern } from '@/lib/transport'
import type { StayPatternResult, TransportScheduleConfig } from '@/lib/transport'
import type { PriceSnapshot } from '@/lib/types'
import type { TripRequestInput } from './schema'

// ─── Journey dates ───

export type JourneyDates = {
  arrivalDate: string
  departureDate: string
  /** Nights of stay (0 for a transfer-only journey with no accommodation). */
  nights: number
  /** Total trip length in days (nights + 1); only meaningful for a stay. */
  durationDays: number
}

export type JourneyDatesResult =
  | { ok: true; dates: JourneyDates }
  | { ok: false; code: string; error: string }

const SCHEDULE_ERROR_MESSAGES: Record<Exclude<StayPatternResult, { ok: true }>['reason'], string> = {
  unknown_pattern: 'The selected stay pattern does not exist.',
  pattern_inactive: 'The selected stay pattern is no longer available.',
  pattern_transfer_type_mismatch: 'The selected stay pattern does not match the chosen transport mode.',
  invalid_departure_weekday: 'The selected arrival date is not valid for this stay pattern.',
  outbound_not_operating: 'There is no outbound service on the selected arrival date.',
  return_not_operating: 'There is no return service for the selected stay pattern.',
}

function isoToUtcDays(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

/**
 * Resolves the arrival/departure dates for a journey. Transport modes derive
 * the return date from the commercial stay pattern (never trusted from the
 * client); stay_only accepts any valid dates the customer chose, provided
 * departure is strictly after arrival. Never invents itinerary days.
 */
export function resolveJourneyDates(
  input: TripRequestInput,
  schedule: TransportScheduleConfig,
): JourneyDatesResult {
  if (input.transport_mode === 'stay_only') {
    if (!input.departure_date) {
      return { ok: false, code: 'DEPARTURE_DATE_REQUIRED', error: 'A departure date is required for a stay.' }
    }
    const nights = isoToUtcDays(input.departure_date) - isoToUtcDays(input.arrival_date)
    if (!(nights > 0)) {
      return { ok: false, code: 'INVALID_STAY_DATES', error: 'Departure date must be after the arrival date.' }
    }
    return {
      ok: true,
      dates: { arrivalDate: input.arrival_date, departureDate: input.departure_date, nights, durationDays: nights + 1 },
    }
  }

  if (!input.stay_pattern_code) {
    return { ok: false, code: 'STAY_PATTERN_REQUIRED', error: 'A stay pattern is required for this transport mode.' }
  }

  const pattern = resolveStayPattern(schedule, {
    patternCode: input.stay_pattern_code,
    transferType: input.transport_mode,
    outboundDate: input.arrival_date,
    originCode: input.origin_governorate_code,
  })
  if (!pattern.ok) {
    return {
      ok: false,
      code: `SCHEDULE_${pattern.reason.toUpperCase()}`,
      error: SCHEDULE_ERROR_MESSAGES[pattern.reason],
    }
  }

  return {
    ok: true,
    dates: {
      arrivalDate: input.arrival_date,
      departureDate: pattern.returnDate,
      nights: pattern.nights,
      durationDays: pattern.durationDays,
    },
  }
}

// ─── Quote engine mapping ───

/**
 * Maps a validated builder request to the shared quote engine request
 * (src/lib/quote-data.ts `quoteSchema`). Transport + a chosen stay becomes a
 * 'package' quote (transfer bundled with the accommodation); stay_only
 * becomes 'accommodation-only'; a transport mode without an accommodation
 * becomes a round-trip 'transfer-only'. Experiences (standalone trips and
 * trip packages) are passed through as extra_trip_ids / trip_package_ids.
 */
export function toQuoteRequest(input: TripRequestInput, dates: JourneyDates): QuoteInput {
  const numPeople = input.adults + input.children
  const extraTripIds = input.experiences.filter((experience) => experience.kind === 'trip').map((experience) => experience.id)
  const tripPackageIds = input.experiences.filter((experience) => experience.kind === 'trip_package').map((experience) => experience.id)

  const shared = {
    start_date: dates.arrivalDate,
    num_people: numPeople,
    ...(input.room_allocations?.length ? { room_allocations: input.room_allocations } : {}),
    ...(input.upgrade_id ? { upgrade_id: input.upgrade_id } : {}),
    ...(input.meal_plan_key ? { meal_plan_key: input.meal_plan_key } : {}),
    ...(extraTripIds.length ? { extra_trip_ids: extraTripIds } : {}),
    ...(tripPackageIds.length ? { trip_package_ids: tripPackageIds } : {}),
  }

  if (input.transport_mode === 'stay_only') {
    return {
      booking_type: 'accommodation-only',
      accommodation_id: input.accommodation_id,
      nights: dates.nights,
      ...shared,
    }
  }

  if (!input.accommodation_id) {
    return {
      booking_type: 'transfer-only',
      transfer_type: input.transport_mode,
      transfer_direction: 'round_trip',
      governorate: input.origin_governorate_code,
      ...shared,
    }
  }

  return {
    booking_type: 'package',
    accommodation_id: input.accommodation_id,
    duration: dates.durationDays === 5 ? 5 : 4,
    transfer_type: input.transport_mode,
    transfer_direction: 'round_trip',
    governorate: input.origin_governorate_code,
    ...shared,
  }
}

// ─── Payment parts ───

export type PaymentPart = { kind: PaymentKind; total: number }

/**
 * Derives the parts fed to src/lib/payment-rules.ts `paymentPlanForParts`,
 * using the EXPLICIT payment kinds from migration 030 — never inferred from
 * what a package contains:
 *   - the accommodation-side part is `stay_package` when a transport mode is
 *     chosen together with a stay, `stay` for stay_only, `transfer` when
 *     there is transport but no stay chosen;
 *   - each selected standalone trip is `trip`;
 *   - each selected trip package uses that package's own stored
 *     `trip_packages.payment_kind` (defaults to `experience_package`, paid
 *     100% like a trip — never 50/50 like a stay package).
 *
 * `packagePaymentKinds` maps a selected trip_package id to its catalogue
 * payment_kind (looked up server-side; see service.ts).
 */
export function tripRequestPaymentParts(
  input: TripRequestInput,
  quote: { total: number; snapshot: PriceSnapshot },
  packagePaymentKinds: Record<string, PaymentKind> = {},
): PaymentPart[] {
  const numPeople = input.adults + input.children
  const extraTrips = quote.snapshot.extra_trips ?? []
  const tripPackages = quote.snapshot.trip_packages ?? []

  const tripsTotal = extraTrips.reduce((sum, trip) => sum + trip.price * numPeople, 0)
  const packagesTotal = tripPackages.reduce((sum, pkg) => sum + pkg.total, 0)

  const parts: PaymentPart[] = []
  if (input.transport_mode === 'stay_only') {
    parts.push({ kind: 'stay', total: quote.total - tripsTotal - packagesTotal })
  } else if (input.accommodation_id) {
    parts.push({ kind: 'stay_package', total: quote.total - tripsTotal - packagesTotal })
  } else {
    parts.push({ kind: 'transfer', total: quote.total - tripsTotal - packagesTotal })
  }

  for (const trip of extraTrips) {
    parts.push({ kind: 'trip', total: trip.price * numPeople })
  }
  for (const pkg of tripPackages) {
    parts.push({ kind: packagePaymentKinds[pkg.package_id] ?? 'experience_package', total: pkg.total })
  }

  return parts
}

// ─── DB row ───

/** The `trip_requests` row for a successful, priced request (migration 032). */
export function buildTripRequestRow(
  input: TripRequestInput,
  dates: JourneyDates,
  quote: Extract<QuoteResult, { ok: true }>,
  paymentPlan: CombinedPaymentPlan,
  customerId: string,
) {
  return {
    builder_stage: input.builder_stage,
    source: input.source,
    locale: input.locale,
    origin_governorate_code: input.origin_governorate_code ?? null,
    transport_mode: input.transport_mode,
    stay_pattern_code: input.transport_mode === 'stay_only' ? null : input.stay_pattern_code ?? null,
    arrival_date: dates.arrivalDate,
    departure_date: dates.departureDate,
    adults: input.adults,
    children: input.children,
    accommodation_id: input.accommodation_id ?? null,
    room_allocations: input.room_allocations ?? [],
    meal_plan_key: input.meal_plan_key ?? null,
    experiences: input.experiences,
    quote_snapshot: quote.snapshot,
    quoted_total: quote.total,
    payment_plan: paymentPlan,
    customer_id: customerId,
    customer_name: input.contact.name,
    customer_phone: input.contact.phone,
    customer_email: input.contact.email || null,
    notes: input.notes ?? null,
  }
}
