'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'

interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  total_bookings: number
  last_booking_at: string | null
  created_at: string
}

export function CustomersManager() {
  const locale = useLocale()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/customers')
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCustomers(data.customers || [])
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل العملاء' : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{locale === 'ar' ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{locale === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
              <TableHead>{locale === 'ar' ? 'البريد' : 'Email'}</TableHead>
              <TableHead>{locale === 'ar' ? 'إجمالي الحجوزات' : 'Total Bookings'}</TableHead>
              <TableHead>{locale === 'ar' ? 'آخر حجز' : 'Last Booking'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </TableCell></TableRow>
            )}
            {!loading && loadError && (
              <TableRow><TableCell colSpan={5} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
            )}
            {!loading && !loadError && customers.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell dir="ltr">{c.phone}</TableCell>
                <TableCell dir="ltr">{c.email || '—'}</TableCell>
                <TableCell>{c.total_bookings}</TableCell>
                <TableCell>{c.last_booking_at ? new Date(c.last_booking_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—'}</TableCell>
              </TableRow>
            ))}
            {!loading && !loadError && customers.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{locale === 'ar' ? 'لا يوجد عملاء بعد' : 'No customers yet'}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
