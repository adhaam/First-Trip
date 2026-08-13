'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, DollarSign, Building2, Users, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Booking, BookingStatus } from '@/lib/types'

const STATUS_LABEL: Record<BookingStatus, { ar: string; en: string }> = {
  pending: { ar: 'معلق', en: 'Pending' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  completed: { ar: 'مكتمل', en: 'Completed' },
}

export function DashboardHome() {
  const locale = useLocale()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [accommodationsCount, setAccommodationsCount] = useState(0)
  const [customersCount, setCustomersCount] = useState(0)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [bookingsRes, accRes, custRes] = await Promise.all([
          fetch('/api/admin/bookings'),
          fetch('/api/admin/accommodations'),
          fetch('/api/admin/customers'),
        ])
        if (bookingsRes.status === 401) { window.location.href = `/${locale}/admin`; return }
        const bookingsData = await bookingsRes.json().catch(() => ({}))
        const accData = await accRes.json().catch(() => ({}))
        const custData = await custRes.json().catch(() => ({}))
        setBookings(bookingsData.bookings || [])
        setAccommodationsCount((accData.accommodations || []).length)
        setCustomersCount((custData.customers || []).length)
      } finally {
        setLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const revenue = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_price || 0), 0)

  const stats = [
    { label_ar: 'إجمالي الحجوزات', label_en: 'Total Bookings', value: bookings.length.toLocaleString(), icon: ClipboardList, color: 'bg-blue-500' },
    { label_ar: 'الإيرادات (مؤكدة)', label_en: 'Revenue (confirmed)', value: `${revenue.toLocaleString()} ج.م`, icon: DollarSign, color: 'bg-green-500' },
    { label_ar: 'أماكن الإقامة', label_en: 'Accommodations', value: String(accommodationsCount), icon: Building2, color: 'bg-orange-500' },
    { label_ar: 'العملاء', label_en: 'Customers', value: String(customersCount), icon: Users, color: 'bg-purple-500' },
  ]

  const recent = [...bookings].slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{locale === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</h1>

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
                    <div className="text-2xl font-bold text-gray-900">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}</div>
                    <div className="text-sm text-gray-500">{locale === 'ar' ? stat.label_ar : stat.label_en}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{locale === 'ar' ? 'آخر الحجوزات' : 'Recent Bookings'}</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8 text-gray-400">{locale === 'ar' ? 'لا توجد حجوزات بعد' : 'No bookings yet'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">{locale === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th className="pb-3 font-medium">{locale === 'ar' ? 'الهاتف' : 'Phone'}</th>
                    <th className="pb-3 font-medium">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="pb-3 font-medium">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(b => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-3 font-medium text-gray-900">{b.customer_name}</td>
                      <td className="py-3 text-gray-600" dir="ltr">{b.customer_phone}</td>
                      <td className="py-3 text-gray-600">{b.trip_date || '—'}</td>
                      <td className="py-3">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          b.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {locale === 'ar' ? STATUS_LABEL[b.status].ar : STATUS_LABEL[b.status].en}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
