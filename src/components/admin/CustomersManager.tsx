'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Search, MessageCircle } from 'lucide-react'

interface Customer {
  id: string
  name: string
  phone: string
  normalized_phone: string | null
  whatsapp_phone: string | null
  email: string | null
  total_bookings: number
  last_booking_at: string | null
  last_activity_at: string | null
  preferred_language: 'ar' | 'en'
  notes: string
  created_at: string
}

interface CustomerDetail {
  customer: Customer
  summary: {
    accommodationBookingsCount: number
    tripBookingsCount: number
    merchOrdersCount: number
    rentalsCount: number
    confirmedValue: number
    lastActivityAt: string | null
  }
  accommodationBookings: { id: string; accommodations: { name_ar: string; name_en: string } | null; trip_date: string | null; status: string; total_price: number | null; created_at: string }[]
  tripBookings: { id: string; sinai_trips: { name_ar: string; name_en: string } | null; preferred_date: string | null; status: string; final_price: number | null; quoted_price: number | null; created_at: string }[]
  merchOrders: { id: string; order_number: string; status: string; total_price: number; created_at: string }[]
  rentalOrders: { id: string; order_number: string; status: string; total_price: number; created_at: string }[]
}

export function CustomersManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCustomers(data.customers || [])
    } catch {
      setLoadError(ar ? 'تعذر تحميل العملاء' : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [locale, ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(query || undefined), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/customers/${id}`)
      const data = await res.json()
      if (res.ok) setDetail(data)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? 'دور بالاسم أو رقم الهاتف' : 'Search by name or phone'} className="ps-9" />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{ar ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead>{ar ? 'البريد' : 'Email'}</TableHead>
                <TableHead>{ar ? 'إجمالي الحجوزات' : 'Total Bookings'}</TableHead>
                <TableHead>{ar ? 'آخر نشاط' : 'Last activity'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{ar ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={5} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && customers.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell dir="ltr">{c.phone}</TableCell>
                  <TableCell dir="ltr">{c.email || '—'}</TableCell>
                  <TableCell>{c.total_bookings}</TableCell>
                  <TableCell>{c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—'}</TableCell>
                </TableRow>
              ))}
              {!loading && !loadError && customers.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{ar ? 'لا يوجد عملاء بعد' : 'No customers yet'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail || detailLoading)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
            {detailLoading && !detail ? (
              <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
            ) : detail && (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-lg font-bold text-gray-900">{detail.customer.name}</DialogTitle>
                    <p dir="ltr" className="text-sm text-gray-500">{detail.customer.phone}</p>
                    <p className="text-xs text-gray-400">
                      {ar ? 'عميل منذ' : 'Customer since'} {new Date(detail.customer.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                      {' · '}
                      {ar ? 'اللغة المفضلة' : 'Preferred language'}: {detail.customer.preferred_language}
                    </p>
                  </div>
                  {/* Prefer normalized (E.164) phone — raw `phone` may be local format and would produce a broken wa.me link */}
                  <a href={`https://wa.me/${(detail.customer.whatsapp_phone || detail.customer.normalized_phone || detail.customer.phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: ar ? 'حجوزات الإقامة' : 'Accommodation', value: detail.summary.accommodationBookingsCount },
                    { label: ar ? 'رحلات سيناء' : 'Trip bookings', value: detail.summary.tripBookingsCount },
                    { label: ar ? 'طلبات المتجر' : 'Merch orders', value: detail.summary.merchOrdersCount },
                    { label: ar ? 'الإيجارات' : 'Rentals', value: detail.summary.rentalsCount },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      <p className="text-[11px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mb-5 text-sm font-semibold text-gray-700">
                  {ar ? 'قيمة مؤكدة: ' : 'Confirmed value: '}
                  <span className="text-brand-blue">{detail.summary.confirmedValue.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
                </p>

                <Section title={ar ? 'حجوزات الإقامة' : 'Accommodation bookings'}>
                  {detail.accommodationBookings.map((b) => (
                    <Row key={b.id} left={b.accommodations ? (ar ? b.accommodations.name_ar : b.accommodations.name_en) : '—'} mid={b.status} right={b.total_price ? `${b.total_price} ${ar ? 'ج.م' : 'EGP'}` : '—'} />
                  ))}
                </Section>
                <Section title={ar ? 'رحلات سيناء' : 'Sinai trip bookings'}>
                  {detail.tripBookings.map((b) => (
                    <Row key={b.id} left={b.sinai_trips ? (ar ? b.sinai_trips.name_ar : b.sinai_trips.name_en) : '—'} mid={b.status} right={(b.final_price ?? b.quoted_price) ? `${b.final_price ?? b.quoted_price} ${ar ? 'ج.م' : 'EGP'}` : '—'} />
                  ))}
                </Section>
                <Section title={ar ? 'طلبات المتجر' : 'Merch orders'}>
                  {detail.merchOrders.map((o) => (
                    <Row key={o.id} left={o.order_number} mid={o.status} right={`${o.total_price} ${ar ? 'ج.م' : 'EGP'}`} />
                  ))}
                </Section>
                <Section title={ar ? 'الإيجارات' : 'Rentals'}>
                  {detail.rentalOrders.map((o) => (
                    <Row key={o.id} left={o.order_number} mid={o.status} right={`${o.total_price} ${ar ? 'ج.م' : 'EGP'}`} />
                  ))}
                </Section>
              </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      {hasContent ? <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">{children}</div> : <p className="text-xs text-gray-400">—</p>}
    </div>
  )
}

function Row({ left, mid, right }: { left: string; mid: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="truncate font-medium text-gray-800">{left}</span>
      <span className="shrink-0 text-xs text-gray-500">{mid}</span>
      <span className="shrink-0 font-semibold text-gray-900">{right}</span>
    </div>
  )
}
