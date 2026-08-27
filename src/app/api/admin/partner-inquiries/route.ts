import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
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
