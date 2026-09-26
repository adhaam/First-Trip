'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import {
  LayoutDashboard, ListChecks, Users, Search as SearchIcon,
  Package2, ShoppingBag, Globe, Settings,
  LogOut, Menu, X, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { StaffContext, type SignedInStaff, type StaffCapabilities } from '@/components/admin/ops/StaffContext'
import { dashboardHref } from '@/components/admin/ops/nav'
import { OpsSearch } from '@/components/admin/ops/OpsSearch'
import { TodayView } from '@/components/admin/ops/TodayView'
import { QueueView } from '@/components/admin/ops/QueueView'
import { ItemDetail } from '@/components/admin/ops/ItemDetail'
import { CustomerProfile } from '@/components/admin/ops/CustomerProfile'
import { BookingsWorkspace } from '@/components/admin/ops/BookingsWorkspace'
import { CatalogueWorkspace } from '@/components/admin/ops/CatalogueWorkspace'
import { WebsiteWorkspace } from '@/components/admin/ops/WebsiteWorkspace'
import { SettingsWorkspace } from '@/components/admin/ops/SettingsWorkspace'
import type { OpsEntityType } from '@/lib/ops/types'

import { CustomersManager } from '@/components/admin/CustomersManager'
import { CommerceManager } from '@/components/admin/CommerceManager'

type NavItem = { icon: LucideIcon; key: string; labelKey: string; href: string }
type NavGroup = { key: string; labelKey: string; items: NavItem[] }

// Legacy ?section= values that predate the workspace/tab restructure, mapped to
// their new home so old links (Today tiles, work-items, ItemDetail, OpsSearch,
// emails, bookmarks) keep landing in the right place. Each maps to a workspace
// section plus the default tab that workspace should open on when no ?tab= is
// given explicitly.
const LEGACY_SECTION_MAP: Record<string, { section: string; tab: string }> = {
  // Bare ?section=bookings (no ?tab=) predates tabs and meant "Dahab bookings" (Stays).
  // New links to the workspace always pass an explicit ?tab=, so they skip this default.
  bookings: { section: 'bookings', tab: 'stays' },
  'trip-bookings': { section: 'bookings', tab: 'trips' },
  'signature-requests': { section: 'bookings', tab: 'experience-requests-archive' },
  'partner-inquiries': { section: 'bookings', tab: 'partner-inquiries' },
  'trip-requests-queue': { section: 'bookings', tab: 'trip-requests' },
  accommodations: { section: 'catalogue', tab: 'stays' },
  transfers: { section: 'catalogue', tab: 'transfers' },
  'transport-schedule': { section: 'catalogue', tab: 'transfers' },
  'sinai-trips': { section: 'catalogue', tab: 'trips' },
  'trip-packages': { section: 'catalogue', tab: 'packages' },
  'package-categories': { section: 'catalogue', tab: 'packages' },
  editions: { section: 'catalogue', tab: 'experiences' },
  'signature-experiences': { section: 'catalogue', tab: 'experiences' },
  'signature-categories': { section: 'catalogue', tab: 'experiences' },
  'experience-partners': { section: 'catalogue', tab: 'partners' },
  'catalogue-health': { section: 'catalogue', tab: 'health' },
  community: { section: 'website', tab: 'community' },
  testimonials: { section: 'website', tab: 'testimonials' },
  newsletter: { section: 'website', tab: 'newsletter' },
  settings: { section: 'settings', tab: 'site-settings' },
  staff: { section: 'settings', tab: 'staff' },
  audit: { section: 'settings', tab: 'audit' },
  'my-account': { section: 'settings', tab: 'my-account' },
}

function buildNavGroups(): NavGroup[] {
  return [
    {
      key: 'operations', labelKey: 'operations',
      items: [
        { icon: LayoutDashboard, key: 'today', labelKey: 'today', href: dashboardHref('today') },
        { icon: SearchIcon, key: 'search', labelKey: 'search', href: dashboardHref('today') },
      ],
    },
    {
      key: 'workspaces', labelKey: 'workspaces',
      items: [
        {
          icon: ListChecks, key: 'bookings', labelKey: 'bookings',
          href: dashboardHref('bookings', { tab: 'needs-action' }),
        },
        {
          icon: Package2, key: 'catalogue', labelKey: 'catalogue',
          href: dashboardHref('catalogue', { tab: 'stays' }),
        },
        { icon: Users, key: 'customers', labelKey: 'customers', href: dashboardHref('customers') },
        { icon: ShoppingBag, key: 'commerce', labelKey: 'commerce', href: dashboardHref('commerce') },
        {
          icon: Globe, key: 'website', labelKey: 'website',
          href: dashboardHref('website', { tab: 'website-manager' }),
        },
        {
          icon: Settings, key: 'settings', labelKey: 'settings',
          href: dashboardHref('settings', { tab: 'site-settings' }),
        },
      ],
    },
  ]
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardShell />
    </Suspense>
  )
}

function DashboardShell() {
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('ops')
  const tNavGroups = useTranslations('ops.nav.groups')
  const tNavItems = useTranslations('ops.nav.items')
  const tHeader = useTranslations('ops.header')

  const [staff, setStaff] = useState<SignedInStaff | null>(null)
  const [capabilities, setCapabilities] = useState<StaffCapabilities>({ manageCatalogue: false, manageStaff: false })
  const [staffLoaded, setStaffLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/me')
        if (res.status === 401) { router.replace('/admin'); return }
        const data = await res.json()
        if (cancelled) return
        setStaff(data.staff)
        setCapabilities(data.capabilities)
      } catch {
        router.replace('/admin')
      } finally {
        if (!cancelled) setStaffLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!sidebarOpen) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  const rawSection = searchParams.get('section') || 'today'
  const legacy = LEGACY_SECTION_MAP[rawSection]
  const section = legacy?.section ?? rawSection
  const defaultTab = legacy?.tab
  const navGroups = buildNavGroups()

  const signOut = async () => {
    setSigningOut(true)
    await fetch('/api/admin/logout', { method: 'POST' })
    router.replace('/admin')
  }

  if (!staffLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50" />
  }

  return (
    <StaffContext.Provider value={{ staff, capabilities }}>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-gray-50">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          {tHeader('sections')}
        </a>

        <aside id="admin-sidebar" className={cn(
          'fixed inset-y-0 z-50 flex w-64 flex-col bg-weemap-charcoal text-white transition-transform lg:static',
          locale === 'ar'
            ? (sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')
            : (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'),
        )}>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
            <Logo size="md" tone="light" priority />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-sand-100/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 lg:hidden"
              aria-label={tHeader('closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label={tHeader('sections')} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => (
              <div key={group.key}>
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sand-100/40">
                  {tNavGroups(group.labelKey)}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isCurrent = section === item.key || (item.key === 'bookings' && section === 'queue')
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isCurrent ? 'bg-weemap-orange text-white' : 'text-sand-100/70 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1 text-start">{tNavItems(item.labelKey)}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-white/10 px-3 py-4">
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sand-100/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? tHeader('signingOut') : tHeader('signOut')}
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={tHeader('closeMenu')}
          />
        )}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-2 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange lg:hidden"
                aria-label={tHeader('openMenu')}
                aria-controls="admin-sidebar"
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <span className="hidden truncate font-semibold text-gray-900 sm:inline">{t('appName')}</span>
            </div>

            <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 lg:px-6">
              <OpsSearch />
            </div>

            {staff && (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden text-end sm:block">
                  <span className="block font-medium text-gray-900">{staff.display_name}</span>
                  <span className="block text-xs text-muted-foreground"><RoleLabel role={staff.role} /></span>
                </span>
              </div>
            )}
          </header>

          {staff?.legacy && (
            <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 lg:px-8">
              {t('legacyBanner')}
            </div>
          )}

          <main id="admin-main" className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-4 lg:p-8">
            <SectionBody
              section={section}
              searchParams={searchParams}
              legacyDefaultTab={defaultTab}
              capabilities={capabilities}
              role={staff?.role}
            />
          </main>
        </div>
      </div>
    </StaffContext.Provider>
  )
}

function RoleLabel({ role }: { role: string }) {
  const t = useTranslations('ops.role')
  return <>{t.has(role) ? t(role) : role}</>
}

function SectionBody({
  section, searchParams, legacyDefaultTab, capabilities, role,
}: {
  section: string
  searchParams: URLSearchParams
  legacyDefaultTab?: string
  capabilities: StaffCapabilities
  role: string | undefined
}) {
  const t = useTranslations('ops.common')
  switch (section) {
    case 'today': return <TodayView />
    case 'queue': return <QueueView />
    case 'ops-item': {
      const type = searchParams.get('type') as OpsEntityType | null
      const id = searchParams.get('id')
      if (!type || !id) return <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      return <ItemDetail type={type} id={id} />
    }
    case 'customer': {
      const id = searchParams.get('id')
      if (!id) return <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      return <CustomerProfile id={id} />
    }
    case 'customers': return <CustomersManager />
    case 'bookings': return <BookingsWorkspace defaultTab={legacyDefaultTab ?? 'needs-action'} />
    case 'catalogue': return <CatalogueWorkspace defaultTab={legacyDefaultTab ?? 'stays'} />
    case 'commerce': return <CommerceManager />
    case 'website': return <WebsiteWorkspace defaultTab={legacyDefaultTab ?? 'website-manager'} />
    case 'settings':
      return (
        <SettingsWorkspace
          defaultTab={legacyDefaultTab ?? 'site-settings'}
          capabilities={capabilities}
          role={role}
        />
      )
    default: return <TodayView />
  }
}
