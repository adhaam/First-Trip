import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { mapRpcError } from '@/lib/ops/rpc-errors'

// Turns a Trip Builder request whose availability is confirmed into the
// concrete bookings operations fulfil (weemap_convert_trip_request, migration
// 036). Prices come from the request's frozen quote snapshot; the request row
// stays the untouched record of what the customer asked for. Safe to retry:
// a converted request returns the bookings it already produced.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin(gate.staff).rpc('weemap_convert_trip_request', { p_request_id: id })
  if (error) {
    const mapped = mapRpcError(error)
    if (mapped) return NextResponse.json({ error: mapped.code, code: mapped.code }, { status: mapped.status })
    console.error('convert trip request error:', error)
    return NextResponse.json({ error: 'Failed to convert trip request' }, { status: 500 })
  }
  return NextResponse.json(data)
}
