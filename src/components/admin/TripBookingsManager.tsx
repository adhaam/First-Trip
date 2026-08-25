'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type TripBookingStatus = 'new' | 'contacted' | 'confirmed' | 'completed' | 'cancelled'

interface SinaiTrip { id: string; name_ar: string; name_en: string }

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
type PaymentChannel = 'instapay' | 'vodafonecash' | 'cash' | 'bank_transfer' | 'other'

interface TripBooking {
  id: string
  customer_name: string
  customer_phone: string
  preferred_date: string | null
  num_people: number
  quoted_price: number | null
  final_price: number | null
  status: TripBookingStatus
  payment_status: PaymentStatus | null
  amount_paid: number | null
  payment_channel: PaymentChannel | null
  payment_received_by: string | null
  discount_value: number | null
  discount_type: 'amount' | 'percentage' | null
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

const EMPTY_FORM = { customer_name: '', customer_phone: '', trip_id: '', preferred_date: '', num_people: 1, quoted_price: '', payment_status: 'unpaid' as PaymentStatus, amount_paid: '', payment_channel: '' as string, payment_received_by: '', discount_value: '', discount_type: '' as string }

export function TripBookingsManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [bookings, setBookings] = useState<TripBooking[]>([])
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bookRes, tripRes] = await Promise.all([
        fetch('/api/admin/trip-bookings'),
        fetch('/api/admin/sinai-trips'),
      ])
      if (bookRes.status === 401) { window.location.href = ar ? '/admin' : '/en/admin'; return }
      const bookData = await bookRes.json()
      if (!bookRes.ok) throw new Error(bookData.error)
      setBookings(bookData.tripBookings || [])

      if (tripRes.ok) {
        const tripData = await tripRes.json()
        setTrips(tripData.trips || [])
      }
    } catch {
      setError(ar ? 'تعذر تحميل طلبات الرحلات' : 'Failed to load trip bookings')
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const updateStatus = async (id: string, status: TripBookingStatus) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    await fetch(`/api/admin/trip-bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  const createBooking = async () => {
    setFormError('')
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.trip_id) {
      setFormError(ar ? 'يرجى ملء اسم العميل والهاتف والرحلة' : 'Please fill in customer name, phone, and trip')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/trip-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          trip_id: form.trip_id,
          preferred_date: form.preferred_date || null,
          num_people: form.num_people,
          quoted_price: form.quoted_price ? Number(form.quoted_price) : null,
          payment_status: form.payment_status,
          amount_paid: form.amount_paid ? Number(form.amount_paid) : null,
          payment_channel: form.payment_channel || null,
          payment_received_by: form.payment_received_by || null,
          discount_value: form.discount_value ? Number(form.discount_value) : null,
          discount_type: form.discount_type || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setBookings((prev) => [data.tripBooking, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{ar ? 'طلبات رحلات سيناء' : 'Sinai Trip Bookings'}</h2>
          <p className="text-sm text-gray-500">{ar ? 'الأشخاص اللي طلبوا/حجزوا رحلة — بمعزل عن إدارة الرحلات نفسها' : 'Requests/bookings for trips — separate from managing the trips themselves'}</p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 bg-brand-blue hover:bg-brand-blue-dark text-white"
        >
          {showForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {ar ? 'إضافة حجز يدوي' : 'Add manual booking'}
        </Button>
      </div>

      {/* Manual booking form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{ar ? 'حجز جديد يدوي' : 'New manual booking'}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'اسم العميل *' : 'Customer name *'}</Label>
                <Input
                  placeholder={ar ? 'الاسم الكامل' : 'Full name'}
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'رقم الهاتف *' : 'Phone number *'}</Label>
                <Input
                  dir="ltr"
                  placeholder="+20 10 xxxx xxxx"
                  value={form.customer_phone}
                  onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'الرحلة *' : 'Trip *'}</Label>
                <Select value={form.trip_id} onValueChange={(v) => v && setForm((f) => ({ ...f, trip_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? 'اختر رحلة' : 'Select trip'} />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{ar ? t.name_ar : t.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'التاريخ المفضل' : 'Preferred date'}</Label>
                <Input
                  type="date"
                  value={form.preferred_date}
                  onChange={(e) => setForm((f) => ({ ...f, preferred_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'عدد الأشخاص' : 'Number of people'}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.num_people}
                  onChange={(e) => setForm((f) => ({ ...f, num_people: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'السعر المقترح (ج.م)' : 'Quoted price (EGP)'}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder={ar ? 'اختياري' : 'Optional'}
                  value={form.quoted_price}
                  onChange={(e) => setForm((f) => ({ ...f, quoted_price: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'حالة الدفع' : 'Payment status'}</Label>
                <Select value={form.payment_status} onValueChange={(v) => setForm((f) => ({ ...f, payment_status: v as PaymentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">{ar ? 'غير مدفوع' : 'Unpaid'}</SelectItem>
                    <SelectItem value="partial">{ar ? 'جزئي' : 'Partial'}</SelectItem>
                    <SelectItem value="paid">{ar ? 'مدفوع' : 'Paid'}</SelectItem>
                    <SelectItem value="refunded">{ar ? 'مسترد' : 'Refunded'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'المبلغ المدفوع' : 'Amount paid'}</Label>
                <Input type="number" min={0} placeholder={ar ? 'اختياري' : 'Optional'} value={form.amount_paid} onChange={(e) => setForm((f) => ({ ...f, amount_paid: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'طريقة الدفع' : 'Payment channel'}</Label>
                <Select value={form.payment_channel || '_none'} onValueChange={(v) => setForm((f) => ({ ...f, payment_channel: v === '_none' ? '' : (v ?? '') }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{ar ? 'غير محدد' : 'Not set'}</SelectItem>
                    <SelectItem value="instapay">InstaPay</SelectItem>
                    <SelectItem value="vodafonecash">Vodafone Cash</SelectItem>
                    <SelectItem value="cash">{ar ? 'كاش' : 'Cash'}</SelectItem>
                    <SelectItem value="bank_transfer">{ar ? 'تحويل بنكي' : 'Bank transfer'}</SelectItem>
                    <SelectItem value="other">{ar ? 'أخرى' : 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'استلمها مين' : 'Received by'}</Label>
                <Input placeholder={ar ? 'موظف / فندق / ناقل' : 'Employee / hotel / provider'} value={form.payment_received_by} onChange={(e) => setForm((f) => ({ ...f, payment_received_by: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'خصم' : 'Discount'}</Label>
                <Input type="number" min={0} placeholder={ar ? 'بدون' : 'None'} value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'نوع الخصم' : 'Discount type'}</Label>
                <Select value={form.discount_type || '_none'} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v === '_none' ? '' : (v ?? '') }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{ar ? 'بدون' : 'None'}</SelectItem>
                    <SelectItem value="amount">{ar ? 'مبلغ' : 'Amount'}</SelectItem>
                    <SelectItem value="percentage">{ar ? 'نسبة %' : 'Percentage %'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={createBooking} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {ar ? 'حفظ الحجز' : 'Save booking'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setFormError('') }}>
                {ar ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                <TableHead>{ar ? 'الدفع' : 'Payment'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{ar ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && error && (
                <TableRow><TableCell colSpan={8} className="text-center text-red-500 py-8">{error}</TableCell></TableRow>
              )}
              {!loading && !error && bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.customer_name}</TableCell>
                  <TableCell dir="ltr">{b.customer_phone}</TableCell>
                  <TableCell>{ar ? b.sinai_trips?.name_ar : b.sinai_trips?.name_en}</TableCell>
                  <TableCell>{b.preferred_date || '—'}</TableCell>
                  <TableCell>{b.num_people}</TableCell>
                  <TableCell>{b.final_price ?? b.quoted_price ?? '—'} {ar ? 'ج.م' : 'EGP'}</TableCell>
                  <TableCell className="text-xs">
                    <span className={cn('inline-block rounded px-1.5 py-0.5', b.payment_status === 'paid' ? 'bg-green-100 text-green-700' : b.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600')}>{b.payment_status || 'unpaid'}</span>
                    {b.payment_channel && <span className="block text-gray-400 mt-0.5">{b.payment_channel}{b.payment_received_by ? ` → ${b.payment_received_by}` : ''}</span>}
                  </TableCell>
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
                <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">{ar ? 'لا توجد طلبات رحلات بعد' : 'No trip bookings yet'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
