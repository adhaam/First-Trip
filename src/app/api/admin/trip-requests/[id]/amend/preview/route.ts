import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { previewBodySchema } from '@/lib/trip-requests/amend'
import { amendErrorResponse, invalidInputResponse, previewAmendment } from '@/lib/trip-requests/amend.server'

// Re-prices a proposed journey against the stored request with the authoritative quote engine and
// returns the original-vs-revised comparison. Writes nothing.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const validated = previewBodySchema.safeParse(body)
  if (!validated.success) {
    return invalidInputResponse(validated.error)
  }

  const result = await previewAmendment(id, validated.data.journey, getSupabaseAdmin(gate.staff))
  if (!result.ok) return amendErrorResponse(result)
  return NextResponse.json({
    original: result.original,
    revised: result.revised,
    difference: result.difference,
    availability_reset: result.availability_reset,
    blocker: result.blocker,
  })
}
