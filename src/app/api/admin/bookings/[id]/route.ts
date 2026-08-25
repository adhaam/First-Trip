import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  status: z.enum(['new', 'pending', 'confirmed', 'cancelled', 'completed']).optional(),
  customer_name: z.string().min(2).max(100).optional(),
  customer_phone: z.string().min(6).max(20).optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
  internal_notes: z.string().max(2000).optional(),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  num_people: z.number().int().min(1).max(50).optional(),
  total_price: z.number().min(0).optional(),
  // Manual payment tracking: remaining balance = total_price - amount_paid
  // (computed in the UI — never stored, so it can't drift).
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
  payment_channel: z.enum(['instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other']).nullable().optional(),
  payment_received_by: z.string().max(200).optional(),
  payment_date: z.string().optional(),
  payment_notes: z.string().max(1000).optional(),
  discount_value: z.number().min(0).nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  source: z.enum(['website', 'manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other']).optional(),
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
  const { customer_email, trip_date, return_date, ...rest } = validated.data
  const patch: Record<string, unknown> = { ...rest }
  if (customer_email !== undefined) patch.customer_email = customer_email || null
  if (trip_date !== undefined) patch.trip_date = trip_date || null
  if (return_date !== undefined) patch.return_date = return_date || null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', id)
    .select('*, accommodations(name_ar, name_en)')
    .single()
  if (error) {
    console.error('PATCH booking error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
  return NextResponse.json({ booking: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) {
    console.error('DELETE booking error:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
