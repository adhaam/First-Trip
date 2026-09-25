import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_spots: z.number().int().min(0).optional(),
  status: z.enum(['open', 'cancelled']).optional(),
  is_open: z.boolean().optional(),
  price_override: z.number().min(0).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('experience_dates')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update date' }, { status: 500 })
  return NextResponse.json({ date: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { error } = await supabase.from('experience_dates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete date' }, { status: 500 })
  return NextResponse.json({ success: true })
}
