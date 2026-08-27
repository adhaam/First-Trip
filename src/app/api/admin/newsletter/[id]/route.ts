import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Toggle a subscriber's `unsubscribed` flag from the admin panel. Mirrors the
 * GET route's defensive handling for a not-yet-configured newsletter table
 * (Postgres "undefined table" 42P01 / PostgREST schema-cache 205) so a
 * missing table degrades to a friendly error instead of a 500.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.unsubscribed !== 'boolean') {
    return NextResponse.json({ error: '"unsubscribed" must be a boolean' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .update({ unsubscribed: body.unsubscribed })
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('PATCH newsletter subscriber error:', error)
      const missingTable =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        (error.message?.toLowerCase().includes('newsletter_subscribers') &&
          error.message.toLowerCase().includes('not find'))

      if (missingTable) {
        return NextResponse.json({ error: 'Newsletter management is not configured yet' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Newsletter management is temporarily unavailable' }, { status: 503 })
    }

    if (!data) return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
    return NextResponse.json({ subscriber: data })
  } catch (error) {
    console.error('PATCH newsletter subscriber unexpected error:', error)
    return NextResponse.json({ error: 'Newsletter management is temporarily unavailable' }, { status: 503 })
  }
}
