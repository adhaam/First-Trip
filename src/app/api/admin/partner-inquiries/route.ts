import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('partner_inquiries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('GET partner_inquiries error:', error)
    return NextResponse.json({ error: 'Failed to load inquiries' }, { status: 500 })
  }
  return NextResponse.json({ inquiries: data })
}
