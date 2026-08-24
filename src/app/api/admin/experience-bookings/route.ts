import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Bookings for the admin table. Optional `?experience_id=` / `?date_id=` /
 * `?status=` filters; newest first. CSV export happens client-side from this
 * same payload so the exported rows always match what's on screen.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const experienceId = url.searchParams.get('experience_id')
  const dateId = url.searchParams.get('date_id')
  const status = url.searchParams.get('status')

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('experience_bookings')
    .select('*, experiences(title_ar, title_en, slug), experience_dates(start_date, end_date, total_spots)')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (experienceId) query = query.eq('experience_id', experienceId)
  if (dateId) query = query.eq('experience_date_id', dateId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('GET experience_bookings error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
  return NextResponse.json({ bookings: data ?? [] })
}
