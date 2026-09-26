// Dashboard deep links. The Operations Center is one client page
// (src/app/[locale]/admin/dashboard/page.tsx) whose section comes from the URL,
// so any screen can link to an item or a customer and the browser back button works.
import type { OpsEntityType } from '@/lib/ops/types'

export type DashboardParams = Record<string, string | undefined>

export function dashboardHref(section: string, params: DashboardParams = {}): string {
  const search = new URLSearchParams({ section })
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  return `/admin/dashboard?${search.toString()}`
}

export function opsItemHref(type: OpsEntityType, id: string): string {
  return dashboardHref('ops-item', { type, id })
}

/**
 * Where a work-item row should link to. edition_request has no generic item-detail page (see
 * OPS_ENTITY_TABLES in src/lib/ops/types.ts) — it links to the Bookings workspace's own Experience
 * requests tab (EditionRequestsPanel) instead of /admin/dashboard?section=ops-item.
 */
export function workItemHref(type: OpsEntityType, id: string): string {
  if (type === 'edition_request') return dashboardHref('bookings', { tab: 'experience-requests' })
  return opsItemHref(type, id)
}

export function customerHref(id: string): string {
  return dashboardHref('customer', { id })
}

export function queueHref(view: string, params: DashboardParams = {}): string {
  return dashboardHref('queue', { view, ...params })
}
