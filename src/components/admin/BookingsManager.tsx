'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { Booking, BookingStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
}

const STATUS_LABELS: Record<BookingStatus, { ar: string; en: string }> = {
  pending: { ar: 'معلق', en: 'Pending' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  completed: { ar: 'مكتمل', en: 'Completed' },
}

export function BookingsManager() {
  const locale = useLocale()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/bookings')
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBookings(data.bookings || [])
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل الحجوزات' : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateStatus = async (id: string, status: BookingStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || (locale === 'ar' ? 'فشل التحديث' : 'Update failed')); return }
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{locale === 'ar' ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{locale === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
              <TableHead>{locale === 'ar' ? 'النوع' : 'Type'}</TableHead>
              <TableHead>{locale === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
              <TableHead>{locale === 'ar' ? 'الأشخاص' : 'People'}</TableHead>
              <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </TableCell></TableRow>
            )}
            {!loading && loadError && (
              <TableRow><TableCell colSpan={6} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
            )}
            {!loading && !loadError && bookings.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.customer_name}</TableCell>
                <TableCell dir="ltr">{b.customer_phone}</TableCell>
                <TableCell>{b.booking_type}</TableCell>
                <TableCell>{b.trip_date || '—'}</TableCell>
                <TableCell>{b.num_people}</TableCell>
                <TableCell>
                  <Select
                    value={b.status}
                    onValueChange={(v) => v && updateStatus(b.id, v as BookingStatus)}
                    disabled={updatingId === b.id}
                  >
                    <SelectTrigger className={cn('w-[130px] h-8 text-xs border-0', STATUS_STYLES[b.status])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as BookingStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{locale === 'ar' ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {!loading && !loadError && bookings.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">{locale === 'ar' ? 'لا توجد حجوزات بعد' : 'No bookings yet'}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
