import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('GET newsletter subscribers error:', error)
      const missingTable =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message?.toLowerCase().includes('newsletter_subscribers') &&
          error.message.toLowerCase().includes('not find')

      if (missingTable) {
        return NextResponse.json({ subscribers: [], configured: false })
      }

      return NextResponse.json({ error: 'Newsletter management is temporarily unavailable' }, { status: 503 })
    }

    return NextResponse.json({ subscribers: data || [], configured: true })
  } catch (error) {
    console.error('GET newsletter subscribers unexpected error:', error)
    return NextResponse.json({ error: 'Newsletter management is temporarily unavailable' }, { status: 503 })
  }
}
