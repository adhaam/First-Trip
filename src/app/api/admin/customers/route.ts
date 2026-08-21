import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  let query = supabase
    .from('customers')
    .select('*')
    .is('merged_into', null)
    .order('last_booking_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (q) {
    // PostgREST's .or() mini-language treats ',', '(' and ')' as structural
    // (condition separators / grouping) — a pasted phone like "(010) 123..."
    // or a name containing a comma would otherwise corrupt the filter and
    // 500 the whole search. Strip them from the ilike terms; normalizePhone
    // already works on digits only, so phone matching is unaffected.
    const safe = q.replace(/[,()]/g, ' ').trim()
    const normalized = normalizePhone(q)
    const orParts: string[] = []
    if (safe) orParts.push(`name.ilike.%${safe}%`, `phone.ilike.%${safe}%`)
    if (normalized) orParts.push(`normalized_phone.eq.${normalized}`)
    if (orParts.length > 0) query = query.or(orParts.join(','))
  }

  const { data, error } = await query
  if (error) {
    console.error('GET customers error:', error)
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 })
  }
  return NextResponse.json({ customers: data })
}
