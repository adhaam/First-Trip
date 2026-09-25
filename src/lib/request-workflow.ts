/**
 * Every request-status change is recorded by the database triggers in migration
 * 031. This module decides which changes are allowed; the database records what
 * happened.
 */
export type RequestDomain =
  | 'accommodation_booking'
  | 'trip_booking'
  | 'signature_request'
  | 'trip_request'
  | 'commerce_order'
  | 'rental_reservation'

export const STATUSES = {
  accommodation_booking: ['new', 'pending', 'checking_availability', 'alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled', 'completed'],
  trip_booking: ['new', 'contacted', 'checking_availability', 'alternatives_required', 'awaiting_payment', 'confirmed', 'completed', 'cancelled'],
  signature_request: ['new', 'contacted', 'planning', 'alternatives_required', 'awaiting_payment', 'confirmed', 'completed', 'cancelled'],
  trip_request: ['new', 'checking_availability', 'alternatives_required', 'awaiting_payment', 'confirmed', 'completed', 'cancelled'],
  commerce_order: ['new', 'contacted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'],
  rental_reservation: ['requested', 'contacted', 'confirmed', 'active', 'returned', 'completed', 'cancelled', 'late'],
} as const satisfies Record<RequestDomain, readonly string[]>

export type RequestStatus<D extends RequestDomain = RequestDomain> = (typeof STATUSES)[D][number]

type TransitionMap = Record<RequestDomain, Readonly<Record<string, readonly string[]>>>

const operationalTransitions = {
  checking_availability: ['alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled'],
  alternatives_required: ['checking_availability', 'awaiting_payment', 'confirmed', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled', 'alternatives_required'],
  confirmed: ['completed', 'cancelled'],
  cancelled: ['new'],
  completed: ['confirmed'],
} as const

/** Explicit operational paths, including legacy states and staff corrections. */
export const TRANSITIONS: TransitionMap = {
  accommodation_booking: {
    new: ['pending', 'checking_availability', 'cancelled'],
    pending: ['checking_availability', 'alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled'],
    ...operationalTransitions,
  },
  trip_booking: {
    new: ['contacted', 'checking_availability', 'cancelled'],
    contacted: ['checking_availability', 'alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled'],
    ...operationalTransitions,
  },
  signature_request: {
    new: ['contacted', 'planning', 'alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled'],
    contacted: ['planning', 'alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled'],
    planning: ['alternatives_required', 'awaiting_payment', 'confirmed', 'cancelled'],
    alternatives_required: ['planning', 'awaiting_payment', 'confirmed', 'cancelled'],
    awaiting_payment: ['confirmed', 'cancelled', 'alternatives_required'],
    confirmed: ['completed', 'cancelled'],
    cancelled: ['new'],
    completed: ['confirmed'],
  },
  trip_request: {
    new: ['checking_availability', 'cancelled'],
    ...operationalTransitions,
  },
  commerce_order: {
    new: ['contacted', 'cancelled'],
    contacted: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['out_for_delivery', 'cancelled'],
    out_for_delivery: ['completed', 'cancelled'],
    completed: ['confirmed'],
    cancelled: ['new'],
  },
  rental_reservation: {
    requested: ['contacted', 'cancelled'],
    contacted: ['confirmed', 'cancelled'],
    confirmed: ['active', 'cancelled'],
    active: ['returned', 'late', 'cancelled'],
    late: ['returned', 'completed', 'cancelled'],
    returned: ['completed', 'cancelled'],
    completed: ['confirmed'],
    cancelled: ['requested'],
  },
}

export class WorkflowError extends Error {
  readonly code = 'invalid_transition'

  constructor(readonly domain: RequestDomain, readonly from: string, readonly to: string) {
    super(`Cannot transition ${domain} from ${from} to ${to}`)
    this.name = 'WorkflowError'
  }
}

export function canTransition(domain: RequestDomain, from: string, to: string): boolean {
  if (!(STATUSES[domain] as readonly string[]).includes(from) || !(STATUSES[domain] as readonly string[]).includes(to)) return false
  return from === to || TRANSITIONS[domain][from]?.includes(to) === true
}

export function assertTransition<D extends RequestDomain>(domain: D, from: RequestStatus<D>, to: RequestStatus<D>): void {
  if (!canTransition(domain, from, to)) throw new WorkflowError(domain, from, to)
}

export function allowedNextStatuses<D extends RequestDomain>(domain: D, from: RequestStatus<D>): RequestStatus<D>[] {
  if (!(STATUSES[domain] as readonly string[]).includes(from)) return []
  return [from, ...(TRANSITIONS[domain][from] ?? [])] as RequestStatus<D>[]
}

/** Payment may only be requested after availability has been confirmed. */
export function requiresConfirmedAvailability(to: string): boolean {
  return to === 'awaiting_payment' || to === 'confirmed'
}
