import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { STATUSES } from '@/lib/request-workflow'

function isMissingTripRequestsTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = req.nextUrl.searchParams.get('status')
  if (status && !(STATUSES.trip_request as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
  }

  let query = getSupabaseAdmin()
    .from('trip_requests')
    .select('*, accommodations(name_ar, name_en)')
    .order('submitted_at', { ascending: false })
    .limit(200)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (isMissingTripRequestsTable(error)) {
    return NextResponse.json({ requests: [], unavailable: true })
  }
  if (error) {
    console.error('GET trip_requests error:', error)
    return NextResponse.json({ error: 'Failed to load trip requests' }, { status: 500 })
  }
  return NextResponse.json({ requests: data, unavailable: false })
}
