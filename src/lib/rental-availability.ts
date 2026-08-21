import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Reusable rental availability service.
 *
 * A new customer submission is a *request*, not automatically a confirmed
 * rental. Only statuses in RESERVING_STATUSES consume confirmed inventory —
 * this is the single source of truth other code should import instead of
 * re-deriving the same list.
 */
export const RESERVING_RESERVATION_STATUSES = ['confirmed', 'active', 'late'] as const
export type ReservingStatus = (typeof RESERVING_RESERVATION_STATUSES)[number]

export interface AvailabilityCheckInput {
  productId: string
  variantId?: string | null
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  /** Total owned inventory for this product/variant (admin-configured). */
  totalInventory: number
  /** Units requested for this new reservation. */
  requestedQuantity: number
  /** Exclude a reservation id from the overlap count (for edits). */
  excludeReservationId?: string
}

export interface AvailabilityResult {
  available: boolean
  totalInventory: number
  reservedByConfirmed: number
  blockedByMaintenance: number
  remainingAvailable: number
  requestedQuantity: number
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/**
 * Checks whether `requestedQuantity` units of a product/variant are
 * available for the given date range, accounting for:
 *   - other reservations whose status counts as "reserving" (confirmed/active/late)
 *   - admin-created availability blocks (maintenance, damage, owner use, etc.)
 *
 * Cancelled/unconfirmed ('requested', 'contacted', 'returned', 'completed',
 * 'cancelled') reservations never reduce availability.
 */
export async function checkRentalAvailability(
  input: AvailabilityCheckInput,
): Promise<AvailabilityResult> {
  const supabase = getSupabaseAdmin()

  let reservationsQuery = supabase
    .from('rental_reservations')
    .select('id, quantity, start_date, end_date, status, variant_id')
    .eq('product_id', input.productId)
    .in('status', RESERVING_RESERVATION_STATUSES as unknown as string[])

  if (input.variantId) {
    reservationsQuery = reservationsQuery.eq('variant_id', input.variantId)
  } else {
    reservationsQuery = reservationsQuery.is('variant_id', null)
  }

  const { data: reservations } = await reservationsQuery

  const reservedByConfirmed = (reservations || [])
    .filter((r) => r.id !== input.excludeReservationId)
    .filter((r) => rangesOverlap(input.startDate, input.endDate, r.start_date, r.end_date))
    .reduce((sum, r) => sum + Number(r.quantity), 0)

  let blocksQuery = supabase
    .from('rental_availability_blocks')
    .select('quantity, start_date, end_date, variant_id')
    .eq('product_id', input.productId)

  if (input.variantId) {
    blocksQuery = blocksQuery.eq('variant_id', input.variantId)
  } else {
    blocksQuery = blocksQuery.is('variant_id', null)
  }

  const { data: blocks } = await blocksQuery

  const blockedByMaintenance = (blocks || [])
    .filter((b) => rangesOverlap(input.startDate, input.endDate, b.start_date, b.end_date))
    .reduce((sum, b) => sum + Number(b.quantity), 0)

  const remainingAvailable = Math.max(
    0,
    input.totalInventory - reservedByConfirmed - blockedByMaintenance,
  )

  return {
    available: remainingAvailable >= input.requestedQuantity,
    totalInventory: input.totalInventory,
    reservedByConfirmed,
    blockedByMaintenance,
    remainingAvailable,
    requestedQuantity: input.requestedQuantity,
  }
}

/** Total owned inventory for a product/variant, summed from variant rows
 *  when no specific variant is given (product-level availability). */
export async function getTotalInventory(
  productId: string,
  variantId?: string | null,
): Promise<number> {
  const supabase = getSupabaseAdmin()
  if (variantId) {
    const { data } = await supabase
      .from('commerce_product_variants')
      .select('inventory_quantity')
      .eq('id', variantId)
      .maybeSingle()
    return Number(data?.inventory_quantity) || 0
  }
  const { data } = await supabase
    .from('commerce_product_variants')
    .select('inventory_quantity')
    .eq('product_id', productId)
  return (data || []).reduce((sum, v) => sum + Number(v.inventory_quantity), 0)
}
