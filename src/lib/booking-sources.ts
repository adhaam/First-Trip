/**
 * Booking acquisition channels — the single list every route validates
 * `source` against. Pure and client-safe (no server-only import) so admin
 * components can render the same list instead of hardcoding their own.
 *
 * BOOKING_SOURCES must equal the CHECK (source IN (...)) list on
 * bookings (bookings_source_check, migration 004), trip_bookings and
 * commerce_orders (migration 013). booking-sources.test.ts parses the
 * migrations and fails if they drift apart — change both together, and
 * never widen this list without a migration.
 */
export const BOOKING_SOURCES = [
  'website',
  'manual',
  'whatsapp',
  'instagram',
  'facebook',
  'referral',
  'other',
] as const

export type BookingSource = (typeof BOOKING_SOURCES)[number]

/**
 * Channels a staff member can record when creating a booking by hand.
 * `website` is excluded: it means the customer submitted the public form
 * themselves, which a staff-created row never is.
 */
export const STAFF_BOOKING_SOURCES = [
  'manual',
  'whatsapp',
  'instagram',
  'facebook',
  'referral',
  'other',
] as const satisfies readonly BookingSource[]

export type StaffBookingSource = (typeof STAFF_BOOKING_SOURCES)[number]

/** What a staff-created booking records when the channel wasn't specified. */
export const DEFAULT_STAFF_BOOKING_SOURCE: StaffBookingSource = 'manual'
