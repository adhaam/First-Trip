import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

// Read-only list for the admin dashboard's Edition requests panel — writes
// happen only via PATCH status updates, added when that UI lands.
export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('edition_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('GET edition_requests error:', error)
    return NextResponse.json({ error: 'Failed to load Edition requests' }, { status: 500 })
  }
  return NextResponse.json({ requests: data })
}
