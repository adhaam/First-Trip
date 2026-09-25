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

export function customerHref(id: string): string {
  return dashboardHref('customer', { id })
}

export function queueHref(view: string, params: DashboardParams = {}): string {
  return dashboardHref('queue', { view, ...params })
}
