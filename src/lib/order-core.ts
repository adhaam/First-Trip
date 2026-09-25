import type { SupabaseClient } from '@supabase/supabase-js'
import {
  quoteRental,
  rentalDepositFor,
  resolveDeliveryFee,
  sumSubtotals,
  type RentalPricingRule,
  type RentalPricingTier,
} from './rental-pricing'

/**
 * Client-injectable core of commerce order creation + order status changes.
 * Deliberately has NO 'server-only' import so it can be unit tested against a
 * fake client (see order-core.test.ts). Route handlers must NOT call this
 * directly — use createCommerceOrder from '@/lib/orders', which binds it to
 * the service-role client.
 */

export interface OrderItemInput {
  productId: string
  variantId?: string | null
  quantity: number
  /** Rental-only: requested duration in days. */
  rentalDurationDays?: number
  /** Rental-only: requested start date (YYYY-MM-DD). */
  rentalStartDate?: string
}

export interface CreateOrderInput {
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  fulfillmentMethod: 'pickup' | 'delivery'
  deliveryZoneId?: string | null
  deliveryAddress?: string | null
  notes?: string
  source?: string
  items: OrderItemInput[]
}

export interface CreateOrderResult {
  success: true
  orderId: string
  orderNumber: string
  subtotal: number
  deliveryFee: number
  /** True when the delivery zone is priced by quote — fee settled on WhatsApp. */
  deliveryFeePending: boolean
  totalPrice: number
  /** Refundable rental deposit due at handover. NOT included in totalPrice. */
  depositTotal: number
}

export interface CreateOrderError {
  success: false
  error: string
}

export interface OrderDeps {
  db: SupabaseClient
  findOrCreateCustomer: (input: { phone: string; name?: string; email?: string | null }) => Promise<{ id: string }>
  recordCustomerActivity: (customerId: string) => Promise<void>
  getTotalInventory: (productId: string, variantId: string | null) => Promise<number>
  /** Today's date (UTC) as YYYY-MM-DD. Injectable for tests. */
  today?: () => string
}

/**
 * Shape stored in commerce_order_items.variant_snapshot (JSONB, migration
 * 013). There is no dedicated column for these facts, so they are frozen
 * here at order time.
 */
export interface OrderItemSnapshot {
  option_value_ids?: string[]
  /** True iff sale stock was decremented for this line at creation time.
   *  Cancel/reopen use it so restocking is exactly symmetric. */
  inventory_reserved?: boolean
  rental_pricing_rule?: RentalPricingRule
  rental_requested_days?: number
  /** Refundable deposit — separate from line_total, never added to it. */
  rental_deposit_per_unit?: number
  rental_deposit_total?: number
}

type PricedItem = {
  productId: string
  variantId: string | null
  itemType: 'sale' | 'rental'
  nameAr: string
  nameEn: string
  unitPrice: number
  quantity: number
  lineTotal: number
  snapshot: OrderItemSnapshot
  rentalDurationDays?: number
  rentalStartDate?: string
  rentalEndDate?: string
}

/** YYYY-MM-DD + duration (inclusive of the start day) → last rental day. */
export function rentalEndDate(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days - 1)
  return d.toISOString().slice(0, 10)
}

function todayIsoUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Turns a client-submitted merch/rental request into a priced
 * `commerce_orders` + `commerce_order_items` (+ `rental_reservations`) record.
 *
 * Prices: every amount is recomputed from DB product/variant/tier rows. The
 * input type has no price fields at all, so a client price can't reach here.
 *
 * All-or-nothing (application level): every side effect — sale stock
 * decrements, the order row, item rows, reservation rows — is recorded in a
 * compensation ledger. Any failure (or a thrown error) rolls all of them
 * back before an error is returned, so an order can never exist with fewer
 * items than its total, and stock is never leaked. A Postgres function
 * wrapping this in one transaction would be stronger (a crashed process
 * mid-flight can't compensate) — see the report accompanying this change.
 */
export async function createCommerceOrderWithClient(
  input: CreateOrderInput,
  deps: OrderDeps,
): Promise<CreateOrderResult | CreateOrderError> {
  if (input.items.length === 0) return { success: false, error: 'No items in order' }
  const db = deps.db
  const today = deps.today || todayIsoUTC

  // ── Load products + variants + rental tiers referenced by this order ──
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)))
  const { data: products, error: productsError } = await db
    .from('commerce_products')
    .select('id, name_ar, name_en, product_type, base_price, is_active, archived_at, track_inventory, deposit_amount')
    .in('id', productIds)
  if (productsError) return { success: false, error: 'Failed to load products' }

  const productById = new Map((products || []).map((p) => [p.id as string, p]))
  for (const item of input.items) {
    const product = productById.get(item.productId)
    if (!product || !product.is_active || product.archived_at) {
      return { success: false, error: `Product ${item.productId} is not available` }
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return { success: false, error: 'Invalid quantity' }
    }
  }

  // All variants of every product in the order: needed both to validate the
  // chosen variant and to know whether a product *has* variants (in which
  // case one must be chosen — otherwise a client could omit the variant to
  // get base_price instead of the variant's price and skip stock checks).
  const { data: variants, error: variantsError } = await db
    .from('commerce_product_variants')
    .select('id, product_id, price_override, inventory_quantity, is_active, option_value_ids')
    .in('product_id', productIds)
  if (variantsError) return { success: false, error: 'Failed to load products' }
  const variantById = new Map((variants || []).map((v) => [v.id as string, v]))
  const productHasActiveVariants = new Set(
    (variants || []).filter((v) => v.is_active).map((v) => v.product_id as string),
  )

  const rentalProductIds = input.items
    .filter((i) => productById.get(i.productId)?.product_type === 'rental')
    .map((i) => i.productId)
  let tiers: RentalPricingTier[] = []
  if (rentalProductIds.length) {
    const { data, error } = await db
      .from('rental_pricing_tiers')
      .select('id, product_id, variant_id, duration_days, price, is_active')
      .in('product_id', rentalProductIds)
    if (error) return { success: false, error: 'Failed to load rental pricing' }
    tiers = (data || []) as RentalPricingTier[]
  }

  // ── Compensation ledger ──
  const decrementedVariants: { variantId: string; quantity: number }[] = []
  let createdOrderId: string | null = null
  const createdItemIds: string[] = []
  const createdReservationIds: string[] = []

  const rollback = async (reason: string) => {
    const problems: string[] = []
    if (createdReservationIds.length) {
      const { error } = await db.from('rental_reservations').delete().in('id', createdReservationIds)
      if (error) {
        const { error: cancelError } = await db
          .from('rental_reservations')
          .update({ status: 'cancelled' })
          .in('id', createdReservationIds)
        if (cancelError) problems.push(`reservations ${createdReservationIds.join(',')} not removed`)
      }
    }
    if (createdOrderId) {
      if (createdItemIds.length) {
        const { error } = await db.from('commerce_order_items').delete().eq('order_id', createdOrderId)
        if (error) problems.push(`items of order ${createdOrderId} not removed`)
      }
      const { error } = await db.from('commerce_orders').delete().eq('id', createdOrderId)
      if (error) {
        // Can't delete → at least make sure nobody fulfils it.
        const { error: cancelError } = await db
          .from('commerce_orders')
          .update({ status: 'cancelled', internal_notes: `Auto-cancelled: order creation failed (${reason})` })
          .eq('id', createdOrderId)
        if (cancelError) problems.push(`order ${createdOrderId} not removed or cancelled`)
      }
    }
    for (const d of decrementedVariants) {
      const { error } = await db.rpc('restock_variant_inventory', { p_variant_id: d.variantId, p_qty: d.quantity })
      if (error) problems.push(`variant ${d.variantId} not restocked by ${d.quantity}`)
    }
    if (problems.length) {
      console.error('[orders] rollback incomplete — manual reconciliation needed:', { reason, problems })
    }
  }

  const fail = async (error: string, reason = error): Promise<CreateOrderError> => {
    await rollback(reason)
    return { success: false, error }
  }

  try {
    // ── Price every line item server-side, reserving sale stock atomically ──
    const pricedItems: PricedItem[] = []
    let orderType: 'merch' | 'rental' | 'mixed' | null = null

    for (const item of input.items) {
      const product = productById.get(item.productId)!
      const variant = item.variantId ? variantById.get(item.variantId) : null
      if (item.variantId && (!variant || variant.product_id !== item.productId || !variant.is_active)) {
        return fail(`Invalid variant for product ${item.productId}`)
      }
      if (!item.variantId && productHasActiveVariants.has(item.productId)) {
        return fail(`Please choose an option for ${product.name_en}`)
      }
      const snapshot: OrderItemSnapshot = {}
      if (variant) snapshot.option_value_ids = (variant.option_value_ids as string[]) || []

      if (product.product_type === 'sale') {
        if (product.track_inventory && variant) {
          const { data: reserved, error: reserveError } = await db.rpc('decrement_variant_inventory', {
            p_variant_id: variant.id,
            p_qty: item.quantity,
          })
          if (reserveError || !reserved) return fail(`Insufficient stock for ${product.name_en}`)
          decrementedVariants.push({ variantId: variant.id as string, quantity: item.quantity })
          snapshot.inventory_reserved = true
        } else {
          snapshot.inventory_reserved = false
        }
        const unitPrice =
          variant?.price_override != null ? Number(variant.price_override) : Number(product.base_price)
        pricedItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          itemType: 'sale',
          nameAr: product.name_ar,
          nameEn: product.name_en,
          unitPrice,
          quantity: item.quantity,
          lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
          snapshot,
        })
        orderType = orderType === null || orderType === 'merch' ? 'merch' : 'mixed'
      } else {
        if (!item.rentalDurationDays || !item.rentalStartDate) {
          return fail('Rental items require a duration and start date')
        }
        if (item.rentalStartDate < today()) {
          return fail(`${product.name_en} cannot be rented starting in the past`)
        }
        const quote = quoteRental({
          // The tier query spans every rental product in the order — scope it
          // so product-level tiers of another product can never price this one.
          tiers: tiers.filter((t) => t.product_id === item.productId),
          variantId: item.variantId || null,
          requestedDays: item.rentalDurationDays,
          quantity: item.quantity,
        })
        if (!quote) {
          return fail(`No pricing configured for ${product.name_en}`)
        }

        // quote.durationDays >= requested days (rounded up or pro rata), so
        // the reservation always covers the full requested range.
        const startDate = item.rentalStartDate
        const endDate = rentalEndDate(startDate, quote.durationDays)
        const totalInventory = await deps.getTotalInventory(item.productId, item.variantId || null)
        const { data: available, error: availError } = await db.rpc('check_rental_availability_locked', {
          p_product_id: item.productId,
          p_variant_id: item.variantId || null,
          p_start_date: startDate,
          p_end_date: endDate,
          p_qty: item.quantity,
          p_total_inventory: totalInventory,
          p_exclude_reservation_id: null,
        })
        if (availError || !available) return fail(`${product.name_en} is not available for the selected dates`)

        const deposit = rentalDepositFor(product.deposit_amount, item.quantity)
        snapshot.rental_pricing_rule = quote.rule
        snapshot.rental_requested_days = item.rentalDurationDays
        snapshot.rental_deposit_per_unit = deposit.perUnit
        snapshot.rental_deposit_total = deposit.total

        pricedItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          itemType: 'rental',
          nameAr: product.name_ar,
          nameEn: product.name_en,
          unitPrice: quote.unitPrice,
          quantity: item.quantity,
          lineTotal: quote.subtotal,
          snapshot,
          rentalDurationDays: quote.durationDays,
          rentalStartDate: startDate,
          rentalEndDate: endDate,
        })
        orderType = orderType === null || orderType === 'rental' ? 'rental' : 'mixed'
      }
    }

    // Sum of the exact line totals that are inserted below — the order total
    // is by construction equal to its items plus the delivery fee.
    const subtotal = Math.round(sumSubtotals(pricedItems.map((i) => i.lineTotal)) * 100) / 100
    const depositTotal =
      Math.round(sumSubtotals(pricedItems.map((i) => i.snapshot.rental_deposit_total || 0)) * 100) / 100

    let zone: { fee_type: 'fixed' | 'free' | 'quote'; fixed_fee: number } | null = null
    if (input.fulfillmentMethod === 'delivery' && input.deliveryZoneId) {
      const { data: zoneRow, error: zoneError } = await db
        .from('delivery_zones')
        .select('fee_type, fixed_fee, is_active')
        .eq('id', input.deliveryZoneId)
        .maybeSingle()
      if (zoneError) return fail('Failed to load delivery zone')
      if (!zoneRow || zoneRow.is_active === false) return fail('Selected delivery zone is not available')
      zone = zoneRow
    }
    const deliveryFee = resolveDeliveryFee({ fulfillmentMethod: input.fulfillmentMethod, zone })
    const deliveryFeePending = input.fulfillmentMethod === 'delivery' && zone?.fee_type === 'quote'
    const totalPrice = Math.round((subtotal + deliveryFee) * 100) / 100

    // ── Resolve canonical customer ──
    const customer = await deps.findOrCreateCustomer({
      phone: input.customerPhone,
      name: input.customerName,
      email: input.customerEmail,
    })

    // ── Create order + items (+ rental reservations) ──
    const { data: order, error: orderError } = await db
      .from('commerce_orders')
      .insert({
        customer_id: customer.id,
        order_type: orderType || 'merch',
        fulfillment_method: input.fulfillmentMethod,
        delivery_zone_id: input.deliveryZoneId || null,
        delivery_address: input.deliveryAddress || '',
        subtotal,
        delivery_fee: deliveryFee,
        total_price: totalPrice,
        notes: input.notes || '',
        // commerce_orders has no deposit column; make the refundable deposit
        // visible to staff without inflating total_price.
        internal_notes:
          depositTotal > 0
            ? `Refundable rental deposit due at handover: ${depositTotal} EGP (not included in total).`
            : '',
        source: input.source || 'website',
        status: 'new',
      })
      .select('id, order_number')
      .single()
    if (orderError || !order) return fail('Failed to create order')
    createdOrderId = order.id as string

    for (const item of pricedItems) {
      const { data: orderItem, error: itemError } = await db
        .from('commerce_order_items')
        .insert({
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variantId,
          item_type: item.itemType,
          name_snapshot_ar: item.nameAr,
          name_snapshot_en: item.nameEn,
          variant_snapshot: item.snapshot,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          rental_duration_days: item.rentalDurationDays || null,
          rental_start_date: item.rentalStartDate || null,
          rental_end_date: item.rentalEndDate || null,
          line_total: item.lineTotal,
        })
        .select('id')
        .single()
      if (itemError || !orderItem) return fail('Failed to create order', `item insert failed for ${item.productId}`)
      createdItemIds.push(orderItem.id as string)

      if (item.itemType === 'rental' && item.rentalStartDate && item.rentalEndDate) {
        const { data: reservation, error: reservationError } = await db
          .from('rental_reservations')
          .insert({
            order_item_id: orderItem.id,
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity,
            start_date: item.rentalStartDate,
            end_date: item.rentalEndDate,
            status: 'requested',
          })
          .select('id')
          .single()
        if (reservationError || !reservation) {
          return fail('Failed to create order', `reservation insert failed for ${item.productId}`)
        }
        createdReservationIds.push(reservation.id as string)
      }
    }

    // The order is committed at this point; a CRM counter failing must not
    // turn a successful order into an error the customer retries.
    try {
      await deps.recordCustomerActivity(customer.id)
    } catch (err) {
      console.error('[orders] recordCustomerActivity failed:', err)
    }

    return {
      success: true,
      orderId: order.id as string,
      orderNumber: order.order_number as string,
      subtotal,
      deliveryFee,
      deliveryFeePending,
      totalPrice,
      depositTotal,
    }
  } catch (err) {
    console.error('[orders] order creation threw:', err)
    return fail('Failed to create order', err instanceof Error ? err.message : 'exception')
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Status transitions into / out of 'cancelled'
// ─────────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'new' | 'contacted' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'

export interface OrderPatch {
  status?: OrderStatus
  payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded'
  amount_paid?: number
  internal_notes?: string
}

export type OrderPatchResult =
  | { ok: true; order: Record<string, unknown>; transition: 'cancelled' | 'reopened' | null; warnings: string[] }
  | { ok: false; status: number; error: string }

/** Reservation statuses an order cancellation moves to 'cancelled'.
 *  returned/completed rentals are history and are left untouched. */
const CANCELLABLE_RESERVATION_STATUSES = ['requested', 'contacted', 'confirmed', 'active', 'late']

type StockLine = { id: string; variant_id: string; quantity: number }

/**
 * Sale lines whose stock was decremented at creation. New orders record it
 * in variant_snapshot.inventory_reserved; for orders created before that
 * flag existed, fall back to the rule creation used: a sale line with a
 * variant on a product that tracks inventory.
 */
async function stockReservedLines(db: SupabaseClient, orderId: string): Promise<StockLine[]> {
  const { data: items, error } = await db
    .from('commerce_order_items')
    .select('id, product_id, variant_id, quantity, item_type, variant_snapshot')
    .eq('order_id', orderId)
  if (error) throw new Error('Failed to load order items')
  const saleItems = (items || []).filter((i) => i.item_type === 'sale' && i.variant_id)

  const legacyProductIds = Array.from(
    new Set(
      saleItems
        .filter((i) => typeof (i.variant_snapshot as OrderItemSnapshot | null)?.inventory_reserved !== 'boolean')
        .map((i) => i.product_id as string)
        .filter(Boolean),
    ),
  )
  const tracked = new Set<string>()
  if (legacyProductIds.length) {
    const { data: products, error: productsError } = await db
      .from('commerce_products')
      .select('id, track_inventory')
      .in('id', legacyProductIds)
    if (productsError) throw new Error('Failed to load products')
    for (const p of products || []) if (p.track_inventory) tracked.add(p.id as string)
  }

  return saleItems
    .filter((i) => {
      const flag = (i.variant_snapshot as OrderItemSnapshot | null)?.inventory_reserved
      return typeof flag === 'boolean' ? flag : tracked.has(i.product_id as string)
    })
    .map((i) => ({ id: i.id as string, variant_id: i.variant_id as string, quantity: Number(i.quantity) }))
}

async function orderItemIds(db: SupabaseClient, orderId: string): Promise<string[]> {
  const { data } = await db.from('commerce_order_items').select('id').eq('order_id', orderId)
  return (data || []).map((i) => i.id as string)
}

/**
 * Applies an admin order update. Moving into or out of 'cancelled' is
 * idempotent and symmetric:
 *
 *  - → cancelled: the status write is conditional (`status <> 'cancelled'`),
 *    so of two concurrent cancels exactly one updates a row, and only that
 *    one restocks. Restocks exactly the lines that decremented stock and
 *    cancels the order's open rental reservations.
 *  - cancelled → anything else: conditional on `status = 'cancelled'`, then
 *    re-decrements the same lines. If any line lacks stock, everything
 *    re-decremented so far is restocked, the order is put back to
 *    'cancelled', and a 409 is returned. Reservations cancelled with the
 *    order return to 'requested' (non-reserving) — staff re-confirm them
 *    through the rentals screen, which re-checks availability.
 *  - Any other update is a plain write with no inventory side effects.
 */
export async function applyOrderPatchWithClient(
  db: SupabaseClient,
  id: string,
  patch: OrderPatch,
): Promise<OrderPatchResult> {
  const warnings: string[] = []

  const plainUpdate = async (fields: OrderPatch): Promise<OrderPatchResult> => {
    const { data, error } = await db.from('commerce_orders').update(fields).eq('id', id).select().maybeSingle()
    if (error) return { ok: false, status: 500, error: 'Failed to update order' }
    if (!data) return { ok: false, status: 404, error: 'Order not found' }
    return { ok: true, order: data, transition: null, warnings }
  }

  if (patch.status === 'cancelled') {
    const { data: claimed, error } = await db
      .from('commerce_orders')
      .update(patch)
      .eq('id', id)
      .neq('status', 'cancelled')
      .select()
    if (error) return { ok: false, status: 500, error: 'Failed to update order' }
    if (!claimed || claimed.length === 0) {
      // Already cancelled (or missing): apply the other fields, no restock.
      return plainUpdate(patch)
    }

    try {
      for (const line of await stockReservedLines(db, id)) {
        const { error: restockError } = await db.rpc('restock_variant_inventory', {
          p_variant_id: line.variant_id,
          p_qty: line.quantity,
        })
        if (restockError) warnings.push(`Variant ${line.variant_id} was not restocked by ${line.quantity}`)
      }
      const itemIds = await orderItemIds(db, id)
      if (itemIds.length) {
        const { error: resError } = await db
          .from('rental_reservations')
          .update({ status: 'cancelled' })
          .in('order_item_id', itemIds)
          .in('status', CANCELLABLE_RESERVATION_STATUSES)
        if (resError) warnings.push('Linked rental reservations were not cancelled')
      }
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : 'Inventory side effects failed')
    }
    if (warnings.length) console.error('[orders] cancel side effects incomplete:', { id, warnings })
    return { ok: true, order: claimed[0], transition: 'cancelled', warnings }
  }

  if (patch.status) {
    const { data: claimed, error } = await db
      .from('commerce_orders')
      .update(patch)
      .eq('id', id)
      .eq('status', 'cancelled')
      .select()
    if (error) return { ok: false, status: 500, error: 'Failed to update order' }
    if (!claimed || claimed.length === 0) return plainUpdate(patch)

    // Reopening: take the stock back. Roll back the reopen if we can't.
    const revert = async (message: string, redecremented: StockLine[]): Promise<OrderPatchResult> => {
      for (const line of redecremented) {
        await db.rpc('restock_variant_inventory', { p_variant_id: line.variant_id, p_qty: line.quantity })
      }
      await db.from('commerce_orders').update({ status: 'cancelled' }).eq('id', id).eq('status', patch.status!)
      return { ok: false, status: 409, error: message }
    }

    let lines: StockLine[]
    try {
      lines = await stockReservedLines(db, id)
    } catch {
      return revert('Could not load order items to re-reserve stock; order left cancelled.', [])
    }
    const done: StockLine[] = []
    for (const line of lines) {
      const { data: reserved, error: decError } = await db.rpc('decrement_variant_inventory', {
        p_variant_id: line.variant_id,
        p_qty: line.quantity,
      })
      if (decError || !reserved) {
        return revert('Not enough stock to reopen this order; it was left cancelled.', done)
      }
      done.push(line)
    }

    const itemIds = await orderItemIds(db, id)
    if (itemIds.length) {
      const { error: resError } = await db
        .from('rental_reservations')
        .update({ status: 'requested' })
        .in('order_item_id', itemIds)
        .eq('status', 'cancelled')
      if (resError) warnings.push('Linked rental reservations were not reopened')
    }
    return { ok: true, order: claimed[0], transition: 'reopened', warnings }
  }

  return plainUpdate(patch)
}
