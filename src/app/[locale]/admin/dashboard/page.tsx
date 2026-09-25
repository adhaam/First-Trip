'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import {
  LayoutDashboard, ListChecks, Inbox, Users, Search as SearchIcon,
  ClipboardList, MapPinned, Sparkles, UserPlus,
  Building2, Bus, Mountain, Package, Tags, Handshake, ShoppingBag, HeartPulse,
  MessageSquareText, Quote, Settings, Mail,
  ShieldCheck, History, UserCog,
  LogOut, Menu, X, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { StaffContext, type SignedInStaff, type StaffCapabilities } from '@/components/admin/ops/StaffContext'
import { dashboardHref, queueHref } from '@/components/admin/ops/nav'
import { OpsSearch } from '@/components/admin/ops/OpsSearch'
import { TodayView } from '@/components/admin/ops/TodayView'
import { QueueView } from '@/components/admin/ops/QueueView'
import { ItemDetail } from '@/components/admin/ops/ItemDetail'
import { CustomerProfile } from '@/components/admin/ops/CustomerProfile'
import { MyAccountView } from '@/components/admin/ops/MyAccountView'
import type { OpsEntityType } from '@/lib/ops/types'

import { AccommodationManager } from '@/components/admin/AccommodationManager'
import { SinaiTripManager } from '@/components/admin/SinaiTripManager'
import { CommunityPostManager } from '@/components/admin/CommunityPostManager'
import { SiteSettingsManager } from '@/components/admin/SiteSettingsManager'
import { BookingsManager } from '@/components/admin/BookingsManager'
import { CustomersManager } from '@/components/admin/CustomersManager'
import { TransferPricingManager } from '@/components/admin/TransferPricingManager'
import { TestimonialsManager } from '@/components/admin/TestimonialsManager'
import { NewsletterManager } from '@/components/admin/NewsletterManager'
import { TripBookingsManager } from '@/components/admin/TripBookingsManager'
import { CommerceManager } from '@/components/admin/CommerceManager'
import { TripPackageManager } from '@/components/admin/TripPackageManager'
import { PackageCategoryManager } from '@/components/admin/PackageCategoryManager'
import { ExperienceManager } from '@/components/admin/ExperienceManager'
import { ExperienceCategoryManager } from '@/components/admin/ExperienceCategoryManager'
import { ExperiencePartnerManager } from '@/components/admin/ExperiencePartnerManager'
import { ExperienceRequestsManager } from '@/components/admin/ExperienceRequestsManager'
import { PartnerInquiriesManager } from '@/components/admin/PartnerInquiriesManager'
import { StaffManager } from '@/components/admin/config/StaffManager'
import { TransportScheduleManager } from '@/components/admin/config/TransportScheduleManager'
import { AuditLogViewer } from '@/components/admin/config/AuditLogViewer'
import { CatalogueHealthPanel } from '@/components/admin/config/CatalogueHealthPanel'

type NavItem = { icon: LucideIcon; key: string; labelKey: string; href: string }
type NavGroup = { key: string; labelKey: string; items: NavItem[] }

function buildNavGroups(capabilities: StaffCapabilities, role: string | undefined): NavGroup[] {
  const groups: NavGroup[] = [
    {
      key: 'operations', labelKey: 'operations',
      items: [
        { icon: LayoutDashboard, key: 'today', labelKey: 'today', href: dashboardHref('today') },
        { icon: ListChecks, key: 'queue', labelKey: 'queue', href: queueHref('needs_action') },
        { icon: Inbox, key: 'trip-requests-queue', labelKey: 'tripRequests', href: queueHref('needs_action', { type: 'trip_request' }) },
        { icon: Users, key: 'customers', labelKey: 'customers', href: dashboardHref('customers') },
        { icon: SearchIcon, key: 'search', labelKey: 'search', href: dashboardHref('today') },
      ],
    },
    {
      key: 'bookings', labelKey: 'bookings',
      items: [
        { icon: ClipboardList, key: 'bookings', labelKey: 'dahabBookings', href: dashboardHref('bookings') },
        { icon: MapPinned, key: 'trip-bookings', labelKey: 'sinaiTripBookings', href: dashboardHref('trip-bookings') },
        { icon: Sparkles, key: 'signature-requests', labelKey: 'signatureRequests', href: dashboardHref('signature-requests') },
        { icon: UserPlus, key: 'partner-inquiries', labelKey: 'partnerInquiries', href: dashboardHref('partner-inquiries') },
      ],
    },
    {
      key: 'catalogue', labelKey: 'catalogue',
      items: [
        { icon: Building2, key: 'accommodations', labelKey: 'accommodations', href: dashboardHref('accommodations') },
        { icon: Bus, key: 'transfers', labelKey: 'transfersPricing', href: dashboardHref('transfers') },
        { icon: Mountain, key: 'sinai-trips', labelKey: 'sinaiTrips', href: dashboardHref('sinai-trips') },
        { icon: Package, key: 'trip-packages', labelKey: 'tripPackages', href: dashboardHref('trip-packages') },
        { icon: Tags, key: 'package-categories', labelKey: 'packageCategories', href: dashboardHref('package-categories') },
        { icon: Sparkles, key: 'signature-experiences', labelKey: 'signatureExperiences', href: dashboardHref('signature-experiences') },
        { icon: Tags, key: 'signature-categories', labelKey: 'signatureCategories', href: dashboardHref('signature-categories') },
        { icon: Handshake, key: 'experience-partners', labelKey: 'partners', href: dashboardHref('experience-partners') },
        { icon: ShoppingBag, key: 'commerce', labelKey: 'commerce', href: dashboardHref('commerce') },
        { icon: HeartPulse, key: 'catalogue-health', labelKey: 'catalogueHealth', href: dashboardHref('catalogue-health') },
      ],
    },
    {
      key: 'content', labelKey: 'content',
      items: [
        { icon: MessageSquareText, key: 'community', labelKey: 'community', href: dashboardHref('community') },
        { icon: Quote, key: 'testimonials', labelKey: 'testimonials', href: dashboardHref('testimonials') },
      ],
    },
    {
      key: 'settings', labelKey: 'settings',
      items: [
        { icon: Bus, key: 'transport-schedule', labelKey: 'transportSchedule', href: dashboardHref('transport-schedule') },
        { icon: Settings, key: 'settings', labelKey: 'siteSettings', href: dashboardHref('settings') },
        { icon: Mail, key: 'newsletter', labelKey: 'newsletter', href: dashboardHref('newsletter') },
      ],
    },
  ]

  const teamItems: NavItem[] = []
  if (capabilities.manageStaff) teamItems.push({ icon: UserCog, key: 'staff', labelKey: 'staff', href: dashboardHref('staff') })
  if (role !== 'operations') teamItems.push({ icon: History, key: 'audit', labelKey: 'auditLog', href: dashboardHref('audit') })
  teamItems.push({ icon: ShieldCheck, key: 'my-account', labelKey: 'myAccount', href: dashboardHref('my-account') })
  groups.push({ key: 'team', labelKey: 'team', items: teamItems })

  return groups
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

  const section = searchParams.get('section') || 'today'
  const navGroups = buildNavGroups(capabilities, staff?.role)

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
                    const isCurrent = section === item.key || (item.key === 'queue' && section === 'queue')
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

function SectionBody({ section, searchParams }: { section: string; searchParams: URLSearchParams }) {
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
    case 'bookings': return <BookingsManager />
    case 'trip-bookings': return <TripBookingsManager />
    case 'signature-requests': return <ExperienceRequestsManager />
    case 'partner-inquiries': return <PartnerInquiriesManager />
    case 'accommodations': return <AccommodationManager />
    case 'transfers': return <TransferPricingManager />
    case 'sinai-trips': return <SinaiTripManager />
    case 'trip-packages': return <TripPackageManager />
    case 'package-categories': return <PackageCategoryManager />
    case 'signature-experiences': return <ExperienceManager />
    case 'signature-categories': return <ExperienceCategoryManager />
    case 'experience-partners': return <ExperiencePartnerManager />
    case 'commerce': return <CommerceManager />
    case 'catalogue-health': return <CatalogueHealthPanel />
    case 'community': return <CommunityPostManager />
    case 'testimonials': return <TestimonialsManager />
    case 'transport-schedule': return <TransportScheduleManager />
    case 'settings': return <SiteSettingsManager />
    case 'newsletter': return <NewsletterManager />
    case 'staff': return <StaffManager />
    case 'audit': return <AuditLogViewer />
    case 'my-account': return <MyAccountView />
    default: return <TodayView />
  }
}
