import type { OpsEntityType, WorkItem } from './types'

/**
 * Mirrors the paid_states arrays in weemap_record_payment() (migration 036/049). A journey_component
 * row (a booking/trip_bookings row converted off a trip_request) never takes money directly — that
 * money belongs to the parent journey (see component_of_journey in ops/rpc-errors.ts). A trip_request
 * itself only takes money once it has been converted to a commercial journey with an agreed_total.
 */
export function paymentAllowedFor(
  item: Pick<WorkItem, 'entity_type' | 'status' | 'journey_component' | 'converted'>,
  record: { agreed_total?: unknown },
): boolean {
  if (item.journey_component) return false
  if (item.entity_type === 'trip_request') {
    const agreedTotal = record.agreed_total
    return item.converted === true
      && agreedTotal !== null && agreedTotal !== undefined
      && ['awaiting_payment', 'confirmed', 'completed'].includes(item.status)
  }
  if (item.entity_type === 'commerce_order') {
    return ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'].includes(item.status)
  }
  return ['awaiting_payment', 'confirmed', 'completed'].includes(item.status)
}

export type { OpsEntityType }
