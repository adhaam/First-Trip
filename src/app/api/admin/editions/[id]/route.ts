import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { editionAdminUpdateSchema } from '@/lib/editions'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase.from('editions').select('*').eq('id', id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Edition not found' }, { status: 404 })
  return NextResponse.json({ edition: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = editionAdminUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('editions')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('PATCH edition error:', error)
    return NextResponse.json({ error: 'Failed to update Edition' }, { status: 500 })
  }
  return NextResponse.json({ edition: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  // edition_requests.edition_id is ON DELETE RESTRICT — an Edition with
  // existing requests cannot be deleted outright; hide it (published=false,
  // status HIDDEN) instead of leaving a confusing FK error to the caller.
  const { count } = await supabase
    .from('edition_requests')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', id)
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This Edition has requests on file and cannot be deleted — hide it instead (status HIDDEN).' },
      { status: 409 },
    )
  }
  const { error } = await supabase.from('editions').delete().eq('id', id)
  if (error) {
    console.error('DELETE edition error:', error)
    return NextResponse.json({ error: 'Failed to delete Edition' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
