// ─── Signature Experiences: zod schemas shared by the API routes ───
// Kept out of `experiences-data.ts` so client code can reuse the shapes
// without dragging in `server-only`.

import { z } from 'zod'
import {
  EXPERIENCE_BOOKING_STATUSES,
  EXPERIENCE_CURRENCIES,
  EXPERIENCE_DATE_STATUSES,
  EXPERIENCE_STATUSES,
} from './experiences'

const stringList = z.array(z.string().max(300)).max(30)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const itineraryDaySchema = z.object({
  day: z.number().int().min(1).max(60),
  title_ar: z.string().max(200).default(''),
  title_en: z.string().max(200).default(''),
  description_ar: z.string().max(2000).default(''),
  description_en: z.string().max(2000).default(''),
})

export const experienceCreateSchema = z.object({
  slug: z.string().min(1).max(160).optional(),
  title_ar: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  category: z.string().min(1).max(60).default('other'),
  partner_name: z.string().max(160).default(''),
  partner_description_ar: z.string().max(2000).default(''),
  partner_description_en: z.string().max(2000).default(''),
  short_description_ar: z.string().max(400).default(''),
  short_description_en: z.string().max(400).default(''),
  full_description_ar: z.string().max(8000).default(''),
  full_description_en: z.string().max(8000).default(''),
  included_ar: stringList.default([]),
  included_en: stringList.default([]),
  not_included_ar: stringList.default([]),
  not_included_en: stringList.default([]),
  itinerary: z.array(itineraryDaySchema).max(60).default([]),
  hero_image: z.string().max(600).default(''),
  gallery: z.array(z.string().max(600)).max(6).default([]),
  duration_ar: z.string().max(80).default(''),
  duration_en: z.string().max(80).default(''),
  price: z.number().min(0).max(10_000_000).default(0),
  currency: z.enum(EXPERIENCE_CURRENCIES).default('EGP'),
  status: z.enum(EXPERIENCE_STATUSES).default('draft'),
  sort_order: z.number().int().min(0).max(9999).default(0),
  discount_value: z.number().min(0).nullable().optional().default(null),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional().default(null),
  discount_label: z.string().max(100).optional().default(''),
})

export const experienceUpdateSchema = experienceCreateSchema.partial()

export const experienceDateCreateSchema = z
  .object({
    experience_id: z.string().uuid(),
    start_date: isoDate,
    end_date: isoDate,
    total_spots: z.number().int().min(0).max(500).default(10),
    status: z.enum(EXPERIENCE_DATE_STATUSES).default('open'),
    is_open: z.boolean().default(true),
    price_override: z.number().min(0).max(10_000_000).nullable().optional(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  })

export const experienceDateUpdateSchema = z.object({
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  total_spots: z.number().int().min(0).max(500).optional(),
  status: z.enum(EXPERIENCE_DATE_STATUSES).optional(),
  is_open: z.boolean().optional(),
  price_override: z.number().min(0).max(10_000_000).nullable().optional(),
})

export const experienceCategorySchema = z.object({
  slug: z.string().min(1).max(60).optional(),
  label_ar: z.string().min(1).max(80),
  label_en: z.string().min(1).max(80),
  sort_order: z.number().int().min(0).max(9999).default(100),
})

export const experienceBookingStatusSchema = z.object({
  status: z.enum(EXPERIENCE_BOOKING_STATUSES),
})

export const experienceBookingUpdateSchema = z.object({
  status: z.enum(EXPERIENCE_BOOKING_STATUSES).optional(),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded'] as const).optional(),
  amount_paid: z.number().min(0).nullable().optional(),
  payment_channel: z.enum(['instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other'] as const).nullable().optional(),
  payment_received_by: z.string().max(200).optional(),
  payment_notes: z.string().max(1000).optional(),
  discount_value: z.number().min(0).nullable().optional(),
  discount_type: z.enum(['amount', 'percentage'] as const).nullable().optional(),
})

/** Public booking request — mirrors the fields on the customer-facing form. */
export const publicBookingSchema = z.object({
  experience_date_id: z.string().uuid(),
  full_name: z.string().min(3).max(100),
  phone: z.string().min(8).max(25),
  email: z.string().email().max(160),
  spots_requested: z.number().int().min(1).max(20),
  notes: z.string().max(600).optional().default(''),
  agreed: z.literal(true, { message: 'Agreement is required' }),
})
