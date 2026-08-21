import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTotalInventory, RESERVING_RESERVATION_STATUSES } from '@/lib/rental-availability'

// Only 'confirmed' | 'active' | 'late' reserve inventory — see
// RESERVING_RESERVATION_STATUSES in src/lib/rental-availability.ts, the
// single source of truth this status vocabulary must stay in sync with.
const updateSchema = z.object({
  status: z.enum(['requested', 'contacted', 'confirmed', 'active', 'returned', 'completed', 'cancelled', 'late']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

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

  // Moving a reservation INTO a reserving status is the moment inventory is
  // actually consumed — re-validate availability atomically (excluding this
  // reservation itself) so two concurrent admin confirmations can never both
  // push a product over its owned inventory. See "25. RENTAL OPERATIONS
  // VIEW" and "42. INVENTORY CONCURRENCY".
  if (validated.data.status && (RESERVING_RESERVATION_STATUSES as readonly string[]).includes(validated.data.status)) {
    const { data: reservation } = await supabase
      .from('rental_reservations')
      .select('product_id, variant_id, start_date, end_date, quantity, status')
      .eq('id', id)
      .single()
    if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })

    const wasAlreadyReserving = (RESERVING_RESERVATION_STATUSES as readonly string[]).includes(reservation.status)
    if (!wasAlreadyReserving) {
      const startDate = validated.data.start_date || reservation.start_date
      const endDate = validated.data.end_date || reservation.end_date
      const totalInventory = await getTotalInventory(reservation.product_id, reservation.variant_id)
      const { data: available, error: availError } = await supabase.rpc('check_rental_availability_locked', {
        p_product_id: reservation.product_id,
        p_variant_id: reservation.variant_id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_qty: reservation.quantity,
        p_total_inventory: totalInventory,
        p_exclude_reservation_id: id,
      })
      if (availError || !available) {
        return NextResponse.json(
          { error: 'Not enough units are available for these dates — another reservation already covers them.' },
          { status: 409 },
        )
      }
    }
  }

  const { data, error } = await supabase
    .from('rental_reservations')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  return NextResponse.json({ reservation: data })
}
