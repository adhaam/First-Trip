import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { editionAdminSchema } from '@/lib/editions'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('editions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('GET editions error:', error)
    return NextResponse.json({ error: 'Failed to load editions' }, { status: 500 })
  }
  return NextResponse.json({ editions: data })
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const validated = editionAdminSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase.from('editions').insert(validated.data).select().single()
  if (error) {
    console.error('POST edition error:', error)
    return NextResponse.json({ error: 'Failed to create Edition (slug may already exist)' }, { status: 500 })
  }
  return NextResponse.json({ edition: data }, { status: 201 })
}
