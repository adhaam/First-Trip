/**
 * Admin "Edit / Revise booking" for a Build-Your-Trip journey (migration 051).
 *
 * The trip_requests row is the journey and its sole payment owner: staff amend
 * it in place (no second journey) and the WHOLE quote is recomputed by the
 * authoritative quote engine (see amend.server.ts). This module is the pure,
 * server-free half: the journey shape, row -> journey mapping, the blocker
 * rules and the request/response schemas. It must stay free of server imports
 * so node:test can load it.
 */
import { z } from 'zod'
import { TRIP_REQUEST_SOURCES, tripRequestQuoteSchema } from './schema'
import type { ExperienceSelection, RoomAllocationInput, TripRequestQuoteInput, TripRequestSource } from './schema'

/** The journey part of tripRequestQuoteSchema: everything staff may change. */
export type JourneyFields = Omit<TripRequestQuoteInput, 'locale' | 'source'>

/** The columns journeyFromRow reads from a trip_requests row. */
export type JourneyRow = {
  transport_mode: string
  origin_governorate_code?: string | null
  stay_pattern_code?: string | null
  arrival_date: string
  departure_date?: string | null
  adults: number
  children?: number | null
  accommodation_id?: string | null
  room_allocations?: unknown
  meal_plan_key?: string | null
  experiences?: unknown
}

export type AmendmentBlocker = 'amendment_closed' | 'amendment_paid_journey'

/** Statuses at which supplier availability has been confirmed to the customer. */
export const AVAILABILITY_CONFIRMED_STATUSES = ['awaiting_payment', 'confirmed', 'completed'] as const
/** Amending these drops the request back to checking_availability. */
export const AVAILABILITY_RESET_STATUSES = ['awaiting_payment', 'confirmed'] as const

export function isAvailabilityConfirmedStatus(status: string): boolean {
  return (AVAILABILITY_CONFIRMED_STATUSES as readonly string[]).includes(status)
}

export function resetsAvailability(status: string): boolean {
  return (AVAILABILITY_RESET_STATUSES as readonly string[]).includes(status)
}

function isoDay(value: string): string {
  return value.slice(0, 10)
}

function optionalString(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function allocationsFromRow(value: unknown): RoomAllocationInput[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): RoomAllocationInput[] => {
    if (!item || typeof item !== 'object') return []
    const { type, count, upgrade_id: upgradeId } = item as Record<string, unknown>
    if (type !== 'single' && type !== 'double' && type !== 'triple') return []
    if (typeof count !== 'number') return []
    return [{ type, count, ...(typeof upgradeId === 'string' && upgradeId ? { upgrade_id: upgradeId } : {}) }]
  })
}

function experiencesFromRow(value: unknown): ExperienceSelection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ExperienceSelection[] => {
    if (!item || typeof item !== 'object') return []
    const { kind, id, preferred_date: preferred } = item as Record<string, unknown>
    if ((kind !== 'trip' && kind !== 'trip_package') || typeof id !== 'string') return []
    return [{ kind, id, ...(typeof preferred === 'string' && preferred ? { preferred_date: isoDay(preferred) } : {}) }]
  })
}

/**
 * The editable journey of a stored request. Nulls become absent keys (the
 * schema's optionals reject null) and empty room_allocations are omitted so an
 * untouched amendment lets the engine re-recommend rooms.
 */
export function journeyFromRow(row: JourneyRow): JourneyFields {
  const allocations = allocationsFromRow(row.room_allocations)
  const origin = optionalString(row.origin_governorate_code)
  const pattern = optionalString(row.stay_pattern_code)
  const departure = optionalString(row.departure_date)
  const accommodation = optionalString(row.accommodation_id)
  const meal = optionalString(row.meal_plan_key)
  return {
    transport_mode: row.transport_mode as JourneyFields['transport_mode'],
    ...(origin ? { origin_governorate_code: origin } : {}),
    ...(pattern ? { stay_pattern_code: pattern } : {}),
    arrival_date: isoDay(row.arrival_date),
    ...(departure ? { departure_date: isoDay(departure) } : {}),
    adults: Number(row.adults),
    children: Number(row.children ?? 0),
    ...(accommodation ? { accommodation_id: accommodation } : {}),
    ...(allocations.length ? { room_allocations: allocations } : {}),
    ...(meal ? { meal_plan_key: meal } : {}),
    experiences: experiencesFromRow(row.experiences),
  }
}

function sourceFromRow(source: unknown): TripRequestSource {
  return (TRIP_REQUEST_SOURCES as readonly string[]).includes(source as string)
    ? source as TripRequestSource
    : 'website'
}

/**
 * Validates a staff-supplied journey with the SAME schema the customer's Trip
 * Builder uses. Unknown keys (e.g. a client-sent total) are stripped; locale is
 * fixed to 'en' (the customer's stored locale is never changed by an amendment).
 */
export function parseJourney(journey: unknown, source?: unknown) {
  const base = journey && typeof journey === 'object' && !Array.isArray(journey) ? journey : {}
  return tripRequestQuoteSchema.safeParse({ ...base, locale: 'en', source: sourceFromRow(source) })
}

/** Why a request may not be amended right now, or null when it may. */
export function amendmentBlocker(
  input: { status: string; amount_paid: number | string | null | undefined; has_payments: boolean },
): AmendmentBlocker | null {
  if (input.status === 'cancelled' || input.status === 'completed') return 'amendment_closed'
  const paid = Number(input.amount_paid ?? 0)
  if ((Number.isFinite(paid) && paid > 0) || input.has_payments) return 'amendment_paid_journey'
  return null
}

/** The row fields the admin amend screen shows above the editable journey. */
export type AmendableRow = JourneyRow & {
  id: string
  reference: string
  status: string
  updated_at: string
  source?: string | null
  converted_booking_id?: string | null
  converted_at?: string | null
  amount_paid?: number | string | null
  agreed_total?: number | string | null
  quoted_total?: number | string | null
  customer_name: string
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function currentTotal(row: Pick<AmendableRow, 'agreed_total' | 'quoted_total'>): number {
  return numberOrNull(row.agreed_total) ?? numberOrNull(row.quoted_total) ?? 0
}

export type AmendRequestSummary = {
  id: string
  reference: string
  status: string
  updated_at: string
  converted: boolean
  amount_paid: number
  agreed_total: number | null
  quoted_total: number | null
  customer_name: string
  journey: JourneyFields
}

export function amendRequestSummary(row: AmendableRow): AmendRequestSummary {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    updated_at: row.updated_at,
    converted: Boolean(row.converted_booking_id || row.converted_at),
    amount_paid: numberOrNull(row.amount_paid) ?? 0,
    agreed_total: numberOrNull(row.agreed_total),
    quoted_total: numberOrNull(row.quoted_total),
    customer_name: row.customer_name,
    journey: journeyFromRow(row),
  }
}

/** Money to 2 decimals without float noise. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// ─── Request bodies (all .strict(): a client-sent total is a 400, never silently used) ───

const journeyBody = z.record(z.string(), z.unknown())

export const previewBodySchema = z.object({ journey: journeyBody }).strict()

export const applyBodySchema = z.object({
  journey: journeyBody,
  expected_updated_at: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(3).max(500),
}).strict()

export const revisionQuerySchema = z.object({
  revision: z.coerce.number().int().min(1).optional(),
  locale: z.enum(['ar', 'en']).default('en'),
})

/**
 * The journey document stored with a revision and sent to the RPC as p_journey:
 * what was actually priced (resolved departure date, normalized experiences,
 * the exact priced room allocations). Absent optionals are null so the RPC can
 * write the columns directly.
 */
export type AmendedJourneyPayload = {
  transport_mode: JourneyFields['transport_mode']
  origin_governorate_code: string | null
  stay_pattern_code: string | null
  arrival_date: string
  departure_date: string
  adults: number
  children: number
  accommodation_id: string | null
  room_allocations: RoomAllocationInput[]
  meal_plan_key: string | null
  experiences: ExperienceSelection[]
}

export function amendedJourneyPayload(args: {
  input: JourneyFields
  departureDate: string
  roomAllocations?: RoomAllocationInput[]
}): AmendedJourneyPayload {
  const { input } = args
  return {
    transport_mode: input.transport_mode,
    origin_governorate_code: input.origin_governorate_code ?? null,
    stay_pattern_code: input.transport_mode === 'stay_only' ? null : input.stay_pattern_code ?? null,
    arrival_date: input.arrival_date,
    departure_date: args.departureDate,
    adults: input.adults,
    children: input.children,
    accommodation_id: input.accommodation_id ?? null,
    room_allocations: args.roomAllocations ?? input.room_allocations ?? [],
    meal_plan_key: input.meal_plan_key ?? null,
    experiences: input.experiences,
  }
}
