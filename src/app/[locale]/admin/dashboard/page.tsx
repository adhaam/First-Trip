'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Building2, Mountain, CalendarDays,
  ClipboardList, Users, MessageSquareText, Settings,
  Bus, Quote, LogOut, Menu, X, Mail, ShoppingBag, MapPinned
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
import { TripDatesManager } from '@/components/admin/TripDatesManager'
import { TransferPricingManager } from '@/components/admin/TransferPricingManager'
import { TestimonialsManager } from '@/components/admin/TestimonialsManager'
import { NewsletterManager } from '@/components/admin/NewsletterManager'
import { TripBookingsManager } from '@/components/admin/TripBookingsManager'
import { CommerceManager } from '@/components/admin/CommerceManager'

const sidebarItems = [
  { icon: LayoutDashboard, key: 'dashboard', label_ar: 'لوحة التحكم', label_en: 'Dashboard' },
  { icon: Building2, key: 'accommodations', label_ar: 'أماكن الإقامة', label_en: 'Accommodations' },
  { icon: Mountain, key: 'sinai-trips', label_ar: 'الرحلات الداخلية', label_en: 'Sinai Trips' },
  { icon: MapPinned, key: 'trip-bookings', label_ar: 'طلبات رحلات سيناء', label_en: 'Sinai Trip Bookings' },
  { icon: Bus, key: 'transfers', label_ar: 'النقل', label_en: 'Transfers' },
  { icon: CalendarDays, key: 'dates', label_ar: 'التواريخ', label_en: 'Dates' },
  { icon: ClipboardList, key: 'bookings', label_ar: 'الحجوزات', label_en: 'Bookings' },
  { icon: ShoppingBag, key: 'commerce', label_ar: 'المتجر والإيجارات', label_en: 'Commerce' },
  { icon: Users, key: 'customers', label_ar: 'العملاء', label_en: 'Customers' },
  { icon: Mail, key: 'newsletter', label_ar: 'النشرة البريدية', label_en: 'Newsletter' },
  { icon: MessageSquareText, key: 'community', label_ar: 'المجتمع', label_en: 'Community' },
  { icon: Quote, key: 'testimonials', label_ar: 'آراء العملاء', label_en: 'Testimonials' },
  { icon: Settings, key: 'settings', label_ar: 'الإعدادات', label_en: 'Settings' },
]

const CONNECTED_KEYS = sidebarItems.map(i => i.key)

export default function AdminDashboardPage() {
  const locale = useLocale()
  const router = useRouter()
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside id="admin-sidebar" className={cn(
        'fixed inset-y-0 z-50 flex w-64 flex-col bg-gray-900 text-white transition-transform lg:static',
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-300 hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 lg:hidden"
            aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label={locale === 'ar' ? 'أقسام لوحة التحكم' : 'Dashboard sections'} className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {sidebarItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { setActive(item.key); setSidebarOpen(false) }}
                aria-current={active === item.key ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active === item.key
                    ? 'bg-brand-blue text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{locale === 'ar' ? item.label_ar : item.label_en}</span>
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white"
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
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b px-4 lg:px-8 h-16 flex items-center justify-between">
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
            <span className="text-sm text-gray-500">
              {locale === 'ar' ? 'مرحباً، أدمن' : 'Welcome, Admin'}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main id="admin-main" className="min-w-0 flex-1 p-4 lg:p-8">
          {active === 'dashboard' && <DashboardHome />}
          {active === 'accommodations' && <AccommodationManager />}
          {active === 'sinai-trips' && <SinaiTripManager />}
          {active === 'trip-bookings' && <TripBookingsManager />}
          {active === 'transfers' && <TransferPricingManager />}
          {active === 'dates' && <TripDatesManager />}
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
