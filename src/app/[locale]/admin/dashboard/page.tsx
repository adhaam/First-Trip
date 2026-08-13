'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Building2, Mountain, CalendarDays,
  ClipboardList, Users, MessageSquareText, Settings,
  LogOut, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { AccommodationManager } from '@/components/admin/AccommodationManager'
import { SinaiTripManager } from '@/components/admin/SinaiTripManager'
import { CommunityPostManager } from '@/components/admin/CommunityPostManager'
import { SiteSettingsManager } from '@/components/admin/SiteSettingsManager'
import { BookingsManager } from '@/components/admin/BookingsManager'
import { CustomersManager } from '@/components/admin/CustomersManager'
import { DashboardHome } from '@/components/admin/DashboardHome'

const sidebarItems = [
  { icon: LayoutDashboard, key: 'dashboard', label_ar: 'لوحة التحكم', label_en: 'Dashboard' },
  { icon: Building2, key: 'accommodations', label_ar: 'أماكن الإقامة', label_en: 'Accommodations' },
  { icon: Mountain, key: 'sinai-trips', label_ar: 'الرحلات الداخلية', label_en: 'Sinai Trips' },
  { icon: CalendarDays, key: 'dates', label_ar: 'التواريخ', label_en: 'Dates' },
  { icon: ClipboardList, key: 'bookings', label_ar: 'الحجوزات', label_en: 'Bookings' },
  { icon: Users, key: 'customers', label_ar: 'العملاء', label_en: 'Customers' },
  { icon: MessageSquareText, key: 'community', label_ar: 'المجتمع', label_en: 'Community' },
  { icon: Settings, key: 'settings', label_ar: 'الإعدادات', label_en: 'Settings' },
]

const CONNECTED_KEYS = ['dashboard', 'accommodations', 'sinai-trips', 'bookings', 'customers', 'community', 'settings']

export default function AdminDashboardPage() {
  const locale = useLocale()
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 z-50 flex w-64 flex-col bg-gray-900 text-white transition-transform lg:static',
        locale === 'ar'
          ? (sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')
          : (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      )}>
        <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
          <Image src="/logo.png" alt="First Trip" width={32} height={32} className="h-8 w-auto" />
          <span className="text-lg font-bold">
            <span className="text-[#38BDF8]">FIRST</span>{' '}
            <span className="text-[#FB923C]">TRIP</span>
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => { setActive(item.key); setSidebarOpen(false) }}
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
              window.location.href = `/${locale}/admin`
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b px-4 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {locale === 'ar' ? 'مرحباً، أدمن' : 'Welcome, Admin'}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {active === 'dashboard' && <DashboardHome />}
          {active === 'accommodations' && <AccommodationManager />}
          {active === 'sinai-trips' && <SinaiTripManager />}
          {active === 'bookings' && <BookingsManager />}
          {active === 'customers' && <CustomersManager />}
          {active === 'community' && <CommunityPostManager />}
          {active === 'settings' && <SiteSettingsManager />}

          {/* Trip Dates management isn't built yet */}
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
