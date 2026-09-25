import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/admin-session'
import { getStaffSession } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Signs out on the server, not just in this browser: bumping the person's
 * session_version (migration 035) makes every token issued before now invalid
 * on its next request, so a copied cookie stops working too. This signs the
 * person out of their other devices as well — the price of having no
 * per-session table.
 */
export async function POST(req: NextRequest) {
  const staff = await getStaffSession(req)
  if (staff?.id) {
    const supabase = getSupabaseAdmin(staff)
    const { data, error } = await supabase
      .from('staff_users').select('session_version').eq('id', staff.id).maybeSingle()
    if (!error && data) {
      const { error: bumpError } = await supabase
        .from('staff_users')
        .update({ session_version: Number(data.session_version) + 1 })
        .eq('id', staff.id)
        .eq('session_version', data.session_version)
      if (bumpError) console.error('logout: session revoke failed:', bumpError.code, bumpError.message)
    }
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
