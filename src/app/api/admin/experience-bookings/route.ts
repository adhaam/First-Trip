import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_bookings')
    .select('*, experiences(title_ar, title_en)')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('GET experience_bookings error:', error)
    return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 })
  }
  return NextResponse.json({ requests: data })
}
