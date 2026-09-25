import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { getTotalInventory } from '@/lib/rental-availability'
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
 * creation is all-or-nothing — see createCommerceOrderWithClient in
 * src/lib/order-core.ts for the rules (kept there, free of 'server-only',
 * so it is unit tested against a fake client).
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
    getTotalInventory,
  })
}

/** Admin order update with idempotent, symmetric cancel/reopen inventory
 *  handling — see applyOrderPatchWithClient in src/lib/order-core.ts. */
export async function applyCommerceOrderPatch(id: string, patch: OrderPatch): Promise<OrderPatchResult> {
  return applyOrderPatchWithClient(getSupabaseAdmin(), id, patch)
}
