import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const dateSchema = z.object({
  date: z.string().min(1), // ISO date, e.g. 2026-08-16
  day_of_week: z.enum(['sunday', 'thursday']),
  duration: z.union([z.literal(4), z.literal(5)]),
  is_active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_dates')
    .select('*')
    .order('trip_date', { ascending: true })
  if (error) {
    console.error('GET trip_dates error:', error)
    return NextResponse.json({ error: 'Failed to load dates' }, { status: 500 })
  }
  const dates = (data ?? []).map((d) => ({
    id: d.id,
    date: d.trip_date,
    day_of_week: d.day_of_week,
    duration: d.duration,
    is_active: d.is_active,
  }))
  return NextResponse.json({ dates })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = dateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_dates')
    .insert({
      trip_date: validated.data.date,
      day_of_week: validated.data.day_of_week,
      duration: validated.data.duration,
      is_active: validated.data.is_active,
    })
    .select()
    .single()
  if (error) {
    console.error('POST trip_date error:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This date already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create date' }, { status: 500 })
  }
  return NextResponse.json({
    date: { id: data.id, date: data.trip_date, day_of_week: data.day_of_week, duration: data.duration, is_active: data.is_active },
  }, { status: 201 })
}
