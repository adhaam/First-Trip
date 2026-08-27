'use client'

// ─── WEEMAP Business Control Center — Overview ───
// Real booking data only. "Booked value" is deliberately not called revenue:
// revenue = what was actually collected (amount_paid), and both are shown.

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  ClipboardList, Banknote, Users, Loader2, CalendarClock, Wallet,
  AlertTriangle, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Accommodation, Booking, BookingStatus } from '@/lib/types'

const STATUS_LABEL: Record<BookingStatus, { ar: string; en: string; cls: string }> = {
  new: { ar: 'جديد', en: 'New', cls: 'bg-purple-100 text-purple-700' },
  pending: { ar: 'معلق', en: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-100 text-red-700' },
  completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-blue-100 text-blue-700' },
}

type RangeKey = 'today' | '7d' | 'month' | 'last_month' | 'all' | 'custom'

function rangeBounds(key: RangeKey, customFrom: string, customTo: string): [string, string] | null {
  const now = new Date()
  const iso = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const today = iso(now)
  switch (key) {
    case 'today': return [today, today]
    case '7d': { const d = new Date(now); d.setDate(d.getDate() - 6); return [iso(d), today] }
    case 'month': return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), today]
    case 'last_month': return [
      iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    ]
    case 'custom': return customFrom && customTo ? [customFrom, customTo] : null
    default: return null
  }
}

export function DashboardHome() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [customersCount, setCustomersCount] = useState(0)

  const [range, setRange] = useState<RangeKey>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [bookingsRes, accRes, custRes] = await Promise.all([
          fetch('/api/admin/bookings'),
          fetch('/api/admin/accommodations'),
          fetch('/api/admin/customers'),
        ])
        if (bookingsRes.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
        const bookingsData = await bookingsRes.json().catch(() => ({}))
        const accData = await accRes.json().catch(() => ({}))
        const custData = await custRes.json().catch(() => ({}))
        setBookings(bookingsData.bookings || [])
        setAccommodations(accData.accommodations || [])
        setCustomersCount((custData.customers || []).length)
      } finally {
        setLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bookings CREATED in the selected range
  const inRange = useMemo(() => {
    const bounds = rangeBounds(range, customFrom, customTo)
    if (!bounds) return bookings
    const [from, to] = bounds
    return bookings.filter(b => {
      const created = (b.created_at || '').slice(0, 10)
      return created >= from && created <= to
    })
  }, [bookings, range, customFrom, customTo])

  const kpis = useMemo(() => {
    const active = inRange.filter(b => b.status !== 'cancelled')
    const bookedValue = active.reduce((s, b) => s + (Number(b.total_price) || 0), 0)
    const collected = active.reduce((s, b) => s + (Number(b.amount_paid) || 0), 0)
    const travelers = active.reduce((s, b) => s + (Number(b.num_people) || 0), 0)
    const confirmed = inRange.filter(b => b.status === 'confirmed' || b.status === 'completed').length
    const needsAction = inRange.filter(b => b.status === 'new' || b.status === 'pending').length
    const cancelled = inRange.filter(b => b.status === 'cancelled').length
    return {
      count: inRange.length,
      confirmed,
      needsAction,
      cancelled,
      travelers,
      bookedValue,
      collected,
      outstanding: bookedValue - collected,
      avg: active.length ? Math.round(bookedValue / active.length) : 0,
    }
  }, [inRange])

  // Upcoming arrivals — travel date today or later, not cancelled, soonest first
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return bookings
      .filter(b => b.trip_date && b.trip_date >= today && b.status !== 'cancelled')
      .sort((a, b) => (a.trip_date! < b.trip_date! ? -1 : 1))
      .slice(0, 6)
  }, [bookings])

  const recent = useMemo(() => [...bookings].slice(0, 5), [bookings])

  // ─── Attention required — actionable data-quality checks ───
  const attention = useMemo(() => {
    const items: { ar: string; en: string }[] = []
    const activeAccs = accommodations.filter(a => a.is_active)
    const noImages = activeAccs.filter(a => !(a.images?.length) && !a.image_url)
    if (noImages.length) items.push({
      ar: `${noImages.length} أماكن إقامة من غير صور`,
      en: `${noImages.length} accommodation(s) missing photos`,
    })
    const noRoomPricing = activeAccs.filter(a => !Number(a.price_double_room) && !Number(a.price_single_room))
    if (noRoomPricing.length) items.push({
      ar: `${noRoomPricing.length} أماكن من غير أسعار غرف أساسية`,
      en: `${noRoomPricing.length} accommodation(s) missing base room pricing`,
    })
    const newBookings = bookings.filter(b => b.status === 'new').length
    if (newBookings) items.push({
      ar: `${newBookings} حجز جديد مستني مراجعة`,
      en: `${newBookings} new booking(s) awaiting review`,
    })
    return items
  }, [accommodations, bookings])

  const fmt = (n: number) => `${n.toLocaleString()} ج.م`

  const RANGES: { key: RangeKey; ar: string; en: string }[] = [
    { key: 'today', ar: 'النهارده', en: 'Today' },
    { key: '7d', ar: 'آخر 7 أيام', en: 'Last 7 days' },
    { key: 'month', ar: 'الشهر ده', en: 'This month' },
    { key: 'last_month', ar: 'الشهر اللي فات', en: 'Last month' },
    { key: 'all', ar: 'الكل', en: 'All time' },
    { key: 'custom', ar: 'مخصص', en: 'Custom' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{ar ? 'نظرة عامة' : 'Overview'}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map(r => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? 'default' : 'outline'}
              className={range === r.key ? 'bg-brand-blue hover:bg-brand-blue-dark' : ''}
              onClick={() => setRange(r.key)}
            >
              {ar ? r.ar : r.en}
            </Button>
          ))}
          {range === 'custom' && (
            <span className="flex items-center gap-1.5">
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-[135px]" />
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-[135px]" />
            </span>
          )}
        </div>
      </div>

      {/* ─── KPI cards ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi loading={loading} icon={ClipboardList} color="bg-blue-500" label={ar ? 'حجوزات (في الفترة)' : 'Bookings (in range)'} value={String(kpis.count)} sub={`${kpis.confirmed} ${ar ? 'مؤكد' : 'confirmed'} · ${kpis.needsAction} ${ar ? 'محتاج إجراء' : 'need action'}`} />
        <Kpi loading={loading} icon={Banknote} color="bg-green-500" label={ar ? 'القيمة المحجوزة' : 'Booked value'} value={fmt(kpis.bookedValue)} sub={`${ar ? 'متوسط الحجز' : 'avg booking'} ${fmt(kpis.avg)}`} />
        <Kpi loading={loading} icon={Wallet} color="bg-emerald-600" label={ar ? 'المحصّل' : 'Collected'} value={fmt(kpis.collected)} sub={`${ar ? 'المتبقي' : 'outstanding'} ${fmt(kpis.outstanding)}`} />
        <Kpi loading={loading} icon={Users} color="bg-purple-500" label={ar ? 'المسافرين' : 'Travelers'} value={String(kpis.travelers)} sub={`${customersCount} ${ar ? 'عميل إجمالًا' : 'customers total'}`} />
      </div>

      {/* ─── Attention required ─── */}
      {!loading && attention.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              {ar ? 'محتاج انتباهك' : 'Attention required'}
            </div>
            <ul className="space-y-1 text-sm text-amber-900">
              {attention.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  {ar ? a.ar : a.en}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Upcoming arrivals ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
              <CalendarClock className="h-5 w-5 text-brand-blue" />
              {ar ? 'الوصول القادم' : 'Upcoming arrivals'}
            </h2>
            {loading ? (
              <Loading ar={ar} />
            ) : upcoming.length === 0 ? (
              <Empty text={ar ? 'مفيش وصول قادم' : 'No upcoming arrivals'} />
            ) : (
              <div className="space-y-3">
                {upcoming.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900">{b.customer_name}</div>
                      <div className="text-xs text-gray-500">
                        {b.trip_date} · {b.num_people} {ar ? 'أفراد' : 'pax'}
                        {b.transfer_type ? ` · ${b.transfer_type === 'hiace' ? (ar ? 'هايس' : 'Hiace') : (ar ? 'باص' : 'Bus')}` : ''}
                      </div>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-1 text-xs font-medium', STATUS_LABEL[b.status].cls)}>
                      {ar ? STATUS_LABEL[b.status].ar : STATUS_LABEL[b.status].en}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Recent bookings ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
              <TrendingUp className="h-5 w-5 text-brand-blue" />
              {ar ? 'آخر الحجوزات' : 'Recent bookings'}
            </h2>
            {loading ? (
              <Loading ar={ar} />
            ) : recent.length === 0 ? (
              <Empty text={ar ? 'لا توجد حجوزات بعد' : 'No bookings yet'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start text-gray-500">
                      <th className="pb-3 text-start font-medium">{ar ? 'الاسم' : 'Name'}</th>
                      <th className="pb-3 text-start font-medium">{ar ? 'التاريخ' : 'Date'}</th>
                      <th className="pb-3 text-start font-medium">{ar ? 'القيمة' : 'Value'}</th>
                      <th className="pb-3 text-start font-medium">{ar ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(b => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-3 font-medium text-gray-900">{b.customer_name}</td>
                        <td className="py-3 text-gray-600">{b.trip_date || '—'}</td>
                        <td className="py-3 text-gray-600">{b.total_price ? fmt(Number(b.total_price)) : '—'}</td>
                        <td className="py-3">
                          <span className={cn('rounded-full px-2 py-1 text-xs font-medium', STATUS_LABEL[b.status].cls)}>
                            {ar ? STATUS_LABEL[b.status].ar : STATUS_LABEL[b.status].en}
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
    </div>
  )
}

function Kpi({ loading, icon: Icon, color, label, value, sub }: {
  loading: boolean; icon: typeof Users; color: string; label: string; value: string; sub?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white', color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xl font-bold leading-tight text-gray-900">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
            </div>
            <div className="truncate text-xs text-gray-500">{label}</div>
            {sub && !loading && <div className="truncate text-[11px] text-gray-400">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Loading({ ar }: { ar: boolean }) {
  return (
    <div className="py-8 text-center text-gray-400">
      <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
      {ar ? 'جاري التحميل...' : 'Loading...'}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-gray-400">{text}</div>
}
