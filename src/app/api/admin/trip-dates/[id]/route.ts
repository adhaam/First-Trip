import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const dateUpdateSchema = z.object({
  date: z.string().min(1).optional(),
  day_of_week: z.enum(['sunday', 'thursday']).optional(),
  duration: z.union([z.literal(4), z.literal(5)]).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = dateUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { date, ...rest } = validated.data
  const updatePayload: Record<string, unknown> = { ...rest }
  if (date) updatePayload.trip_date = date

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('trip_dates').update(updatePayload).eq('id', id).select().single()
  if (error) {
    console.error('PATCH trip_date error:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This date already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update date' }, { status: 500 })
  }
  return NextResponse.json({
    date: { id: data.id, date: data.trip_date, day_of_week: data.day_of_week, duration: data.duration, is_active: data.is_active },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('trip_dates').delete().eq('id', id)
  if (error) {
    console.error('DELETE trip_date error:', error)
    return NextResponse.json({ error: 'Failed to delete date' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
