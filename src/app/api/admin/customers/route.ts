import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('last_booking_at', { ascending: false, nullsFirst: false })
    .limit(200)
  if (error) {
    console.error('GET customers error:', error)
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 })
  }
  return NextResponse.json({ customers: data })
}
