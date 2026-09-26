import type { RequestDomain } from '@/lib/request-workflow'

export type OpsEntityType =
  | 'accommodation_booking'
  | 'trip_booking'
  | 'signature_request'
  | 'trip_request'
  | 'commerce_order'
  | 'edition_request'

export type NextAction =
  | 'start_availability_check'
  | 'confirm_availability'
  | 'plan_signature'
  | 'agree_alternative'
  | 'convert_to_booking'
  | 'collect_payment'
  | 'mark_completed'
  | 'refund_due'
  | 'contact_customer'
  | 'confirm_order'
  | 'prepare_order'
  | 'mark_ready'
  | 'hand_over'
  | 'complete_delivery'
  | 'confirm_or_close'
  | 'none'

export type AttentionCode =
  | 'unpaid_close_to_service'
  | 'service_passed_not_completed'
  | 'refund_due'
  | 'stale'
  | 'transfer_unconfirmed'

export type WorkItem = {
  entity_type: OpsEntityType
  entity_id: string
  reference: string
  subtype: string | null
  payment_kind: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string
  status: string
  payment_status: string | null
  amount_total: number | null
  amount_paid: number | null
  start_date: string | null
  end_date: string | null
  people: number | null
  title_en: string
  title_ar: string
  transfer_type: string | null
  source: string
  trip_request_id: string | null
  created_at: string
  updated_at: string
  next_action: NextAction
  needs_action: boolean
  last_change_at: string
  waiting_hours: number
  stale: boolean
  attention: AttentionCode[]
  upfront_due: number | null
  outstanding_now: number | null
}

export type Activity = {
  kind: 'status' | 'payment_status' | 'payment' | 'refund'
  entity_type: OpsEntityType
  entity_id: string
  reference: string
  customer_name: string
  from_value: string | null
  to_value: string | null
  amount?: number
  method?: string
  actor: string | null
  actor_name: string | null
  at: string
}

export const STALE_HOURS: Record<string, number> = {
  new: 24,
  pending: 24,
  contacted: 24,
  checking_availability: 48,
  planning: 72,
  alternatives_required: 72,
  awaiting_payment: 72,
}

/**
 * Generic item-detail plumbing (status transitions, notes, the record join) for entity types whose
 * writes go through the shared request-workflow domain model. edition_request is deliberately absent:
 * its status/notes updates go through PATCH /api/admin/edition-requests/[id] and its own admin panel
 * (EditionRequestsPanel), not the generic ops item routes — a full generic detail view would need to
 * duplicate that panel's own transition rules for no benefit. It still appears in the queue/today lists
 * (via ops_work_items) and search; its work-item links point at the Bookings workspace's Experience
 * requests tab instead of a generic item-detail page (see workItemHref in components/admin/ops/nav.ts).
 */
export const OPS_ENTITY_TABLES: Partial<Record<OpsEntityType, { table: string, domain: RequestDomain }>> = {
  accommodation_booking: { table: 'bookings', domain: 'accommodation_booking' },
  trip_booking: { table: 'trip_bookings', domain: 'trip_booking' },
  signature_request: { table: 'experience_bookings', domain: 'signature_request' },
  trip_request: { table: 'trip_requests', domain: 'trip_request' },
  commerce_order: { table: 'commerce_orders', domain: 'commerce_order' },
}
