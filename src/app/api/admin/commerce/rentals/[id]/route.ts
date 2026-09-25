import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { STATUSES, allowedNextStatuses, canTransition } from '@/lib/request-workflow'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Invalid date')

const updateSchema = z.object({
  status: z.enum(STATUSES.rental_reservation).optional(),
  /** The status the operator's screen showed; a mismatch is refused as stale. */
  expected_status: z.enum(STATUSES.rental_reservation).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
})

type ReservationStatus = (typeof STATUSES.rental_reservation)[number]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { status, start_date: startDate, end_date: endDate, expected_status: callerExpected } = validated.data
  const supabase = getSupabaseAdmin(gate.staff)

  const { data: current, error: readError } = await supabase
    .from('rental_reservations').select('status').eq('id', id).maybeSingle()
  if (readError) {
    console.error('PATCH rental reservation read error:', readError)
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  }
  if (!current) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  const from = current.status as ReservationStatus
  if (callerExpected && callerExpected !== from) {
    return NextResponse.json(
      { error: 'Reservation status changed by another admin', code: 'stale_status' },
      { status: 409 },
    )
  }
  if (status && !canTransition('rental_reservation', from, status)) {
    return NextResponse.json(
      { error: 'Invalid status transition', code: 'invalid_transition', allowed: allowedNextStatuses('rental_reservation', from) },
      { status: 409 },
    )
  }

  // One transaction (migration 039): row lock, stale check, and — whenever the
  // result holds stock (confirmed / active / late) and the status or dates
  // changed — an availability check under the product lock, so two operators
  // can never both confirm the last unit.
  const { data, error } = await supabase.rpc('weemap_update_rental_reservation', {
    p_id: id,
    p_expected_status: from,
    p_status: status ?? null,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  })
  if (error) {
    const message = error.message ?? ''
    if (message === 'stale_status') {
      return NextResponse.json({ error: 'Reservation status changed by another admin', code: 'stale_status' }, { status: 409 })
    }
    if (message.startsWith('rental_unavailable')) {
      return NextResponse.json(
        { error: 'Not enough units are available for these dates — another reservation already covers them.', code: 'rental_unavailable' },
        { status: 409 },
      )
    }
    if (message === 'invalid_rental_dates') {
      return NextResponse.json({ error: 'The end date must be on or after the start date', code: 'invalid' }, { status: 400 })
    }
    if (message === 'not_found') return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    console.error('PATCH rental reservation error:', { code: error.code, message })
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 })
  }
  return NextResponse.json({ reservation: data })
}
