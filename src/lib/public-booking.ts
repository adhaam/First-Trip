/**
 * Public accommodation / package / transfer booking request: the validated
 * input shape and the mapping to a `bookings` row. Pure (no server imports)
 * so tests can prove the persisted row equals the canonical quote.
 */
import { z } from 'zod'
import type { PriceSnapshot } from '@/lib/types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
export const bookingSchema = z.object({
  customer_name: z.string().min(3).max(100), customer_phone: z.string().min(10).max(20),
  customer_email: z.string().email().optional().or(z.literal('')), booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),
  accommodation_id: z.string().uuid().optional(), governorate: z.string().max(40).optional(), trip_date: isoDate.optional(), return_date: isoDate.optional(),
  duration: z.union([z.literal(4), z.literal(5)]).optional(), nights: z.number().int().min(1).max(30).optional(),
  transfer_type: z.enum(['package_bus', 'hiace']).optional(), transfer_direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']).optional(),
  room_type: z.enum(['double', 'single', 'triple']).optional(), upgrade_id: z.string().uuid().optional(),
  room_allocations: z.array(z.object({ type: z.enum(['single', 'double', 'triple']), count: z.number().int().min(1).max(20), upgrade_id: z.string().uuid().optional() })).optional(),
  meal_plan_key: z.string().optional(), extra_trip_ids: z.array(z.string().uuid()).optional(), trip_package_ids: z.array(z.string().uuid()).optional(),
  num_people: z.number().int().min(1).max(50), notes: z.string().max(500).optional(), website: z.string().max(200).optional(), turnstile_token: z.string().optional(),
}).superRefine((value, ctx) => {
  const required = (path: keyof typeof value, message: string) => { if (!value[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message }) }
  if (value.booking_type === 'package') { required('accommodation_id', 'Accommodation is required'); required('governorate', 'Governorate is required'); required('trip_date', 'Departure date is required'); required('transfer_type', 'Transport mode is required') }
  if (value.booking_type === 'accommodation-only') { required('accommodation_id', 'Accommodation is required'); required('trip_date', 'Check-in date is required') }
  if (value.booking_type === 'transfer-only') { required('governorate', 'Governorate is required'); required('trip_date', 'Transfer date is required'); required('transfer_type', 'Transport mode is required') }
})
export type BookingInput = z.infer<typeof bookingSchema>

/** Maps public booking input to the DB row; quote values remain authoritative. */
export function buildBookingRow(input: BookingInput, quote: { total: number; snapshot: PriceSnapshot }) {
  const rest = { ...input }
  const customerEmail = rest.customer_email
  delete rest.customer_email
  delete rest.room_allocations
  delete rest.upgrade_id
  delete rest.website
  delete rest.turnstile_token
  return { ...rest, customer_email: customerEmail || null, total_price: quote.total, price_snapshot: quote.snapshot, status: 'new', payment_status: 'unpaid', amount_paid: 0, source: 'website' }
}
