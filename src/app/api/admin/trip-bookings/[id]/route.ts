import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  status: z.enum(['new', 'contacted', 'confirmed', 'completed', 'cancelled']).optional(),
  final_price: z.number().min(0).nullable().optional(),
  internal_notes: z.string().max(2000).optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).nullable().optional(),
  payment_channel: z.enum(['instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other']).nullable().optional(),
  payment_received_by: z.string().max(200).optional(),
  payment_notes: z.string().max(1000).optional(),
  discount_value: z.number().min(0).nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
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
  const { data, error } = await supabase
    .from('trip_bookings')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('PATCH trip_booking error:', error)
    return NextResponse.json({ error: 'Failed to update trip booking' }, { status: 500 })
  }
  return NextResponse.json({ tripBooking: data })
}
