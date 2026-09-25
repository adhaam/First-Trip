import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
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
