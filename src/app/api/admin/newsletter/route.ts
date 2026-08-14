import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('GET newsletter subscribers error:', error)
    return NextResponse.json({ error: 'Failed to load subscribers' }, { status: 500 })
  }
  return NextResponse.json({ subscribers: data })
}
