/**
 * M2 Trip Builder — versioned, local-only draft for anonymous in-progress
 * state (see supabase/migrations/032_trip_requests.sql header: "Privacy").
 *
 * No server calls, no identifier for the visitor: this is purely a
 * serialize/parse pair for localStorage. A server row is only ever created
 * once the customer submits contact details (src/lib/trip-requests/service.ts).
 */
import { z } from 'zod'
import { experienceSelectionSchema, roomAllocationSchema } from './schema'

export const DRAFT_VERSION = 1 as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

/** Whatever the customer has typed into the contact step so far — never sent anywhere until submit. */
const partialContactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
})

export const tripRequestDraftSchema = z
  .object({
    version: z.literal(DRAFT_VERSION),
    updated_at: z.string(),

    locale: z.enum(['ar', 'en']).optional(),
    source: z.string().optional(),

    origin_governorate_code: z.string().optional(),
    transport_mode: z.enum(['package_bus', 'hiace', 'stay_only']).optional(),
    stay_pattern_code: z.string().optional(),
    arrival_date: isoDate.optional(),
    departure_date: isoDate.optional(),
    adults: z.number().int().min(1).optional(),
    children: z.number().int().min(0).optional(),
    /** True only once the visitor explicitly interacted with the Travellers step (tap/±). */
    travellers_confirmed: z.boolean().optional(),

    accommodation_id: z.string().uuid().optional(),
    room_allocations: z.array(roomAllocationSchema).optional(),
    meal_plan_key: z.string().optional(),
    upgrade_id: z.string().uuid().optional(),

    experiences: z.array(experienceSelectionSchema).max(10).optional(),

    notes: z.string().max(500).optional(),
    contact: partialContactSchema.optional(),
  })
  .strict()

export type TripRequestDraft = z.infer<typeof tripRequestDraftSchema>
export type DraftFields = Omit<TripRequestDraft, 'version' | 'updated_at'>

/** Stamps the current version and timestamp and serializes for localStorage. */
export function serializeDraft(fields: DraftFields, now: Date = new Date()): string {
  const draft: TripRequestDraft = { ...fields, version: DRAFT_VERSION, updated_at: now.toISOString() }
  return JSON.stringify(draft)
}

export type ParseDraftResult =
  | { ok: true; draft: TripRequestDraft }
  | { ok: false; reason: 'empty' | 'invalid_json' | 'unsupported_version' | 'invalid_shape' }

/**
 * Parses a stored draft, rejecting anything that isn't exactly the current
 * version or that fails validation (a tampered or hand-edited value).
 */
export function parseDraft(raw: string | null | undefined): ParseDraftResult {
  if (!raw) return { ok: false, reason: 'empty' }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }

  if (
    typeof data === 'object' && data !== null && 'version' in data &&
    (data as { version: unknown }).version !== DRAFT_VERSION
  ) {
    return { ok: false, reason: 'unsupported_version' }
  }

  const result = tripRequestDraftSchema.safeParse(data)
  if (!result.success) return { ok: false, reason: 'invalid_shape' }
  return { ok: true, draft: result.data }
}
