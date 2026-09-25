import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { exceptionUpdateSchema } from '@/lib/transport/admin-validation'
import { invalidResponse, transportErrorResponse } from '@/lib/transport/admin.server'

// Date, kind and direction identify an exception. To move one, remove it and
// add a new one, so the audit log shows both steps.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const parsed = exceptionUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())

  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('transport_date_exceptions').update(parsed.data).eq('id', id).select('*').maybeSingle()
  if (error) return transportErrorResponse(error, 'PATCH transport exception')
  if (!data) return NextResponse.json({ error: 'Exception not found' }, { status: 404 })
  return NextResponse.json({ exception: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const { error } = await getSupabaseAdmin(gate.staff).from('transport_date_exceptions').delete().eq('id', id)
  if (error) return transportErrorResponse(error, 'DELETE transport exception')
  return NextResponse.json({ success: true })
}
