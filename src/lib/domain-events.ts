// These rows are written by the database in the same transaction as the change
// (outbox, migrations 031/035/036); browser analytics in src/lib/conversion.ts
// are NOT domain events. Nothing publishes them yet — see docs/m3/AGENEON_BOUNDARY.md.
export const DOMAIN_EVENT_TYPES = [
  'signature_requested',
  'commerce_order_requested',
  'rental_requested',
  'booking_requested',
  'commerce_order_confirmed',
  'commerce_order_cancelled',
  'commerce_order_completed',
  'commerce_order_status_changed',
  'rental_confirmed',
  'rental_cancelled',
  'rental_returned',
  'rental_status_changed',
  'availability_check_started',
  'alternative_required',
  'availability_confirmed',
  'payment_requested',
  'booking_confirmed',
  'booking_cancelled',
  'booking_completed',
  'booking_status_changed',
  'payment_received',
  'payment_refunded',
  // M3 (migration 036)
  'payment_recorded',
  'refund_recorded',
  'trip_request_converted',
  'customer_created',
  'customer_updated',
  'customer_merged',
] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

export type DomainEventAggregate =
  | 'accommodation_booking'
  | 'trip_booking'
  | 'trip_request'
  | 'signature_request'
  | 'commerce_order'
  | 'rental_reservation'
  | 'customer'
