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
  /** Set after this line's stock is returned on cancellation; reopening clears it. */
  inventory_restocked_at?: string
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
 * All-or-nothing in the database: every write — sale stock decrements, the
 * order row, item rows, reservation rows — happens inside one call to
 * weemap_place_commerce_order (migration 039). Not enough stock, rental
 * dates already taken or a bad total roll the whole transaction back, so an
 * order can never exist with fewer items than its total and stock is never
 * leaked, even if this process dies mid-request.
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

  // ── Price every line item server-side (reads only; nothing is written yet) ──
  const pricedItems: PricedItem[] = []
  let orderType: 'merch' | 'rental' | 'mixed' | null = null

  for (const item of input.items) {
    const product = productById.get(item.productId)!
    const variant = item.variantId ? variantById.get(item.variantId) : null
    if (item.variantId && (!variant || variant.product_id !== item.productId || !variant.is_active)) {
      return { success: false, error: `Invalid variant for product ${item.productId}` }
    }
    if (!item.variantId && productHasActiveVariants.has(item.productId)) {
      return { success: false, error: `Please choose an option for ${product.name_en}` }
    }
    const snapshot: OrderItemSnapshot = {}
    if (variant) snapshot.option_value_ids = (variant.option_value_ids as string[]) || []

    if (product.product_type === 'sale') {
      // Stock is taken by weemap_place_commerce_order in the same transaction
      // that writes the order; this flag tells it (and cancel/reopen) to.
      snapshot.inventory_reserved = Boolean(product.track_inventory && variant)
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
        return { success: false, error: 'Rental items require a duration and start date' }
      }
      if (item.rentalStartDate < today()) {
        return { success: false, error: `${product.name_en} cannot be rented starting in the past` }
      }
      const quote = quoteRental({
        // The tier query spans every rental product in the order — scope it
        // so product-level tiers of another product can never price this one.
        tiers: tiers.filter((t) => t.product_id === item.productId),
        variantId: item.variantId || null,
        requestedDays: item.rentalDurationDays,
        quantity: item.quantity,
      })
      if (!quote) return { success: false, error: `No pricing configured for ${product.name_en}` }

      // quote.durationDays >= requested days (rounded up or pro rata), so
      // the reservation always covers the full requested range. Availability
      // is checked by weemap_place_commerce_order under the product lock.
      const startDate = item.rentalStartDate
      const endDate = rentalEndDate(startDate, quote.durationDays)
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
  // is by construction equal to its items plus the delivery fee (the database
  // function re-checks both sums).
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
    if (zoneError) return { success: false, error: 'Failed to load delivery zone' }
    if (!zoneRow || zoneRow.is_active === false) return { success: false, error: 'Selected delivery zone is not available' }
    zone = zoneRow
  }
  const deliveryFee = resolveDeliveryFee({ fulfillmentMethod: input.fulfillmentMethod, zone })
  const deliveryFeePending = input.fulfillmentMethod === 'delivery' && zone?.fee_type === 'quote'
  const totalPrice = Math.round((subtotal + deliveryFee) * 100) / 100

  // ── Resolve canonical customer (a customer row without an order is harmless) ──
  let customer: { id: string }
  try {
    customer = await deps.findOrCreateCustomer({
      phone: input.customerPhone,
      name: input.customerName,
      email: input.customerEmail,
    })
  } catch (err) {
    console.error('[orders] customer lookup failed:', err instanceof Error ? err.message : err)
    return { success: false, error: 'Failed to create order' }
  }

  // ── One transaction: stock, order, items, reservations (migration 039) ──
  const { data: placed, error: placeError } = await db.rpc('weemap_place_commerce_order', {
    p_order: {
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
    },
    p_items: pricedItems.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId,
      item_type: item.itemType,
      name_snapshot_ar: item.nameAr,
      name_snapshot_en: item.nameEn,
      variant_snapshot: item.snapshot,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      rental_duration_days: item.rentalDurationDays ?? null,
      rental_start_date: item.rentalStartDate ?? null,
      rental_end_date: item.rentalEndDate ?? null,
      line_total: item.lineTotal,
    })),
  })
  if (placeError || !placed) {
    const message = placeError?.message ?? ''
    const failedId = message.split(':')[1]
    const nameOf = (match: (i: PricedItem) => boolean) => pricedItems.find(match)?.nameEn ?? 'an item'
    if (message.startsWith('insufficient_stock')) {
      return { success: false, error: `Insufficient stock for ${nameOf((i) => i.variantId === failedId)}` }
    }
    if (message.startsWith('rental_unavailable')) {
      return { success: false, error: `${nameOf((i) => i.productId === failedId)} is not available for the selected dates` }
    }
    console.error('[orders] weemap_place_commerce_order failed:', { code: placeError?.code, message })
    return { success: false, error: 'Failed to create order' }
  }
  const order = placed as { order_id: string; order_number: string }

  // The order is committed at this point; a CRM counter failing must not
  // turn a successful order into an error the customer retries.
  try {
    await deps.recordCustomerActivity(customer.id)
  } catch (err) {
    console.error('[orders] recordCustomerActivity failed:', err)
  }

  return {
    success: true,
    orderId: order.order_id,
    orderNumber: order.order_number,
    subtotal,
    deliveryFee,
    deliveryFeePending,
    totalPrice,
    depositTotal,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Status changes (cancel restocks, reopen re-reserves) — one transaction
// ─────────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'new' | 'contacted' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'

export interface OrderPatch {
  status?: OrderStatus
  /** Status the caller saw; a different current status is refused as stale. */
  expectedStatus?: OrderStatus
  internal_notes?: string
}

export type OrderPatchResult =
  | { ok: true; order: Record<string, unknown>; transition: 'cancelled' | 'reopened' | null; warnings: string[] }
  | {
    ok: false
    status: number
    error: string
    code?: 'stale_status' | 'invalid_transition' | 'insufficient_stock'
    warnings?: string[]
  }

/**
 * Applies an admin order update. A status change goes through
 * weemap_set_commerce_order_status (migration 039), which in one transaction
 * locks the order, refuses a stale or invalid change (including the
 * pickup/delivery split), and restocks on cancel / re-reserves on reopen
 * exactly once. A retry of an applied change is a no-op. Notes are a plain
 * write with no side effects.
 */
export async function applyOrderPatchWithClient(
  db: SupabaseClient,
  id: string,
  patch: OrderPatch,
): Promise<OrderPatchResult> {
  const { expectedStatus, status, ...fields } = patch
  let order: Record<string, unknown> | null = null
  let transition: 'cancelled' | 'reopened' | null = null

  if (status) {
    const { data, error } = await db.rpc('weemap_set_commerce_order_status', {
      p_order_id: id,
      p_expected_status: expectedStatus ?? null,
      p_status: status,
    })
    if (error) {
      const message = error.message ?? ''
      if (message === 'not_found') return { ok: false, status: 404, error: 'Order not found' }
      if (message === 'stale_status') {
        return { ok: false, status: 409, code: 'stale_status', error: 'Order status changed before it could be updated' }
      }
      if (message === 'invalid_transition') {
        return { ok: false, status: 409, code: 'invalid_transition', error: 'This status change is not allowed for this order' }
      }
      if (message.startsWith('insufficient_stock')) {
        return {
          ok: false, status: 409, code: 'insufficient_stock',
          error: 'Not enough stock to reopen this order; it was left cancelled.',
        }
      }
      console.error('[orders] status change failed:', { id, code: error.code, message })
      return { ok: false, status: 500, error: 'Failed to update order' }
    }
    order = data as Record<string, unknown>
    if (status === 'cancelled' && expectedStatus !== 'cancelled') transition = 'cancelled'
    else if (expectedStatus === 'cancelled' && status !== 'cancelled') transition = 'reopened'
  }

  if (Object.keys(fields).length) {
    const { data, error } = await db.from('commerce_orders').update(fields).eq('id', id).select().maybeSingle()
    if (error) return { ok: false, status: 500, error: 'Failed to update order' }
    if (!data) return { ok: false, status: 404, error: 'Order not found' }
    order = data
  }
  if (!order) return { ok: false, status: 400, error: 'Nothing to update' }
  return { ok: true, order, transition, warnings: [] }
}
