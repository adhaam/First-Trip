import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { hashStaffPassword, validateNewPassword } from '@/lib/staff-password'
import { STAFF_ROLES } from '@/lib/staff-policy'
import { STAFF_COLUMNS } from '@/lib/staff'

// Owner only. Disabling, a role change or a password reset revokes the
// person's sessions (session_version trigger, migration 035). The database
// refuses to remove the last active owner. Staff are disabled, never deleted,
// so the actor in history and the audit log always resolves to a name.
const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  is_active: z.boolean().optional(),
  password: z.string().optional(),
}).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }
  const { password, ...rest } = parsed.data
  const patch: Record<string, unknown> = { ...rest }
  if (password !== undefined) {
    const passwordError = validateNewPassword(password)
    if (passwordError) return NextResponse.json({ error: passwordError, code: 'weak_password' }, { status: 400 })
    patch.password_hash = await hashStaffPassword(password)
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('staff_users')
    .update(patch)
    .eq('id', id)
    .select(STAFF_COLUMNS)
    .maybeSingle()
  if (error?.code === '23514' && /owner/i.test(error.message)) {
    return NextResponse.json({ error: 'At least one active owner must remain', code: 'last_owner' }, { status: 409 })
  }
  if (error) {
    console.error('PATCH staff error:', error)
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  return NextResponse.json({ staff: data })
}
