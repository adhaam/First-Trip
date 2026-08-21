import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { quoteRental, resolveDeliveryFee, sumSubtotals, type RentalPricingTier } from '@/lib/rental-pricing'
import { getTotalInventory } from '@/lib/rental-availability'

/**
 * Reusable order creation service — the single place that turns a
 * client-submitted merch/rental request into a priced `commerce_orders` +
 * `commerce_order_items` (+ `rental_reservations` for rental lines) record.
 *
 * Every total is recomputed here from DB-trusted product/variant/tier data.
 * Whatever the client sent as a price is never trusted or stored.
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
  totalPrice: number
}

export interface CreateOrderError {
  success: false
  error: string
}

export async function createCommerceOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult | CreateOrderError> {
  if (input.items.length === 0) return { success: false, error: 'No items in order' }
  const supabase = getSupabaseAdmin()

  // ── Load products + variants + rental tiers referenced by this order ──
  const productIds = Array.from(new Set(input.items.map((i) => i.productId)))
  const { data: products, error: productsError } = await supabase
    .from('commerce_products')
    .select('id, name_ar, name_en, product_type, base_price, is_active, track_inventory')
    .in('id', productIds)
  if (productsError) return { success: false, error: 'Failed to load products' }

  const productById = new Map((products || []).map((p) => [p.id, p]))
  for (const item of input.items) {
    const product = productById.get(item.productId)
    if (!product || !product.is_active) {
      return { success: false, error: `Product ${item.productId} is not available` }
    }
  }

  const variantIds = Array.from(
    new Set(input.items.map((i) => i.variantId).filter((v): v is string => Boolean(v))),
  )
  const { data: variants } = variantIds.length
    ? await supabase
        .from('commerce_product_variants')
        .select('id, product_id, price_override, inventory_quantity, is_active, option_value_ids')
        .in('id', variantIds)
    : { data: [] }
  const variantById = new Map((variants || []).map((v) => [v.id, v]))

  const rentalProductIds = input.items
    .filter((i) => productById.get(i.productId)?.product_type === 'rental')
    .map((i) => i.productId)
  const { data: tiers } = rentalProductIds.length
    ? await supabase
        .from('rental_pricing_tiers')
        .select('id, product_id, variant_id, duration_days, price, is_active')
        .in('product_id', rentalProductIds)
    : { data: [] }

  // ── Price every line item server-side, reserving inventory atomically ──
  // Sale stock is decremented (not merely checked) here via a single
  // conditional UPDATE per variant — two simultaneous orders for the last
  // unit can never both succeed. Rental availability is re-checked inside a
  // Postgres advisory lock scoped to the product/variant, so two concurrent
  // requests for overlapping dates can't both pass. If anything after this
  // point fails, every decremented variant is restocked (see catch below) —
  // see "42. INVENTORY CONCURRENCY".
  type PricedItem = {
    productId: string
    variantId: string | null
    itemType: 'sale' | 'rental'
    nameAr: string
    nameEn: string
    unitPrice: number
    quantity: number
    lineTotal: number
    rentalDurationDays?: number
    rentalStartDate?: string
    rentalEndDate?: string
  }
  const pricedItems: PricedItem[] = []
  const decrementedVariants: { variantId: string; quantity: number }[] = []
  let orderType: 'merch' | 'rental' | 'mixed' | null = null

  const restockAll = async () => {
    for (const d of decrementedVariants) {
      await supabase.rpc('restock_variant_inventory', { p_variant_id: d.variantId, p_qty: d.quantity })
    }
  }

  for (const item of input.items) {
    const product = productById.get(item.productId)!
    const variant = item.variantId ? variantById.get(item.variantId) : null
    if (item.variantId && (!variant || variant.product_id !== item.productId || !variant.is_active)) {
      await restockAll()
      return { success: false, error: `Invalid variant for product ${item.productId}` }
    }

    if (product.product_type === 'sale') {
      if (product.track_inventory && variant) {
        const { data: reserved, error: reserveError } = await supabase.rpc('decrement_variant_inventory', {
          p_variant_id: variant.id,
          p_qty: item.quantity,
        })
        if (reserveError || !reserved) {
          await restockAll()
          return { success: false, error: `Insufficient stock for ${product.name_en}` }
        }
        decrementedVariants.push({ variantId: variant.id, quantity: item.quantity })
      }
      const unitPrice = variant?.price_override != null ? Number(variant.price_override) : Number(product.base_price)
      pricedItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        itemType: 'sale',
        nameAr: product.name_ar,
        nameEn: product.name_en,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
      })
      orderType = orderType === null || orderType === 'merch' ? 'merch' : 'mixed'
    } else {
      if (!item.rentalDurationDays || !item.rentalStartDate) {
        await restockAll()
        return { success: false, error: 'Rental items require a duration and start date' }
      }
      if (item.rentalStartDate < todayIsoUTC()) {
        await restockAll()
        return { success: false, error: `${product.name_en} cannot be rented starting in the past` }
      }
      const quote = quoteRental({
        tiers: (tiers || []) as RentalPricingTier[],
        variantId: item.variantId || null,
        requestedDays: item.rentalDurationDays,
        quantity: item.quantity,
      })
      if (!quote) {
        await restockAll()
        return { success: false, error: `No pricing configured for ${product.name_en}` }
      }

      const totalInventory = await getTotalInventory(item.productId, item.variantId || null)
      const startDate = item.rentalStartDate
      const endDate = addDays(startDate, quote.durationDays)
      const { data: available, error: availError } = await supabase.rpc('check_rental_availability_locked', {
        p_product_id: item.productId,
        p_variant_id: item.variantId || null,
        p_start_date: startDate,
        p_end_date: endDate,
        p_qty: item.quantity,
        p_total_inventory: totalInventory,
        p_exclude_reservation_id: null,
      })
      if (availError || !available) {
        await restockAll()
        return { success: false, error: `${product.name_en} is not available for the selected dates` }
      }

      pricedItems.push({
        productId: item.productId,
        variantId: item.variantId || null,
        itemType: 'rental',
        nameAr: product.name_ar,
        nameEn: product.name_en,
        unitPrice: quote.unitPrice,
        quantity: item.quantity,
        lineTotal: quote.subtotal,
        rentalDurationDays: quote.durationDays,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
      })
      orderType = orderType === null || orderType === 'rental' ? 'rental' : 'mixed'
    }
  }

  const subtotal = sumSubtotals(pricedItems.map((i) => i.lineTotal))

  let zone: { fee_type: 'fixed' | 'free' | 'quote'; fixed_fee: number } | null = null
  if (input.fulfillmentMethod === 'delivery' && input.deliveryZoneId) {
    const { data: zoneRow } = await supabase
      .from('delivery_zones')
      .select('fee_type, fixed_fee')
      .eq('id', input.deliveryZoneId)
      .maybeSingle()
    zone = zoneRow
  }
  const deliveryFee = resolveDeliveryFee({ fulfillmentMethod: input.fulfillmentMethod, zone })
  const totalPrice = subtotal + deliveryFee

  // ── Resolve canonical customer ──
  const customer = await findOrCreateCustomerByPhone({
    phone: input.customerPhone,
    name: input.customerName,
    email: input.customerEmail,
  })

  // ── Create order + items (+ rental reservations) ──
  const { data: order, error: orderError } = await supabase
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
      source: input.source || 'website',
      status: 'new',
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    await restockAll()
    return { success: false, error: 'Failed to create order' }
  }

  for (const item of pricedItems) {
    const { data: orderItem, error: itemError } = await supabase
      .from('commerce_order_items')
      .insert({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        item_type: item.itemType,
        name_snapshot_ar: item.nameAr,
        name_snapshot_en: item.nameEn,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        rental_duration_days: item.rentalDurationDays || null,
        rental_start_date: item.rentalStartDate || null,
        rental_end_date: item.rentalEndDate || null,
        line_total: item.lineTotal,
      })
      .select('id')
      .single()

    if (itemError || !orderItem) continue

    if (item.itemType === 'rental' && item.rentalStartDate && item.rentalEndDate) {
      await supabase.from('rental_reservations').insert({
        order_item_id: orderItem.id,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        start_date: item.rentalStartDate,
        end_date: item.rentalEndDate,
        status: 'requested',
      })
    }
  }

  await recordCustomerActivity(customer.id)

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.order_number,
    totalPrice,
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days - 1) // duration is inclusive of the start day
  return d.toISOString().slice(0, 10)
}

/** Today's date (UTC) as YYYY-MM-DD — matches addDays()'s UTC-based arithmetic. */
function todayIsoUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
