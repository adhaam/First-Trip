'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Building2, Mountain,
  ClipboardList, Users, MessageSquareText, Settings,
  Bus, Quote, LogOut, Menu, X, Mail, ShoppingBag, MapPinned, Package, Tags, Sparkles, Handshake, Inbox, UserPlus,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { AccommodationManager } from '@/components/admin/AccommodationManager'
import { SinaiTripManager } from '@/components/admin/SinaiTripManager'
import { CommunityPostManager } from '@/components/admin/CommunityPostManager'
import { SiteSettingsManager } from '@/components/admin/SiteSettingsManager'
import { BookingsManager } from '@/components/admin/BookingsManager'
import { CustomersManager } from '@/components/admin/CustomersManager'
import { DashboardHome } from '@/components/admin/DashboardHome'
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

type SidebarItem = { icon: LucideIcon; key: string; label_ar: string; label_en: string; badgeKey?: 'signature-requests' | 'partner-inquiries' }
type NavGroup = { key: string; label_ar: string; label_en: string; items: SidebarItem[] }

const navGroups: NavGroup[] = [
  {
    key: 'overview', label_ar: 'نظرة عامة', label_en: 'Overview',
    items: [
      { icon: LayoutDashboard, key: 'dashboard', label_ar: 'لوحة التحكم', label_en: 'Dashboard' },
    ],
  },
  {
    key: 'bookings-ops', label_ar: 'الحجوزات والعمليات', label_en: 'Bookings & Operations',
    items: [
      { icon: ClipboardList, key: 'bookings', label_ar: 'حجوزات دهب', label_en: 'Dahab Bookings' },
      { icon: MapPinned, key: 'trip-bookings', label_ar: 'طلبات رحلات سيناء', label_en: 'Sinai Trip Bookings' },
      { icon: Inbox, key: 'signature-requests', label_ar: 'طلبات التجارب المميزة', label_en: 'Signature Requests', badgeKey: 'signature-requests' },
      { icon: UserPlus, key: 'partner-inquiries', label_ar: 'طلبات الشراكة', label_en: 'Partner Inquiries', badgeKey: 'partner-inquiries' },
    ],
  },
  {
    key: 'stays', label_ar: 'الإقامة', label_en: 'Stays',
    items: [
      { icon: Building2, key: 'accommodations', label_ar: 'أماكن الإقامة', label_en: 'Accommodations' },
      { icon: Bus, key: 'transfers', label_ar: 'النقل', label_en: 'Transfers' },
    ],
  },
  {
    key: 'experiences', label_ar: 'التجارب', label_en: 'Experiences',
    items: [
      { icon: Mountain, key: 'sinai-trips', label_ar: 'الرحلات الداخلية', label_en: 'Sinai Trips' },
      { icon: Package, key: 'trip-packages', label_ar: 'باكدجات الرحلات', label_en: 'Trip Packages' },
      { icon: Tags, key: 'package-categories', label_ar: 'تصنيفات الباكدجات', label_en: 'Package Categories' },
      { icon: Sparkles, key: 'signature-experiences', label_ar: 'تجارب WEEMAP المميزة', label_en: 'Signature Experiences' },
      { icon: Tags, key: 'signature-categories', label_ar: 'تصنيفات التجارب المميزة', label_en: 'Signature Categories' },
      { icon: Handshake, key: 'experience-partners', label_ar: 'الشركاء', label_en: 'Experience Partners' },
    ],
  },
  {
    key: 'commerce', label_ar: 'المتجر', label_en: 'Commerce',
    items: [
      { icon: ShoppingBag, key: 'commerce', label_ar: 'المتجر والإيجارات', label_en: 'Commerce' },
    ],
  },
  {
    key: 'content', label_ar: 'المحتوى', label_en: 'Content',
    items: [
      { icon: MessageSquareText, key: 'community', label_ar: 'المجتمع', label_en: 'Community' },
      { icon: Quote, key: 'testimonials', label_ar: 'آراء العملاء', label_en: 'Testimonials' },
    ],
  },
  {
    key: 'customers', label_ar: 'العملاء', label_en: 'Customers',
    items: [
      { icon: Users, key: 'customers', label_ar: 'العملاء', label_en: 'Customers' },
      { icon: Mail, key: 'newsletter', label_ar: 'النشرة البريدية', label_en: 'Newsletter' },
    ],
  },
  {
    key: 'website', label_ar: 'الموقع', label_en: 'Website',
    items: [
      { icon: Settings, key: 'settings', label_ar: 'الإعدادات', label_en: 'Settings' },
    ],
  },
]

const sidebarItems: SidebarItem[] = navGroups.flatMap(g => g.items)
const CONNECTED_KEYS = sidebarItems.map(i => i.key)

export default function AdminDashboardPage() {
  const locale = useLocale()
  const router = useRouter()
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({})

  // Cheap pending-count badges for a couple of nav items — small admin tables,
  // fetched once on mount so the sidebar can surface what needs attention.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [reqRes, inqRes] = await Promise.all([
          fetch('/api/admin/experience-bookings'),
          fetch('/api/admin/partner-inquiries'),
        ])
        const reqData = await reqRes.json().catch(() => ({}))
        const inqData = await inqRes.json().catch(() => ({}))
        if (cancelled) return
        setBadgeCounts({
          'signature-requests': (reqData.requests || []).filter((r: { status?: string }) => r.status === 'new').length,
          'partner-inquiries': (inqData.inquiries || []).filter((i: { status?: string }) => i.status === 'new').length,
        })
      } catch {
        // badges are a non-critical enhancement — silently skip on failure
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-gray-50">
      {/* Sidebar */}
      <aside id="admin-sidebar" className={cn(
        'fixed inset-y-0 z-50 flex w-64 flex-col bg-weemap-charcoal text-white transition-transform lg:static',
        locale === 'ar'
          ? (sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')
          : (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      )}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
          <Logo size="md" tone="light" priority />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-sand-100/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 lg:hidden"
            aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label={locale === 'ar' ? 'أقسام لوحة التحكم' : 'Dashboard sections'} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {navGroups.map(group => (
            <div key={group.key}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sand-100/40">
                {locale === 'ar' ? group.label_ar : group.label_en}
              </div>
              <div className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon
                  const badge = item.badgeKey ? badgeCounts[item.badgeKey] : undefined
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { setActive(item.key); setSidebarOpen(false) }}
                      aria-current={active === item.key ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        active === item.key
                          ? 'bg-weemap-orange text-white'
                          : 'text-sand-100/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-start">{locale === 'ar' ? item.label_ar : item.label_en}</span>
                      {!!badge && (
                        <span className={cn(
                          'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                          active === item.key ? 'bg-white/25 text-white' : 'bg-weemap-orange text-white'
                        )}>
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <Button
            variant="ghost"
            className="w-full justify-start text-sand-100/70 hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' })
              router.replace('/admin')
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
        />
      )}

      {/* Main Content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="flex h-16 min-w-0 items-center justify-between gap-2 border-b bg-white px-4 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange lg:hidden"
            aria-label={locale === 'ar' ? 'فتح قائمة لوحة التحكم' : 'Open dashboard menu'}
            aria-controls="admin-sidebar"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden truncate font-semibold text-gray-900 sm:inline">
              {locale === 'ar' ? 'مركز تحكم WEEMAP' : 'WEEMAP Business Control Center'}
            </span>
            <span className="truncate text-sm text-gray-500">
              {locale === 'ar' ? 'مرحباً، أدمن' : 'Welcome, Admin'}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main id="admin-main" className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-4 lg:p-8">
          {active === 'dashboard' && <DashboardHome />}
          {active === 'accommodations' && <AccommodationManager />}
          {active === 'sinai-trips' && <SinaiTripManager />}
          {active === 'trip-packages' && <TripPackageManager />}
          {active === 'package-categories' && <PackageCategoryManager />}
          {active === 'trip-bookings' && <TripBookingsManager />}
          {active === 'signature-experiences' && <ExperienceManager />}
          {active === 'signature-categories' && <ExperienceCategoryManager />}
          {active === 'experience-partners' && <ExperiencePartnerManager />}
          {active === 'signature-requests' && <ExperienceRequestsManager />}
          {active === 'partner-inquiries' && <PartnerInquiriesManager />}
          {active === 'transfers' && <TransferPricingManager />}
          {active === 'bookings' && <BookingsManager />}
          {active === 'commerce' && <CommerceManager />}
          {active === 'customers' && <CustomersManager />}
          {active === 'newsletter' && <NewsletterManager />}
          {active === 'community' && <CommunityPostManager />}
          {active === 'testimonials' && <TestimonialsManager />}
          {active === 'settings' && <SiteSettingsManager />}

          {!CONNECTED_KEYS.includes(active) && (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-4">⚙️</div>
              <p className="text-lg">
                {locale === 'ar'
                  ? `قسم ${sidebarItems.find(s => s.key === active)?.label_ar} — قريباً`
                  : `${sidebarItems.find(s => s.key === active)?.label_en} section — coming soon`}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
