import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTotalInventory, RESERVING_RESERVATION_STATUSES } from '@/lib/rental-availability'
import { STATUSES } from '@/lib/request-workflow'
import { updateAdminStatus } from '@/lib/admin-status-update'

const updateSchema = z.object({
  status: z.enum(STATUSES.rental_reservation).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// Sentinel distinguishing an inventory conflict (409, its own message) from a
// genuine persistence error (500) inside updateAdminStatus's generic 'error' kind.
const INVENTORY_CONFLICT = Symbol('inventory_conflict')

type ReservationRow = {
  product_id: string
  variant_id: string | null
  start_date: string
  end_date: string
  quantity: number
  status: string
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const patch: Record<string, unknown> = { ...validated.data }

  // Stashed by readStatus below so the update step can re-run the inventory
  // check without a second read of the row.
  let reservationRow: ReservationRow | null = null

  const result = await updateAdminStatus({
    readStatus: async (reservationId) => {
      const { data, error } = await supabase
        .from('rental_reservations')
        .select('product_id, variant_id, start_date, end_date, quantity, status')
        .eq('id', reservationId)
        .maybeSingle()
      reservationRow = data
      return { data, error }
    },
    update: async (reservationId, updatePatch, currentStatus) => {
      const nextStatus = updatePatch.status as string | undefined

      // Moving a reservation INTO a reserving status is the moment inventory is
      // actually consumed — re-validate availability atomically (excluding this
      // reservation itself) so two concurrent admin confirmations can never both
      // push a product over its owned inventory. See "25. RENTAL OPERATIONS
      // VIEW" and "42. INVENTORY CONCURRENCY".
      if (nextStatus && (RESERVING_RESERVATION_STATUSES as readonly string[]).includes(nextStatus) && reservationRow) {
        const wasAlreadyReserving = (RESERVING_RESERVATION_STATUSES as readonly string[]).includes(reservationRow.status)
        if (!wasAlreadyReserving) {
          const startDate = (updatePatch.start_date as string | undefined) || reservationRow.start_date
          const endDate = (updatePatch.end_date as string | undefined) || reservationRow.end_date
          const totalInventory = await getTotalInventory(reservationRow.product_id, reservationRow.variant_id)
          const { data: available, error: availError } = await supabase.rpc('check_rental_availability_locked', {
            p_product_id: reservationRow.product_id,
            p_variant_id: reservationRow.variant_id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_qty: reservationRow.quantity,
            p_total_inventory: totalInventory,
            p_exclude_reservation_id: reservationId,
          })
          if (availError || !available) {
            return { data: null, error: INVENTORY_CONFLICT }
          }
        }
      }

      let query = supabase.from('rental_reservations').update(updatePatch).eq('id', reservationId)
      if (currentStatus !== undefined) query = query.eq('status', currentStatus)
      return query.select().maybeSingle()
    },
  }, 'rental_reservation', id, patch)

  if (result.kind === 'invalid_transition') {
    return NextResponse.json({ error: 'Invalid status transition', code: result.kind, allowed: result.allowed }, { status: 409 })
  }
  if (result.kind === 'stale_status') {
    return NextResponse.json({ error: 'Reservation status changed by another admin', code: result.kind }, { status: 409 })
  }
  if (result.kind === 'not_found') return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  if (result.kind === 'error') {
    if (result.error === INVENTORY_CONFLICT) {
      return NextResponse.json(
        { error: 'Not enough units are available for these dates — another reservation already covers them.' },
        { status: 409 },
      )
    }
    console.error('PATCH rental reservation error:', result.error)
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  }
  return NextResponse.json({ reservation: result.data })
}
