'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type TripBookingStatus = 'new' | 'contacted' | 'confirmed' | 'completed' | 'cancelled'

interface TripBooking {
  id: string
  customer_name: string
  customer_phone: string
  preferred_date: string | null
  num_people: number
  quoted_price: number | null
  final_price: number | null
  status: TripBookingStatus
  created_at: string
  sinai_trips: { name_ar: string; name_en: string } | null
}

const STATUS_STYLES: Record<TripBookingStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_LABELS_AR: Record<TripBookingStatus, string> = {
  new: 'جديد', contacted: 'تم التواصل', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي',
}
const STATUS_LABELS_EN: Record<TripBookingStatus, string> = {
  new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled',
}

export function TripBookingsManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [bookings, setBookings] = useState<TripBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/trip-bookings')
      if (res.status === 401) { window.location.href = ar ? '/admin' : '/en/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBookings(data.tripBookings || [])
    } catch {
      setError(ar ? 'تعذر تحميل طلبات الرحلات' : 'Failed to load trip bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateStatus = async (id: string, status: TripBookingStatus) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    await fetch(`/api/admin/trip-bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{ar ? 'طلبات رحلات سيناء' : 'Sinai Trip Bookings'}</h2>
        <p className="text-sm text-gray-500">{ar ? 'الأشخاص اللي طلبوا/حجزوا رحلة — بمعزل عن إدارة الرحلات نفسها' : 'Requests/bookings for trips — separate from managing the trips themselves'}</p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'العميل' : 'Customer'}</TableHead>
                <TableHead>{ar ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead>{ar ? 'الرحلة' : 'Trip'}</TableHead>
                <TableHead>{ar ? 'التاريخ المفضل' : 'Preferred date'}</TableHead>
                <TableHead>{ar ? 'عدد الأشخاص' : 'People'}</TableHead>
                <TableHead>{ar ? 'السعر' : 'Price'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{ar ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && error && (
                <TableRow><TableCell colSpan={7} className="text-center text-red-500 py-8">{error}</TableCell></TableRow>
              )}
              {!loading && !error && bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.customer_name}</TableCell>
                  <TableCell dir="ltr">{b.customer_phone}</TableCell>
                  <TableCell>{ar ? b.sinai_trips?.name_ar : b.sinai_trips?.name_en}</TableCell>
                  <TableCell>{b.preferred_date || '—'}</TableCell>
                  <TableCell>{b.num_people}</TableCell>
                  <TableCell>{b.final_price ?? b.quoted_price ?? '—'} {ar ? 'ج.م' : 'EGP'}</TableCell>
                  <TableCell>
                    <Select value={b.status} onValueChange={(v) => v && updateStatus(b.id, v as TripBookingStatus)}>
                      <SelectTrigger className={cn('w-[120px] h-8 text-xs border-0', STATUS_STYLES[b.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_STYLES) as TripBookingStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{ar ? STATUS_LABELS_AR[s] : STATUS_LABELS_EN[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !error && bookings.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">{ar ? 'لا توجد طلبات رحلات بعد' : 'No trip bookings yet'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
