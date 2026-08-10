'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  LayoutDashboard, Building2, Mountain, CalendarDays,
  ClipboardList, Users, MessageSquareText, Settings,
  LogOut, Menu, X, TrendingUp, DollarSign, BedDouble, Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

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

const stats = [
  { label_ar: 'إجمالي الحجوزات', label_en: 'Total Bookings', value: '1,248', icon: ClipboardList, color: 'bg-blue-500' },
  { label_ar: 'الإيرادات', label_en: 'Revenue', value: '2.4M ج.م', icon: DollarSign, color: 'bg-green-500' },
  { label_ar: 'أماكن الإقامة', label_en: 'Accommodations', value: '32', icon: Building2, color: 'bg-orange-500' },
  { label_ar: 'العملاء', label_en: 'Customers', value: '850+', icon: Users, color: 'bg-purple-500' },
]

const recentBookings = [
  { name: 'أحمد محمود', phone: '01012345678', hotel: 'Dahab Paradise', date: '2026-08-15', status: 'مؤكد' },
  { name: 'منى السيد', phone: '01098765432', hotel: 'Laguna Beach Chalet', date: '2026-08-21', status: 'معلق' },
  { name: 'كريم عادل', phone: '01234567890', hotel: 'Tropitel Dahab', date: '2026-08-27', status: 'مؤكد' },
  { name: 'سارة حسن', phone: '01122334455', hotel: 'Ali Baba Camp', date: '2026-09-02', status: 'ملغي' },
]

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
          {/* Dashboard Home */}
          {active === 'dashboard' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
              </h1>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => {
                  const Icon = stat.icon
                  return (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white', stat.color)}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                            <div className="text-sm text-gray-500">
                              {locale === 'ar' ? stat.label_ar : stat.label_en}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Recent Bookings */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">
                    {locale === 'ar' ? 'آخر الحجوزات' : 'Recent Bookings'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-3 font-medium">{locale === 'ar' ? 'الاسم' : 'Name'}</th>
                          <th className="pb-3 font-medium">{locale === 'ar' ? 'الهاتف' : 'Phone'}</th>
                          <th className="pb-3 font-medium">{locale === 'ar' ? 'الفندق' : 'Hotel'}</th>
                          <th className="pb-3 font-medium">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                          <th className="pb-3 font-medium">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-3 font-medium text-gray-900">{b.name}</td>
                            <td className="py-3 text-gray-600" dir="ltr">{b.phone}</td>
                            <td className="py-3 text-gray-600">{b.hotel}</td>
                            <td className="py-3 text-gray-600">{b.date}</td>
                            <td className="py-3">
                              <span className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                b.status === 'مؤكد' ? 'bg-green-100 text-green-700' :
                                b.status === 'معلق' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              )}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Placeholder for other sections */}
          {active !== 'dashboard' && (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-4">⚙️</div>
              <p className="text-lg">
                {locale === 'ar'
                  ? `قسم ${sidebarItems.find(s => s.key === active)?.[locale === 'ar' ? 'label_ar' : 'label_en']} — سيتم ربطه بـ Supabase قريباً`
                  : `${sidebarItems.find(s => s.key === active)?.[locale === 'ar' ? 'label_ar' : 'label_en']} section — Will be connected to Supabase soon`}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}