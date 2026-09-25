/**
 * M2 Trip Builder — validated input shape for a structured trip request.
 * Pure (no server imports) so it can be unit-tested and shared with build.ts.
 *
 * Mirrors the protections on the public bookings request (src/lib/public-booking.ts):
 * a `website` honeypot field and an optional `turnstile_token`.
 *
 * See supabase/migrations/032_trip_requests.sql for the authoritative DB contract.
 */
import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const TRANSPORT_MODES = ['package_bus', 'hiace', 'stay_only'] as const
export type TransportMode = (typeof TRANSPORT_MODES)[number]

export const TRIP_REQUEST_SOURCES = [
  'website', 'manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other',
] as const
export type TripRequestSource = (typeof TRIP_REQUEST_SOURCES)[number]

export const BUILDER_STAGES = ['contact_captured', 'submitted'] as const
export type BuilderStage = (typeof BUILDER_STAGES)[number]

export const EXPERIENCE_KINDS = ['trip', 'trip_package'] as const
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number]

const MAX_EXPERIENCES = 10

/** Same shape the quote engine accepts (src/lib/quote-data.ts `quoteSchema.room_allocations`). */
export const roomAllocationSchema = z.object({
  type: z.enum(['single', 'double', 'triple']),
  count: z.number().int().min(1).max(20),
  upgrade_id: z.string().uuid().optional(),
})
export type RoomAllocationInput = z.infer<typeof roomAllocationSchema>

export const experienceSelectionSchema = z.object({
  kind: z.enum(EXPERIENCE_KINDS),
  id: z.string().uuid(),
  preferred_date: isoDate.optional(),
})
export type ExperienceSelection = z.infer<typeof experienceSelectionSchema>

export const contactSchema = z.object({
  name: z.string().min(3).max(100),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional().or(z.literal('')),
})
export type ContactInput = z.infer<typeof contactSchema>

export const tripRequestSchema = z
  .object({
    locale: z.enum(['ar', 'en']),
    source: z.enum(TRIP_REQUEST_SOURCES).default('website'),

    // Journey
    origin_governorate_code: z.string().min(1).max(40).optional(),
    transport_mode: z.enum(TRANSPORT_MODES),
    stay_pattern_code: z.string().min(1).max(40).optional(),
    arrival_date: isoDate,
    departure_date: isoDate.optional(),
    adults: z.number().int().min(1),
    children: z.number().int().min(0).default(0),

    // Stay
    accommodation_id: z.string().uuid().optional(),
    room_allocations: z.array(roomAllocationSchema).optional(),
    meal_plan_key: z.string().optional(),
    upgrade_id: z.string().uuid().optional(),

    // Experiences
    experiences: z.array(experienceSelectionSchema).max(MAX_EXPERIENCES).default([]),

    // Contact
    contact: contactSchema,
    notes: z.string().max(500).optional(),

    builder_stage: z.enum(BUILDER_STAGES).default('submitted'),

    // Anti-abuse (mirrors src/lib/public-booking.ts)
    website: z.string().max(200).optional(),
    turnstile_token: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.transport_mode === 'stay_only') {
      if (!value.accommodation_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accommodation_id'], message: 'Accommodation is required for a stay.' })
      }
      if (!value.departure_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departure_date'], message: 'Departure date is required for a stay.' })
      } else if (value.departure_date <= value.arrival_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departure_date'], message: 'Departure date must be after the arrival date.' })
      }
    } else {
      if (!value.origin_governorate_code) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['origin_governorate_code'], message: 'Origin governorate is required.' })
      }
      if (!value.stay_pattern_code) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stay_pattern_code'], message: 'A stay pattern is required for this transport mode.' })
      }
    }

    const seen = new Set<string>()
    value.experiences.forEach((experience, index) => {
      const key = `${experience.kind}:${experience.id}`
      if (seen.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['experiences', index], message: 'Duplicate experience selection.' })
      }
      seen.add(key)
    })
  })

export type TripRequestInput = z.infer<typeof tripRequestSchema>
