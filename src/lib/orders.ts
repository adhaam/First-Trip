import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import {
  applyOrderPatchWithClient,
  createCommerceOrderWithClient,
  type CreateOrderError,
  type CreateOrderInput,
  type CreateOrderResult,
  type OrderPatch,
  type OrderPatchResult,
} from '@/lib/order-core'

/**
 * Reusable order creation service — the single place that turns a
 * client-submitted merch/rental request into a priced `commerce_orders` +
 * `commerce_order_items` (+ `rental_reservations` for rental lines) record.
 *
 * Every total is recomputed from DB-trusted product/variant/tier data and
 * creation is one database transaction — see createCommerceOrderWithClient
 * in src/lib/order-core.ts (kept there, free of 'server-only', so it is unit
 * tested against a fake client) and migration 039.
 */

export type {
  CreateOrderError,
  CreateOrderInput,
  CreateOrderResult,
  OrderItemInput,
  OrderPatch,
  OrderPatchResult,
} from '@/lib/order-core'

export async function createCommerceOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult | CreateOrderError> {
  return createCommerceOrderWithClient(input, {
    db: getSupabaseAdmin(),
    findOrCreateCustomer: findOrCreateCustomerByPhone,
    recordCustomerActivity,
  })
}

/** Admin order update; status changes (with their inventory effects) are one
 *  transaction — see applyOrderPatchWithClient in src/lib/order-core.ts. */
export async function applyCommerceOrderPatch(
  id: string,
  patch: OrderPatch,
  acting: { actor: string },
): Promise<OrderPatchResult> {
  // The acting staff member is recorded in status_history / audit_log.
  return applyOrderPatchWithClient(getSupabaseAdmin(acting), id, patch)
}
