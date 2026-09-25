import 'server-only'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from './supabase'
import { ADMIN_COOKIE, verifyAdminSessionToken } from './admin-session'
import { canAccess, isStaffRole, type StaffRole } from './staff-policy'

// ─── Operations Center authorisation (server side, every admin API call) ───
//
// Model (migration 035): each person has a staff_users row with a role. A
// signed session cookie names the person and the session_version it was
// issued for; this guard re-reads the row on every call, so disabling someone,
// changing their role or password takes effect on their next request.
//
// Transition from the pre-M3 shared password (ADMIN_PASSWORD): a 'legacy'
// session is honoured ONLY while no active owner account exists (or before
// migration 035 is applied). It exists to let the first owner be created;
// the moment an owner exists, every legacy session stops working and the
// shared password can no longer sign in. See docs/m3/OPERATIONS.md.

export { ADMIN_COOKIE } from './admin-session'

export type StaffSession = {
  /** staff_users.id, or null for the legacy shared-password session. */
  id: string | null
  /** Value recorded as the actor in history / audit (weemap_current_actor). */
  actor: string
  email: string | null
  displayName: string
  role: StaffRole
  legacy: boolean
}

type GuardRequest = {
  cookies: { get(name: string): { value: string } | undefined }
  method?: string
  url?: string
  nextUrl?: { pathname: string }
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Resolves the signed-in person from the cookie, or null. Does not check route permissions. */
export async function getStaffSession(req: Pick<GuardRequest, 'cookies'>): Promise<StaffSession | null> {
  const claims = await verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value)
  if (!claims) return null
  const supabase = getSupabaseAdmin()

  if (claims.sid === 'legacy') {
    const { count, error } = await supabase
      .from('staff_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'owner')
      .eq('is_active', true)
    if (error && !isMissingTable(error)) {
      console.error('staff owner lookup failed:', error)
      return null
    }
    if (!error && (count ?? 0) > 0) return null
    return {
      id: null, actor: 'legacy-admin', email: null, displayName: 'Shared admin', role: 'owner', legacy: true,
    }
  }

  if (!UUID_RE.test(claims.sid)) return null
  const { data, error } = await supabase
    .from('staff_users')
    .select('id, email, display_name, role, is_active, session_version')
    .eq('id', claims.sid)
    .maybeSingle()
  if (error) {
    if (!isMissingTable(error)) console.error('staff session lookup failed:', error)
    return null
  }
  if (!data || !data.is_active || data.session_version !== claims.ver || !isStaffRole(data.role)) return null
  return {
    id: data.id,
    actor: `staff:${data.id}`,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    legacy: false,
  }
}

function requestPath(req: GuardRequest): string {
  if (req.nextUrl?.pathname) return req.nextUrl.pathname
  if (req.url) {
    try {
      return new URL(req.url).pathname
    } catch {
      return ''
    }
  }
  return ''
}

export type StaffGate =
  | { ok: true; staff: StaffSession }
  | { ok: false; response: NextResponse }

/**
 * The admin API guard: authenticated person + role permission for this
 * method and path (src/lib/staff-policy.ts). 401 when not signed in (or access
 * revoked), 403 when signed in without permission.
 */
export async function requireStaff(req: GuardRequest): Promise<StaffGate> {
  const staff = await getStaffSession(req)
  if (!staff) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const path = requestPath(req)
  if (!path || !canAccess(staff.role, req.method ?? 'GET', path)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'forbidden', role: staff.role }, { status: 403 }),
    }
  }
  return { ok: true, staff }
}

/** Boolean-style guard kept for call sites that only need yes/no. Same checks as requireStaff. */
export async function requireAdmin(req: GuardRequest): Promise<StaffSession | null> {
  const gate = await requireStaff(req)
  return gate.ok ? gate.staff : null
}
