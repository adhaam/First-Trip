import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { hashStaffPassword, validateNewPassword } from '@/lib/staff-password'
import { STAFF_ROLES } from '@/lib/staff-policy'
import { STAFF_COLUMNS } from '@/lib/staff'

// Owner only (src/lib/staff-policy.ts). password_hash never leaves the server.
const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  display_name: z.string().trim().min(1).max(100),
  role: z.enum(STAFF_ROLES),
  password: z.string(),
}).strict()

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('staff_users')
    .select(STAFF_COLUMNS)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('GET staff error:', error)
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 })
  }
  return NextResponse.json({ staff: data })
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }
  const passwordError = validateNewPassword(parsed.data.password)
  if (passwordError) return NextResponse.json({ error: passwordError, code: 'weak_password' }, { status: 400 })

  const { password, ...rest } = parsed.data
  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('staff_users')
    .insert({ ...rest, password_hash: await hashStaffPassword(password), created_by: gate.staff.id })
    .select(STAFF_COLUMNS)
    .single()
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'A staff member with this email already exists', code: 'duplicate_email' }, { status: 409 })
  }
  if (error) {
    console.error('POST staff error:', error)
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 })
  }
  return NextResponse.json({ staff: data }, { status: 201 })
}
