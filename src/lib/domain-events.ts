// These rows are written by the DB trigger (outbox); browser analytics in
// src/lib/conversion.ts are NOT domain events.
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
] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

export type DomainEventAggregate =
  | 'accommodation_booking'
  | 'trip_booking'
  | 'trip_request'
  | 'signature_request'
  | 'commerce_order'
  | 'rental_reservation'
