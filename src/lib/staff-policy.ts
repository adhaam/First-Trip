/**
 * Who may do what in the Operations Center. Pure and edge-safe so it is shared
 * by the API guard (src/lib/admin-auth.ts), the dashboard navigation and tests.
 *
 * Deliberately small (migration 035):
 *   owner       everything, including staff management
 *   admin       everything except staff management
 *   operations  read everything except staff; write only operational work
 *               (requests, bookings, payments, customers, orders, rentals);
 *               never delete; catalogue, pricing, settings and transport
 *               configuration are read-only.
 * Unknown admin routes default to admin-only writes, so a new route is never
 * accidentally writable by the operations role.
 */
export const STAFF_ROLES = ['owner', 'admin', 'operations'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

/** Owner only, for every method. */
const OWNER_ONLY_PREFIXES = ['/api/admin/staff']

/** Readable by owner/admin only. */
const MANAGER_READ_PREFIXES = ['/api/admin/audit']

/** Operations may POST/PATCH/PUT here (never DELETE). */
const OPERATIONS_WRITE_PREFIXES = [
  '/api/admin/ops',
  '/api/admin/trip-requests',
  '/api/admin/bookings',
  '/api/admin/trip-bookings',
  '/api/admin/experience-bookings',
  '/api/admin/commerce/orders',
  '/api/admin/commerce/rentals',
  '/api/admin/payments',
  '/api/admin/customers',
  '/api/admin/partner-inquiries',
  '/api/admin/import-booking',
  '/api/admin/quote',
  '/api/admin/me',
]

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value)
}

export function canAccess(role: StaffRole, method: string, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  const verb = method.toUpperCase()

  if (matches(path, OWNER_ONLY_PREFIXES)) return role === 'owner'
  if (role === 'owner' || role === 'admin') return true

  // operations
  if (matches(path, MANAGER_READ_PREFIXES)) return false
  if (READ_METHODS.has(verb)) return true
  if (verb === 'DELETE') return false
  return matches(path, OPERATIONS_WRITE_PREFIXES)
}

/** Dashboard sections an operations user can change (the UI hides edit controls elsewhere). */
export function canManageCatalogue(role: StaffRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageStaff(role: StaffRole): boolean {
  return role === 'owner'
}
