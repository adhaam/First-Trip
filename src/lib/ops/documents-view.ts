import type { OpsEntityType, WorkItem } from './types'

/** Statuses from which supplier availability counts as confirmed (Booking Confirmation can be issued). */
export const AVAILABILITY_CONFIRMED_STATUSES: readonly string[] = ['awaiting_payment', 'confirmed', 'completed']

export function isAvailabilityConfirmed(status: string | null | undefined): boolean {
  return !!status && AVAILABILITY_CONFIRMED_STATUSES.includes(status)
}

export type DocumentsMode = 'journey' | 'booking' | 'component' | 'none'

/**
 * Which documents card an item gets: a journey (trip_request) issues its own set, a standalone
 * booking issues its own set, a journey component defers to its journey, anything else gets none.
 */
export function documentsMode(item: Pick<WorkItem, 'entity_type' | 'journey_component'>): DocumentsMode {
  if (item.entity_type === 'trip_request') return 'journey'
  if (item.entity_type === 'accommodation_booking' || item.entity_type === 'trip_booking') {
    return item.journey_component ? 'component' : 'booking'
  }
  return 'none'
}

/** Payments that were really received (refunds never get a receipt). */
export function receivedPayments<T extends { direction: string }>(payments: readonly T[]): T[] {
  return payments.filter((payment) => payment.direction === 'received')
}

export type PaymentBlockReason = 'convert_first' | 'awaiting_payment_first' | 'order_not_confirmed'

/**
 * Why payments cannot be recorded yet, as a message key, or null when they can. UI-only guidance; the
 * authoritative rule is paymentAllowedFor() on the server.
 */
export function paymentBlockReason(args: {
  entityType: OpsEntityType
  status: string
  converted?: boolean
}): PaymentBlockReason | null {
  const { entityType, status, converted } = args
  if (entityType === 'trip_request' && converted === false) return 'convert_first'
  if (entityType === 'commerce_order') {
    return ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'].includes(status) ? null : 'order_not_confirmed'
  }
  return isAvailabilityConfirmed(status) ? null : 'awaiting_payment_first'
}

/** A filesystem-safe download name: WEEMAP-<part>-<part>.html (the prefix is not doubled). */
export function documentFilename(...parts: Array<string | number | null | undefined>): string {
  const slug = parts
    .filter((part): part is string | number => part !== null && part !== undefined && `${part}`.trim() !== '')
    .map((part) => `${part}`.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('-')
  if (/^weemap-/i.test(slug)) return `${slug}.html`
  return `WEEMAP-${slug || 'document'}.html`
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Formats a Date as the LOCAL "YYYY-MM-DDTHH:mm" string a datetime-local input expects. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Converts a datetime-local value (browser-local wall time) to an ISO instant, or undefined if blank/invalid. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
