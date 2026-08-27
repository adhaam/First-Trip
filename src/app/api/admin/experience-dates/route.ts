import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const dateSchema = z.object({
  experience_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_spots: z.number().int().min(0).optional().default(10),
  status: z.enum(['open', 'cancelled']).optional().default('open'),
  is_open: z.boolean().optional().default(true),
  price_override: z.number().min(0).nullable().optional(),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const experienceId = req.nextUrl.searchParams.get('experience_id')
  const supabase = getSupabaseAdmin()
  let query = supabase.from('experience_dates').select('*').order('start_date', { ascending: true })
  if (experienceId) query = query.eq('experience_id', experienceId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to load dates' }, { status: 500 })
  return NextResponse.json({ dates: data })
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
  if (validated.data.end_date < validated.data.start_date) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('experience_dates').insert(validated.data).select().single()
  if (error) return NextResponse.json({ error: 'Failed to create date' }, { status: 500 })
  return NextResponse.json({ date: data }, { status: 201 })
}
