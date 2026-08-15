import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

// ─── Seasonal pricing periods (per accommodation) ───
// GET  /api/admin/seasonal-rates?accommodation_id=...   → list (all, incl. inactive)
// POST /api/admin/seasonal-rates                        → create one period
//
// Overlap protection is enforced by the DB itself (EXCLUDE constraint in
// migration 004) — an overlapping active period fails with SQLSTATE 23P01,
// which we translate into a clear message for the dashboard.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const createSchema = z.object({
  accommodation_id: z.string().uuid(),
  name: z.string().max(120).optional().default(''),
  start_date: isoDate,
  end_date: isoDate,
  single_price: z.number().min(0).default(0),
  double_price: z.number().min(0).default(0),
  triple_price: z.number().min(0).default(0),
  is_active: z.boolean().optional().default(true),
}).refine((v) => v.end_date >= v.start_date, {
  message: 'End date must be on or after the start date',
  path: ['end_date'],
})

const OVERLAP_SQLSTATE = '23P01' // exclusion_violation

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const accommodationId = req.nextUrl.searchParams.get('accommodation_id')
  if (!accommodationId) {
    return NextResponse.json({ error: 'accommodation_id is required' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('accommodation_seasonal_rates')
    .select('*')
    .eq('accommodation_id', accommodationId)
    .order('start_date', { ascending: true })
  if (error) {
    console.error('GET seasonal rates error:', error)
    return NextResponse.json({ error: 'Failed to load seasonal rates' }, { status: 500 })
  }
  return NextResponse.json({ rates: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = createSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('accommodation_seasonal_rates')
    .insert(validated.data)
    .select()
    .single()
  if (error) {
    if (error.code === OVERLAP_SQLSTATE) {
      return NextResponse.json(
        { error: 'This period overlaps an existing active period for this accommodation. Adjust the dates or deactivate the other period first.' },
        { status: 409 },
      )
    }
    console.error('POST seasonal rate error:', error)
    return NextResponse.json({ error: 'Failed to create seasonal rate' }, { status: 500 })
  }
  return NextResponse.json({ rate: data }, { status: 201 })
}
