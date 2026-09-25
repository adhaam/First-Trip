import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { hashStaffPassword, validateNewPassword, verifyStaffPassword } from '@/lib/staff-password'
import { canManageCatalogue, canManageStaff } from '@/lib/staff-policy'

/** Who is signed in and what the dashboard may offer them (the API still enforces). */
export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { staff } = gate
  return NextResponse.json({
    staff: {
      id: staff.id,
      email: staff.email,
      display_name: staff.displayName,
      role: staff.role,
      legacy: staff.legacy,
    },
    capabilities: {
      manageCatalogue: canManageCatalogue(staff.role),
      manageStaff: canManageStaff(staff.role),
    },
  })
}

const passwordSchema = z.object({ current_password: z.string().min(1), new_password: z.string() }).strict()

/** Change your own password. Revokes your other sessions; you sign in again. */
export async function PATCH(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  if (!gate.staff.id) {
    return NextResponse.json({ error: 'The shared legacy login has no personal password', code: 'legacy' }, { status: 400 })
  }
  const parsed = passwordSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const weak = validateNewPassword(parsed.data.new_password)
  if (weak) return NextResponse.json({ error: weak, code: 'weak_password' }, { status: 400 })

  const supabase = getSupabaseAdmin(gate.staff)
  const { data } = await supabase.from('staff_users').select('password_hash').eq('id', gate.staff.id).maybeSingle()
  if (!data || !(await verifyStaffPassword(parsed.data.current_password, data.password_hash))) {
    return NextResponse.json({ error: 'Current password is incorrect', code: 'invalid_credentials' }, { status: 400 })
  }
  const { error } = await supabase
    .from('staff_users')
    .update({ password_hash: await hashStaffPassword(parsed.data.new_password) })
    .eq('id', gate.staff.id)
  if (error) {
    console.error('PATCH me password error:', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
  return NextResponse.json({ success: true, reauthenticate: true })
}
