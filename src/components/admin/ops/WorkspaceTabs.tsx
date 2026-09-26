'use client'

// Reusable tab bar for an admin "workspace" (one sidebar entry, several jobs
// inside it). Driven by the URL: ?section=<workspace>&tab=<tabId>, so a tab is
// linkable and the browser back button works. Scrolls horizontally on narrow
// screens instead of wrapping.
import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export type WorkspaceTab = {
  id: string
  label: string
  content: ReactNode
  /** Visually de-emphasised, e.g. a legacy/archive tab. */
  muted?: boolean
  /** Extra query params to set when this tab becomes active (e.g. a queue filter). */
  params?: Record<string, string>
}

export function WorkspaceTabs({
  section, tabs, defaultTab,
}: { section: string; tabs: WorkspaceTab[]; defaultTab: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('tab')
  const active = tabs.find((t) => t.id === requested)?.id ?? defaultTab

  const selectTab = useCallback((tabId: string) => {
    // Fresh params on tab switch — a tab's own filters (view/type/status/…)
    // shouldn't leak in from whichever tab was active before it.
    const params = new URLSearchParams()
    params.set('section', section)
    params.set('tab', tabId)
    const extra = tabs.find((t) => t.id === tabId)?.params
    if (extra) for (const [key, value] of Object.entries(extra)) params.set(key, value)
    router.push(`/admin/dashboard?${params.toString()}`)
  }, [router, section, tabs])

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="-mx-1 mb-4 overflow-x-auto">
        <div role="tablist" className="flex min-w-max gap-1 border-b px-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(tab.id)}
                className={cn(
                  'whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-b-2 border-weemap-orange text-weemap-orange'
                    : tab.muted
                      ? 'text-muted-foreground/60 hover:text-muted-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1">{activeTab?.content}</div>
    </div>
  )
}
