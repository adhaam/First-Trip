import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport'
import { exceptionCreateSchema } from '@/lib/transport/admin-validation'
import { invalidResponse, transportErrorResponse } from '@/lib/transport/admin.server'

/** A blackout (closed) or extra departure on one date. Blackout wins over extra (migration 029). */
export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const parsed = exceptionCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())
  if (parsed.data.service_date < todayInCairo()) {
    return invalidResponse({ fieldErrors: { service_date: ['Date is in the past'] } })
  }

  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('transport_date_exceptions')
    .insert({ ...parsed.data, origin_governorate_code: parsed.data.origin_governorate_code ?? null })
    .select('*')
    .single()
  if (error) return transportErrorResponse(error, 'POST transport exception')
  return NextResponse.json({ exception: data }, { status: 201 })
}
