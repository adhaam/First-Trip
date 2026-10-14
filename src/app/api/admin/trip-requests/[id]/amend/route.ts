import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTripBuilderCatalog } from '@/lib/trip-builder/catalog.server'
import { amendRequestSummary, amendmentBlocker, applyBodySchema } from '@/lib/trip-requests/amend'
import {
  amendErrorResponse,
  applyAmendment,
  invalidInputResponse,
  isAmendError,
  loadAmendableRow,
} from '@/lib/trip-requests/amend.server'

// Admin "Edit / Revise booking" for a Build-Your-Trip journey (migration 051). The trip_requests row
// stays the one journey and sole payment owner: GET loads what the screen needs, POST re-prices the
// whole journey with the quote engine and amends it atomically (weemap_amend_trip_request). Totals
// are never accepted from the client.

async function validId(params: Promise<{ id: string }>) {
  const { id } = await params
  return z.string().uuid().safeParse(id).success ? id : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const id = await validId(params)
  if (!id) return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })

  const loaded = await loadAmendableRow(getSupabaseAdmin(gate.staff), id)
  if (isAmendError(loaded)) return amendErrorResponse(loaded)
  const { row, hasPayments } = loaded

  try {
    const catalog = await getTripBuilderCatalog()
    return NextResponse.json({
      request: amendRequestSummary(row),
      blocker: amendmentBlocker({ status: row.status, amount_paid: row.amount_paid, has_payments: hasPayments }),
      catalog,
    })
  } catch (error) {
    console.error('amend: catalog load error:', error)
    return NextResponse.json({ error: 'Failed to load the catalog', code: 'CATALOG_FAILED' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const id = await validId(params)
  if (!id) return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const validated = applyBodySchema.safeParse(body)
  if (!validated.success) {
    return invalidInputResponse(validated.error)
  }

  const result = await applyAmendment(
    id,
    validated.data.journey,
    validated.data.expected_updated_at,
    validated.data.reason,
    getSupabaseAdmin(gate.staff),
  )
  if (!result.ok) return amendErrorResponse(result)
  return NextResponse.json(result.result)
}
