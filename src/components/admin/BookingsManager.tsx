'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Loader2, Search, ChevronDown, ChevronUp, SlidersHorizontal, Plus, X,
  Download, RotateCcw, Phone, Mail, MapPin, Users, Calendar, Banknote,
  Package, Bed, Bus, PhoneCall, FileText,
} from 'lucide-react'
import { Booking, BookingStatus, BookingType, Accommodation, TransferType, TransferDirection, MealPlan } from '@/lib/types'
import { cn } from '@/lib/utils'
import { InvoiceViewer } from './InvoiceViewer'

const STATUS_STYLES: Record<BookingStatus, string> = {
  new: 'bg-purple-100 text-purple-700',
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
}

const STATUS_LABELS: Record<BookingStatus, { ar: string; en: string }> = {
  new: { ar: 'جديد', en: 'New' },
  pending: { ar: 'معلق', en: 'Pending' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  completed: { ar: 'مكتمل', en: 'Completed' },
}

const PAYMENT_LABELS: Record<string, { ar: string; en: string; cls: string }> = {
  unpaid: { ar: 'لم يُدفع', en: 'Unpaid', cls: 'bg-red-50 text-red-600' },
  partial: { ar: 'جزئي', en: 'Partial', cls: 'bg-yellow-50 text-yellow-700' },
  paid: { ar: 'مدفوع', en: 'Paid', cls: 'bg-green-50 text-green-700' },
  refunded: { ar: 'مسترد', en: 'Refunded', cls: 'bg-gray-100 text-gray-600' },
}

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  website: { ar: 'الموقع', en: 'Website' },
  manual: { ar: 'يدوي', en: 'Manual' },
  whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  instagram: { ar: 'انستجرام', en: 'Instagram' },
  facebook: { ar: 'فيسبوك', en: 'Facebook' },
  referral: { ar: 'ترشيح', en: 'Referral' },
  other: { ar: 'أخرى', en: 'Other' },
}

const TYPE_LABELS: Record<BookingType, { ar: string; en: string; icon: typeof Package }> = {
  'package': { ar: 'باكدج كامل', en: 'Full package', icon: Package },
  'accommodation-only': { ar: 'إقامة بس', en: 'Stay only', icon: Bed },
  'transfer-only': { ar: 'انتقالات بس', en: 'Transfer only', icon: Bus },
}

type ColumnKey =
  | 'email' | 'type' | 'accommodation' | 'governorate' | 'dates'
  | 'people' | 'transfer' | 'price' | 'source' | 'created'

const ALL_COLUMNS: { key: ColumnKey; label_ar: string; label_en: string }[] = [
  { key: 'email', label_ar: 'الإيميل', label_en: 'Email' },
  { key: 'type', label_ar: 'النوع', label_en: 'Type' },
  { key: 'accommodation', label_ar: 'الفندق/الإقامة', label_en: 'Accommodation' },
  { key: 'governorate', label_ar: 'المحافظة', label_en: 'Governorate' },
  { key: 'dates', label_ar: 'التواريخ', label_en: 'Dates' },
  { key: 'people', label_ar: 'الأشخاص', label_en: 'People' },
  { key: 'transfer', label_ar: 'الانتقال', label_en: 'Transfer' },
  { key: 'price', label_ar: 'السعر', label_en: 'Price' },
  { key: 'source', label_ar: 'المصدر', label_en: 'Source' },
  { key: 'created', label_ar: 'تاريخ الإنشاء', label_en: 'Created' },
]

const DEFAULT_VISIBLE: ColumnKey[] = ['type', 'accommodation', 'dates', 'people', 'price', 'source']

/** Shape returned by /api/admin/quote — the same lines the invoice will show. */
interface AdminQuote {
  lines: {
    key: string
    label_ar: string
    label_en: string
    detail_ar?: string
    detail_en?: string
    amount: number
  }[]
  num_people: number
  per_person: number
  total: number
  is_priced: boolean
}

const emptyManual = {
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  booking_type: 'package' as BookingType,
  accommodation_id: '',
  governorate: '',
  trip_date: '',
  return_date: '',
  duration: 4,
  nights: 2,
  transfer_type: 'hiace' as TransferType,
  transfer_direction: 'round_trip' as TransferDirection,
  room_type: '' as '' | 'double' | 'single' | 'triple',
  meal_plan_key: '',
  num_people: 2,
  notes: '',
  status: 'confirmed' as BookingStatus,
  total_price: undefined as number | undefined,
  /** Employee took manual control of the price — stops auto-fill from overwriting it. */
  price_override: false,
  price_override_reason: '',
  source: 'manual',
  payment_status: 'unpaid',
  amount_paid: undefined as number | undefined,
}

export function BookingsManager() {
  const locale = useLocale()
  const ar = locale === 'ar'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // ─── filters ───
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterAccommodation, setFilterAccommodation] = useState('all')
  const [filterGovernorate, setFilterGovernorate] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // ─── columns ───
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(DEFAULT_VISIBLE))
  const [colsOpen, setColsOpen] = useState(false)

  // ─── manual add ───
  const [showAdd, setShowAdd] = useState(false)
  const [manual, setManual] = useState(emptyManual)
  const [savingManual, setSavingManual] = useState(false)
  const [manualError, setManualError] = useState('')

  // ─── live price preview ───
  //
  // The result is stored WITH the input key that produced it. A result is
  // only shown while it still matches the current inputs, so changing a
  // field can never leave a stale total on screen looking authoritative
  // during the debounce window.
  const [quoteState, setQuoteState] = useState<
    { key: string; data: AdminQuote | null; error: string } | null
  >(null)

  // ─── invoice viewer ───
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null)
  const [invoiceBookingNumber, setInvoiceBookingNumber] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [bRes, aRes] = await Promise.all([
        fetch('/api/admin/bookings'),
        fetch('/api/admin/accommodations'),
      ])
      if (bRes.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const bData = await bRes.json()
      if (!bRes.ok) throw new Error(bData.error)
      setBookings(bData.bookings || [])
      if (aRes.ok) {
        const aData = await aRes.json()
        setAccommodations(aData.accommodations || [])
      }
    } catch {
      setLoadError(ar ? 'تعذر تحميل الحجوزات' : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── live price preview ───
  //
  // Only the fields that actually move the price go into this key, so typing
  // a customer's name or a note never triggers a request. The key doubles as
  // the effect dependency and as the "did anything meaningful change" test,
  // which is what keeps this from recalculating on every keystroke.
  const quoteKey = useMemo(() => {
    if (!showAdd) return null
    // A quote is priced against a date; without one there is nothing to ask.
    if (!manual.trip_date) return null
    if (manual.booking_type !== 'transfer-only' && !manual.accommodation_id) return null

    const payload: Record<string, unknown> = {
      booking_type: manual.booking_type,
      start_date: manual.trip_date,
      num_people: Number(manual.num_people) || 1,
    }
    if (manual.booking_type !== 'transfer-only') {
      payload.accommodation_id = manual.accommodation_id
      if (manual.room_type) payload.room_type = manual.room_type
      if (manual.meal_plan_key) payload.meal_plan_key = manual.meal_plan_key
    }
    if (manual.booking_type === 'package') payload.duration = Number(manual.duration)
    if (manual.booking_type === 'accommodation-only') payload.nights = Number(manual.nights)
    if (manual.booking_type === 'transfer-only' || manual.booking_type === 'package') {
      payload.transfer_type = manual.transfer_type
      payload.transfer_direction = manual.transfer_direction
      if (manual.governorate) payload.governorate = manual.governorate
    }
    return JSON.stringify(payload)
  }, [
    showAdd, manual.booking_type, manual.trip_date, manual.num_people,
    manual.accommodation_id, manual.room_type, manual.meal_plan_key,
    manual.duration, manual.nights, manual.transfer_type,
    manual.transfer_direction, manual.governorate,
  ])

  useEffect(() => {
    if (!quoteKey) return
    // Already have the answer for these exact inputs — nothing to recompute.
    if (quoteState?.key === quoteKey) return

    // Debounced so dragging a number input doesn't fire a request per tick.
    const timer = setTimeout(async () => {
      const failure = ar ? 'تعذر حساب السعر' : 'Could not calculate the price'
      try {
        const res = await fetch('/api/admin/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: quoteKey,
        })
        const data = await res.json()
        setQuoteState(res.ok
          ? { key: quoteKey, data, error: '' }
          : { key: quoteKey, data: null, error: data.error || failure })
      } catch {
        setQuoteState({ key: quoteKey, data: null, error: failure })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [quoteKey, quoteState?.key, ar])

  const quoteMatches = quoteState !== null && quoteState.key === quoteKey
  const quote = quoteMatches ? quoteState.data : null
  const quoteError = quoteMatches ? quoteState.error : ''
  const quoteLoading = quoteKey !== null && !quoteMatches

  // The price is DERIVED, not mirrored into state: the quote is the total
  // unless the employee has taken manual control. Copying it into `manual`
  // on every quote would mean two sources of truth that have to be kept in
  // sync, which is exactly how a stale total ends up on a booking.
  const effectiveTotal = manual.price_override
    ? manual.total_price
    : quote?.total

  const selectedAccommodation = useMemo(
    () => accommodations.find(a => a.id === manual.accommodation_id) || null,
    [accommodations, manual.accommodation_id],
  )
  const mealPlans = useMemo<MealPlan[]>(
    () => (selectedAccommodation?.meal_plans || []).filter(m => m.is_active),
    [selectedAccommodation],
  )

  const accName = (id?: string | null, joined?: Booking['accommodations']) => {
    if (joined) return ar ? joined.name_ar : joined.name_en
    const acc = accommodations.find(a => a.id === id)
    if (!acc) return '—'
    return ar ? acc.name_ar : acc.name_en
  }

  const governorates = useMemo(() => {
    const set = new Set<string>()
    bookings.forEach(b => { if (b.governorate) set.add(b.governorate) })
    return Array.from(set).sort()
  }, [bookings])

  const patchBooking = async (id: string, patch: Record<string, unknown>) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return false }
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || (ar ? 'فشل التحديث' : 'Update failed')); return false }
      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
      return true
    } finally {
      setUpdatingId(null)
    }
  }

  const updateStatus = (id: string, status: BookingStatus) => patchBooking(id, { status })

  const deleteBooking = async (id: string) => {
    if (!confirm(ar ? 'متأكد من حذف الحجز؟' : 'Delete this booking?')) return
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' })
    if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
    if (!res.ok) { alert(ar ? 'فشل الحذف' : 'Delete failed'); return }
    setBookings(prev => prev.filter(b => b.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter(b => {
      if (q) {
        const hay = `${b.customer_name} ${b.customer_phone} ${b.customer_email || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterType !== 'all' && b.booking_type !== filterType) return false
      if (filterStatus !== 'all' && b.status !== filterStatus) return false
      if (filterSource !== 'all' && (b.source || 'website') !== filterSource) return false
      if (filterAccommodation !== 'all' && b.accommodation_id !== filterAccommodation) return false
      if (filterGovernorate !== 'all' && b.governorate !== filterGovernorate) return false
      if (dateFrom && (!b.trip_date || b.trip_date < dateFrom)) return false
      if (dateTo && (!b.trip_date || b.trip_date > dateTo)) return false
      return true
    })
  }, [bookings, search, filterType, filterStatus, filterSource, filterAccommodation, filterGovernorate, dateFrom, dateTo])

  const stats = useMemo(() => {
    // "Booked value" is NOT revenue — it's the total of non-cancelled booking
    // totals. What was actually collected lives in amount_paid.
    const active = filtered.filter(b => b.status !== 'cancelled')
    const bookedValue = active.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0)
    const collected = active.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0)
    const needsAction = filtered.filter(b => b.status === 'new' || b.status === 'pending').length
    return { count: filtered.length, bookedValue, collected, outstanding: bookedValue - collected, needsAction }
  }, [filtered])

  const clearFilters = () => {
    setSearch(''); setFilterType('all'); setFilterStatus('all'); setFilterSource('all')
    setFilterAccommodation('all'); setFilterGovernorate('all'); setDateFrom(''); setDateTo('')
  }

  const hasActiveFilters = Boolean(
    search || filterType !== 'all' || filterStatus !== 'all' || filterSource !== 'all' ||
    filterAccommodation !== 'all' || filterGovernorate !== 'all' || dateFrom || dateTo,
  )

  const toggleCol = (key: ColumnKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportCSV = () => {
    const headers = [
      'Name', 'Phone', 'Email', 'Type', 'Accommodation', 'Governorate',
      'Trip date', 'Return date', 'People', 'Transfer type', 'Transfer direction',
      'Room type', 'Meal plan', 'Price', 'Payment status', 'Amount paid', 'Remaining',
      'Status', 'Source', 'Notes', 'Created at',
    ]
    const rows = filtered.map(b => [
      b.customer_name, b.customer_phone, b.customer_email || '',
      TYPE_LABELS[b.booking_type]?.en || b.booking_type,
      accName(b.accommodation_id, b.accommodations),
      b.governorate || '', b.trip_date || '', b.return_date || '',
      String(b.num_people), b.transfer_type || '', b.transfer_direction || '',
      b.room_type || '', b.meal_plan_key || '',
      b.total_price ? String(b.total_price) : '',
      b.payment_status || 'unpaid', String(b.amount_paid ?? 0),
      String((Number(b.total_price) || 0) - (Number(b.amount_paid) || 0)),
      b.status, b.source || 'website',
      (b.notes || '').replace(/\n/g, ' '), b.created_at,
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const submitManual = async () => {
    setManualError('')
    if (!manual.customer_name || !manual.customer_phone) {
      setManualError(ar ? 'الاسم والموبايل مطلوبين' : 'Name and phone are required')
      return
    }
    setSavingManual(true)
    try {
      const payload: Record<string, unknown> = {
        customer_name: manual.customer_name,
        customer_phone: manual.customer_phone,
        customer_email: manual.customer_email || undefined,
        booking_type: manual.booking_type,
        num_people: Number(manual.num_people) || 1,
        notes: manual.notes || undefined,
        status: manual.status,
      }
      if (manual.booking_type !== 'transfer-only' && manual.accommodation_id) {
        payload.accommodation_id = manual.accommodation_id
      }
      if (manual.governorate) payload.governorate = manual.governorate
      if (manual.trip_date) payload.trip_date = manual.trip_date
      if (manual.return_date) payload.return_date = manual.return_date
      if (manual.booking_type === 'package') payload.duration = Number(manual.duration)
      if (manual.booking_type === 'accommodation-only') payload.nights = Number(manual.nights)
      if (manual.booking_type === 'transfer-only' || manual.booking_type === 'package') {
        payload.transfer_type = manual.transfer_type
        payload.transfer_direction = manual.transfer_direction
      }
      if (manual.booking_type !== 'transfer-only' && manual.room_type) payload.room_type = manual.room_type
      if (manual.booking_type !== 'transfer-only' && manual.meal_plan_key) {
        payload.meal_plan_key = manual.meal_plan_key
      }
      // Only an explicit override sends a price; otherwise the server's own
      // calculation is authoritative. effectiveTotal still covers the case
      // where no quote was possible (no date) and the employee typed a total.
      if (manual.price_override) {
        payload.price_override = true
        if (effectiveTotal !== undefined) payload.total_price = Number(effectiveTotal)
        if (manual.price_override_reason) payload.price_override_reason = manual.price_override_reason
      }
      payload.source = manual.source
      payload.payment_status = manual.payment_status
      if (manual.amount_paid) payload.amount_paid = Number(manual.amount_paid)

      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) {
        setManualError(data.error || (ar ? 'فشل الحفظ' : 'Save failed'))
        return
      }
      setBookings(prev => [data.booking, ...prev])
      if (data.pricing_warning) {
        // Saved, but the price could not be derived — say so rather than
        // letting the employee assume the total was calculated.
        alert(ar
          ? `الحجز اتحفظ، بس تعذر حساب السعر تلقائياً: ${data.pricing_warning}`
          : `Booking saved, but the price could not be calculated: ${data.pricing_warning}`)
      }
      setShowAdd(false)
      setManual(emptyManual)
    } finally {
      setSavingManual(false)
    }
  }

  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return iso }
  }

  return (
    <div className="space-y-5">
      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={ar ? 'الحجوزات (مفلترة)' : 'Bookings (filtered)'} value={String(stats.count)} icon={Users} />
        <StatCard label={ar ? 'القيمة المحجوزة' : 'Booked value'} value={`${stats.bookedValue.toLocaleString()} ج.م`} icon={Banknote} />
        <StatCard label={ar ? 'المحصّل' : 'Collected'} value={`${stats.collected.toLocaleString()} ج.م`} icon={PhoneCall} tone="info" />
        <StatCard label={ar ? 'محتاجة إجراء' : 'Needs action'} value={String(stats.needsAction)} icon={Calendar} tone="warn" />
      </div>

      {/* ─── Toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={ar ? 'اسم، موبايل، إيميل...' : 'Name, phone, email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder={ar ? 'النوع' : 'Type'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? 'كل الأنواع' : 'All types'}</SelectItem>
            {(Object.keys(TYPE_LABELS) as BookingType[]).map(t => (
              <SelectItem key={t} value={t}>{ar ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder={ar ? 'الحالة' : 'Status'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? 'كل الحالات' : 'All statuses'}</SelectItem>
            {(Object.keys(STATUS_LABELS) as BookingStatus[]).map(s => (
              <SelectItem key={s} value={s}>{ar ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAccommodation} onValueChange={(v) => v && setFilterAccommodation(v)}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder={ar ? 'الإقامة' : 'Accommodation'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? 'كل الأماكن' : 'All places'}</SelectItem>
            {accommodations.map(a => (
              <SelectItem key={a.id} value={a.id}>{ar ? a.name_ar : a.name_en}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {governorates.length > 0 && (
          <Select value={filterGovernorate} onValueChange={(v) => v && setFilterGovernorate(v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={ar ? 'المحافظة' : 'Governorate'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? 'كل المحافظات' : 'All governorates'}</SelectItem>
              {governorates.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filterSource} onValueChange={(v) => v && setFilterSource(v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder={ar ? 'المصدر' : 'Source'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? 'كل المصادر' : 'All sources'}</SelectItem>
            {Object.keys(SOURCE_LABELS).map(s => (
              <SelectItem key={s} value={s}>{ar ? SOURCE_LABELS[s].ar : SOURCE_LABELS[s].en}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px]" title={ar ? 'من تاريخ' : 'From date'} />
          <span className="text-gray-400 text-xs">{ar ? 'إلى' : 'to'}</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px]" title={ar ? 'إلى تاريخ' : 'To date'} />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-gray-500">
            <RotateCcw className="h-3.5 w-3.5" />
            {ar ? 'مسح الفلاتر' : 'Clear'}
          </Button>
        )}

        <div className="flex-1" />

        {/* Column visibility */}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setColsOpen(v => !v)} className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {ar ? 'الأعمدة' : 'Columns'}
          </Button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setColsOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-white p-2 shadow-lg">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                      className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                    />
                    {ar ? col.label_ar : col.label_en}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>

        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-brand-blue hover:bg-brand-blue-dark gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {ar ? 'حجز يدوي' : 'Manual booking'}
        </Button>
      </div>

      {/* ─── Table ─── */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{ar ? 'الهاتف' : 'Phone'}</TableHead>
                {visibleCols.has('email') && <TableHead>{ar ? 'الإيميل' : 'Email'}</TableHead>}
                {visibleCols.has('type') && <TableHead>{ar ? 'النوع' : 'Type'}</TableHead>}
                {visibleCols.has('accommodation') && <TableHead>{ar ? 'الفندق/الإقامة' : 'Accommodation'}</TableHead>}
                {visibleCols.has('governorate') && <TableHead>{ar ? 'المحافظة' : 'Governorate'}</TableHead>}
                {visibleCols.has('dates') && <TableHead>{ar ? 'التواريخ' : 'Dates'}</TableHead>}
                {visibleCols.has('people') && <TableHead>{ar ? 'الأشخاص' : 'People'}</TableHead>}
                {visibleCols.has('transfer') && <TableHead>{ar ? 'الانتقال' : 'Transfer'}</TableHead>}
                {visibleCols.has('price') && <TableHead>{ar ? 'السعر' : 'Price'}</TableHead>}
                {visibleCols.has('source') && <TableHead>{ar ? 'المصدر' : 'Source'}</TableHead>}
                {visibleCols.has('created') && <TableHead>{ar ? 'تاريخ الإنشاء' : 'Created'}</TableHead>}
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={14} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{ar ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={14} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && filtered.map(b => {
                const isOpen = expandedId === b.id
                const TypeIcon = TYPE_LABELS[b.booking_type]?.icon || Package
                return (
                  <Fragment key={b.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedId(isOpen ? null : b.id)}
                    >
                      <TableCell>{isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</TableCell>
                      <TableCell className="font-medium">{b.customer_name}</TableCell>
                      <TableCell dir="ltr">{b.customer_phone}</TableCell>
                      {visibleCols.has('email') && <TableCell className="text-xs text-gray-500">{b.customer_email || '—'}</TableCell>}
                      {visibleCols.has('type') && (
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs">
                            <TypeIcon className="h-3.5 w-3.5 text-gray-400" />
                            {ar ? TYPE_LABELS[b.booking_type]?.ar : TYPE_LABELS[b.booking_type]?.en}
                          </span>
                        </TableCell>
                      )}
                      {visibleCols.has('accommodation') && <TableCell className="text-sm">{accName(b.accommodation_id, b.accommodations)}</TableCell>}
                      {visibleCols.has('governorate') && <TableCell className="text-sm">{b.governorate || '—'}</TableCell>}
                      {visibleCols.has('dates') && <TableCell className="text-xs whitespace-nowrap">{fmtDate(b.trip_date)}{b.return_date ? ` → ${fmtDate(b.return_date)}` : ''}</TableCell>}
                      {visibleCols.has('people') && <TableCell>{b.num_people}</TableCell>}
                      {visibleCols.has('transfer') && (
                        <TableCell className="text-xs">
                          {b.transfer_type ? (b.transfer_type === 'hiace' ? (ar ? 'هايس' : 'Hiace') : (ar ? 'باص' : 'Bus')) : '—'}
                        </TableCell>
                      )}
                      {visibleCols.has('price') && <TableCell className="font-medium">{b.total_price ? `${Number(b.total_price).toLocaleString()} ج.م` : '—'}</TableCell>}
                      {visibleCols.has('source') && (
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', b.source === 'website' ? 'border-sky-300 text-sky-700' : 'border-purple-300 text-purple-700')}>
                            {(() => { const s = SOURCE_LABELS[b.source || 'website'] || SOURCE_LABELS.other; return ar ? s.ar : s.en })()}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleCols.has('created') && <TableCell className="text-xs text-gray-500 whitespace-nowrap">{fmtDate(b.created_at?.split('T')[0])}</TableCell>}
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select
                          value={b.status}
                          onValueChange={(v) => v && updateStatus(b.id, v as BookingStatus)}
                          disabled={updatingId === b.id}
                        >
                          <SelectTrigger className={cn('w-[120px] h-8 text-xs border-0', STATUS_STYLES[b.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_LABELS) as BookingStatus[]).map(s => (
                              <SelectItem key={s} value={s}>{ar ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${b.id}-detail`}>
                        <TableCell colSpan={14} className="bg-gray-50 p-0">
                          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                            <DetailField icon={Phone} label={ar ? 'الموبايل' : 'Phone'} value={b.customer_phone} dir="ltr" />
                            <DetailField icon={Mail} label={ar ? 'الإيميل' : 'Email'} value={b.customer_email || '—'} dir="ltr" />
                            <DetailField label={ar ? 'نوع الحجز' : 'Booking type'} value={ar ? TYPE_LABELS[b.booking_type]?.ar : TYPE_LABELS[b.booking_type]?.en} />
                            <DetailField label={ar ? 'الفندق/الإقامة' : 'Accommodation'} value={accName(b.accommodation_id, b.accommodations)} />
                            <DetailField icon={MapPin} label={ar ? 'المحافظة' : 'Governorate'} value={b.governorate || '—'} />
                            <DetailField icon={Calendar} label={ar ? 'تاريخ الذهاب' : 'Trip date'} value={fmtDate(b.trip_date)} />
                            <DetailField icon={Calendar} label={ar ? 'تاريخ العودة' : 'Return date'} value={fmtDate(b.return_date)} />
                            <DetailField label={ar ? 'المدة' : 'Duration'} value={b.duration ? `${b.duration} ${ar ? 'أيام' : 'days'}` : (b.nights ? `${b.nights} ${ar ? 'ليالي' : 'nights'}` : '—')} />
                            <DetailField icon={Users} label={ar ? 'عدد الأشخاص' : 'People'} value={String(b.num_people)} />
                            <DetailField label={ar ? 'نوع الانتقال' : 'Transfer type'} value={b.transfer_type ? (b.transfer_type === 'hiace' ? (ar ? 'هايس خاص' : 'Private Hiace') : (ar ? 'باص جماعي' : 'Shared bus')) : '—'} />
                            <DetailField label={ar ? 'اتجاه الانتقال' : 'Transfer direction'} value={
                              b.transfer_direction === 'round_trip' ? (ar ? 'ذهاب وعودة' : 'Round trip')
                              : b.transfer_direction === 'to_dahab' ? (ar ? 'لدهب' : 'To Dahab')
                              : b.transfer_direction === 'from_dahab' ? (ar ? 'من دهب' : 'From Dahab') : '—'
                            } />
                            <DetailField label={ar ? 'نوع الغرفة' : 'Room type'} value={b.room_type === 'single' ? (ar ? 'سينجل' : 'Single') : b.room_type === 'triple' ? (ar ? 'تريبل' : 'Triple') : b.room_type === 'double' ? (ar ? 'دبل' : 'Double') : '—'} />
                            <DetailField label={ar ? 'نوع الإقامة' : 'Meal plan'} value={b.meal_plan_key || '—'} />
                            <DetailField label={ar ? 'رحلات إضافية' : 'Extra trips'} value={b.extra_trip_ids?.length ? String(b.extra_trip_ids.length) : '—'} />
                            <DetailField icon={Banknote} label={ar ? 'السعر الإجمالي' : 'Total price'} value={b.total_price ? `${Number(b.total_price).toLocaleString()} ج.م` : '—'} />
                            <DetailField label={ar ? 'المصدر' : 'Source'} value={(() => { const s = SOURCE_LABELS[b.source || 'website'] || SOURCE_LABELS.other; return ar ? s.ar : s.en })()} />
                            <DetailField label={ar ? 'تاريخ الإنشاء' : 'Created at'} value={b.created_at ? new Date(b.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB') : '—'} />

                            {/* ─── Payment tracking (manual, no gateway) ─── */}
                            <div className="col-span-2 md:col-span-4 rounded-lg border bg-white p-4">
                              <div className="mb-3 text-xs font-semibold text-gray-500">{ar ? 'الدفع' : 'Payment'}</div>
                              <div className="flex flex-wrap items-end gap-4">
                                <div>
                                  <Label className="text-xs text-gray-500">{ar ? 'حالة الدفع' : 'Payment status'}</Label>
                                  <Select
                                    value={b.payment_status || 'unpaid'}
                                    onValueChange={(v) => v && patchBooking(b.id, { payment_status: v })}
                                    disabled={updatingId === b.id}
                                  >
                                    <SelectTrigger className={cn('mt-1 h-8 w-[130px] text-xs border-0', PAYMENT_LABELS[b.payment_status || 'unpaid']?.cls)}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.keys(PAYMENT_LABELS).map(p => (
                                        <SelectItem key={p} value={p}>{ar ? PAYMENT_LABELS[p].ar : PAYMENT_LABELS[p].en}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">{ar ? 'المبلغ المدفوع' : 'Amount paid'}</Label>
                                  <Input
                                    type="number" min={0} dir="ltr"
                                    className="mt-1 h-8 w-[120px]"
                                    defaultValue={b.amount_paid ?? 0}
                                    onBlur={e => {
                                      const v = Number(e.target.value) || 0
                                      if (v !== Number(b.amount_paid || 0)) patchBooking(b.id, { amount_paid: v })
                                    }}
                                  />
                                </div>
                                <div className="text-sm">
                                  <span className="text-xs text-gray-500">{ar ? 'المتبقي: ' : 'Remaining: '}</span>
                                  <span className={cn('font-semibold', (Number(b.total_price) || 0) - (Number(b.amount_paid) || 0) > 0 ? 'text-red-600' : 'text-green-600')}>
                                    {((Number(b.total_price) || 0) - (Number(b.amount_paid) || 0)).toLocaleString()} ج.م
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* ─── Frozen price breakdown (snapshot at booking time) ─── */}
                            {b.price_snapshot && (
                              <div className="col-span-2 md:col-span-4 rounded-lg border bg-white p-4">
                                <div className="mb-2 text-xs font-semibold text-gray-500">
                                  {ar ? 'تفاصيل السعر (وقت الحجز — مش بتتغير أبدًا)' : 'Price breakdown (frozen at booking time)'}
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                                  {b.price_snapshot.accommodation_subtotal != null && (
                                    <div>{ar ? 'الإقامة: ' : 'Accommodation: '}<b>{Number(b.price_snapshot.accommodation_subtotal).toLocaleString()}</b></div>
                                  )}
                                  {b.price_snapshot.transfer_subtotal != null && (
                                    <div>{ar ? 'الانتقالات: ' : 'Transfers: '}<b>{Number(b.price_snapshot.transfer_subtotal).toLocaleString()}</b></div>
                                  )}
                                  {b.price_snapshot.included_trips_subtotal != null && (
                                    <div>{ar ? 'الرحلات المشمولة: ' : 'Included trips: '}<b>{Number(b.price_snapshot.included_trips_subtotal).toLocaleString()}</b></div>
                                  )}
                                  {(b.price_snapshot.meal_subtotal ?? 0) > 0 && (
                                    <div>{ar ? 'الوجبات: ' : 'Meals: '}<b>{Number(b.price_snapshot.meal_subtotal).toLocaleString()}</b></div>
                                  )}
                                  {(b.price_snapshot.extra_trips_subtotal ?? 0) > 0 && (
                                    <div>{ar ? 'رحلات إضافية: ' : 'Extra trips: '}<b>{Number(b.price_snapshot.extra_trips_subtotal).toLocaleString()}</b></div>
                                  )}
                                  <div>{ar ? 'الإجمالي: ' : 'Total: '}<b>{Number(b.price_snapshot.total).toLocaleString()}</b></div>
                                </div>
                                {!!b.price_snapshot.nightly_room_rates?.length && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {b.price_snapshot.nightly_room_rates.map(n => (
                                      <span key={n.date} className={cn('rounded px-1.5 py-0.5 text-[11px]', n.source === 'seasonal' ? 'bg-sun-400/15 text-sun-600' : 'bg-gray-100 text-gray-600')} title={n.seasonal_rate_name || (ar ? 'سعر أساسي' : 'Base rate')}>
                                        {n.date}: {Number(n.rate).toLocaleString()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="col-span-2 md:col-span-4">
                              <div className="text-xs font-semibold text-gray-500 mb-1">{ar ? 'ملاحظات' : 'Notes'}</div>
                              <div className="text-sm text-gray-800 whitespace-pre-wrap">{b.notes || '—'}</div>
                            </div>
                            <div className="col-span-2 md:col-span-4">
                              <Label className="text-xs font-semibold text-gray-500">{ar ? 'ملاحظات داخلية (للإدارة فقط)' : 'Internal notes (admin only)'}</Label>
                              <Textarea
                                className="mt-1 text-sm"
                                rows={2}
                                defaultValue={b.internal_notes || ''}
                                onBlur={e => {
                                  const v = e.target.value
                                  if (v !== (b.internal_notes || '')) patchBooking(b.id, { internal_notes: v })
                                }}
                              />
                            </div>
                            <div className="col-span-2 md:col-span-4 flex justify-end gap-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInvoiceBookingId(b.id)
                                  setInvoiceBookingNumber(`BK-${b.id.slice(0, 8).toUpperCase()}`)
                                  setInvoiceOpen(true)
                                }}
                                className="gap-1.5"
                              >
                                <FileText className="h-4 w-4" />
                                {ar ? 'فاتورة' : 'Invoice'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteBooking(b.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                {ar ? 'حذف الحجز' : 'Delete booking'}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow><TableCell colSpan={14} className="text-center text-gray-400 py-8">{ar ? 'لا توجد حجوزات مطابقة' : 'No matching bookings'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── Manual booking modal ─── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl my-8">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {ar ? 'إضافة حجز يدوي' : 'Add Manual Booking'}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowAdd(false); setManualError('') }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-sm text-gray-500 -mt-2">
                {ar ? 'لأي حجز جالك على التليفون أو الواتساب — يتسجل هنا وتفضل الداشبورد فيها كل الحجوزات.' : 'For any booking that came by phone or WhatsApp — log it here so the dashboard stays the single source of truth.'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{ar ? 'اسم العميل' : 'Customer name'}</Label>
                  <Input value={manual.customer_name} onChange={e => setManual(m => ({ ...m, customer_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'الموبايل' : 'Phone'}</Label>
                  <Input dir="ltr" value={manual.customer_phone} onChange={e => setManual(m => ({ ...m, customer_phone: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'الإيميل (اختياري)' : 'Email (optional)'}</Label>
                  <Input dir="ltr" type="email" value={manual.customer_email} onChange={e => setManual(m => ({ ...m, customer_email: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'نوع الحجز' : 'Booking type'}</Label>
                  <Select value={manual.booking_type} onValueChange={v => v && setManual(m => ({ ...m, booking_type: v as BookingType }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as BookingType[]).map(t => (
                        <SelectItem key={t} value={t}>{ar ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {manual.booking_type !== 'transfer-only' && (
                  <div className="md:col-span-2">
                    <Label>{ar ? 'الفندق/الإقامة' : 'Accommodation'}</Label>
                    <Select value={manual.accommodation_id} onValueChange={v => v && setManual(m => ({ ...m, accommodation_id: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={ar ? 'اختر مكان الإقامة' : 'Select accommodation'} /></SelectTrigger>
                      <SelectContent>
                        {accommodations.map(a => (
                          <SelectItem key={a.id} value={a.id}>{ar ? a.name_ar : a.name_en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {manual.booking_type === 'package' && (
                  <div>
                    <Label>{ar ? 'المدة' : 'Duration'}</Label>
                    <Select value={String(manual.duration)} onValueChange={v => v && setManual(m => ({ ...m, duration: Number(v) }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 {ar ? 'أيام' : 'days'}</SelectItem>
                        <SelectItem value="5">5 {ar ? 'أيام' : 'days'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {manual.booking_type === 'accommodation-only' && (
                  <div>
                    <Label>{ar ? 'عدد الليالي' : 'Nights'}</Label>
                    <Input type="number" min={1} value={manual.nights} onChange={e => setManual(m => ({ ...m, nights: Number(e.target.value) }))} className="mt-1" />
                  </div>
                )}
                {(manual.booking_type === 'transfer-only' || manual.booking_type === 'package') && (
                  <>
                    <div>
                      <Label>{ar ? 'نوع الانتقال' : 'Transfer type'}</Label>
                      <Select value={manual.transfer_type} onValueChange={v => v && setManual(m => ({ ...m, transfer_type: v as TransferType }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hiace">{ar ? 'هايس خاص' : 'Private Hiace'}</SelectItem>
                          <SelectItem value="package_bus">{ar ? 'باص جماعي' : 'Shared bus'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{ar ? 'الاتجاه' : 'Direction'}</Label>
                      <Select value={manual.transfer_direction} onValueChange={v => v && setManual(m => ({ ...m, transfer_direction: v as TransferDirection }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round_trip">{ar ? 'ذهاب وعودة' : 'Round trip'}</SelectItem>
                          <SelectItem value="to_dahab">{ar ? 'لدهب' : 'To Dahab'}</SelectItem>
                          <SelectItem value="from_dahab">{ar ? 'من دهب' : 'From Dahab'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div>
                  <Label>{ar ? 'المحافظة' : 'Governorate'}</Label>
                  <Input value={manual.governorate} onChange={e => setManual(m => ({ ...m, governorate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'عدد الأشخاص' : 'Number of people'}</Label>
                  <Input type="number" min={1} value={manual.num_people} onChange={e => setManual(m => ({ ...m, num_people: Number(e.target.value) }))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'تاريخ الذهاب' : 'Trip date'}</Label>
                  <Input type="date" value={manual.trip_date} onChange={e => setManual(m => ({ ...m, trip_date: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'تاريخ العودة (اختياري)' : 'Return date (optional)'}</Label>
                  <Input type="date" value={manual.return_date} onChange={e => setManual(m => ({ ...m, return_date: e.target.value }))} className="mt-1" />
                </div>
                {manual.booking_type !== 'transfer-only' && (
                  <div>
                    <Label>{ar ? 'نوع الغرفة' : 'Room type'}</Label>
                    <Select value={manual.room_type || 'none'} onValueChange={v => v && setManual(m => ({ ...m, room_type: v === 'none' ? '' : v as 'double' | 'single' | 'triple' }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{ar ? 'غير محدد' : 'Not set'}</SelectItem>
                        <SelectItem value="single">{ar ? 'سينجل (فرد)' : 'Single (1)'}</SelectItem>
                        <SelectItem value="double">{ar ? 'دبل (فردين)' : 'Double (2)'}</SelectItem>
                        <SelectItem value="triple">{ar ? 'تريبل (3 أفراد)' : 'Triple (3)'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {manual.booking_type !== 'transfer-only' && mealPlans.length > 0 && (
                  <div>
                    <Label>{ar ? 'خطة الوجبات' : 'Meal plan'}</Label>
                    <Select
                      value={manual.meal_plan_key || 'none'}
                      onValueChange={v => v && setManual(m => ({ ...m, meal_plan_key: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{ar ? 'بدون' : 'None'}</SelectItem>
                        {mealPlans.map(mp => (
                          <SelectItem key={mp.key} value={mp.key}>
                            {ar ? mp.label_ar : mp.label_en}
                            {mp.price_per_person_per_night > 0
                              ? ` (+${mp.price_per_person_per_night.toLocaleString()} ${ar ? 'ج.م/ليلة/فرد' : 'EGP/night/person'})`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* ─── Auto-calculated price ─── */}
                <div className="md:col-span-2">
                  <PricePreview
                    ar={ar}
                    quote={quote}
                    loading={quoteLoading}
                    error={quoteError}
                    needsDate={!manual.trip_date}
                    override={manual.price_override}
                    totalPrice={manual.total_price}
                    onToggleOverride={on => setManual(m => ({
                      ...m,
                      price_override: on,
                      // Seed the manual field from the calculated total so the
                      // employee edits a real number rather than an empty box.
                      total_price: on ? (m.total_price ?? quote?.total) : undefined,
                      price_override_reason: on ? m.price_override_reason : '',
                    }))}
                    onTotalChange={v => setManual(m => ({ ...m, total_price: v }))}
                    onReasonChange={v => setManual(m => ({ ...m, price_override_reason: v }))}
                    reason={manual.price_override_reason}
                  />
                </div>
                <div>
                  <Label>{ar ? 'الحالة' : 'Status'}</Label>
                  <Select value={manual.status} onValueChange={v => v && setManual(m => ({ ...m, status: v as BookingStatus }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as BookingStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{ar ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ar ? 'مصدر الحجز' : 'Booking source'}</Label>
                  <Select value={manual.source} onValueChange={v => v && setManual(m => ({ ...m, source: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other'].map(s => (
                        <SelectItem key={s} value={s}>{ar ? SOURCE_LABELS[s].ar : SOURCE_LABELS[s].en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ar ? 'حالة الدفع' : 'Payment status'}</Label>
                  <Select value={manual.payment_status} onValueChange={v => v && setManual(m => ({ ...m, payment_status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(PAYMENT_LABELS).map(p => (
                        <SelectItem key={p} value={p}>{ar ? PAYMENT_LABELS[p].ar : PAYMENT_LABELS[p].en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ar ? 'المبلغ المدفوع' : 'Amount paid'}</Label>
                  <Input type="number" min={0} value={manual.amount_paid ?? ''} onChange={e => setManual(m => ({ ...m, amount_paid: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1" />
                </div>
              </div>

              <div>
                <Label>{ar ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea rows={3} value={manual.notes} onChange={e => setManual(m => ({ ...m, notes: e.target.value }))} className="mt-1" />
              </div>

              {manualError && <p className="text-sm text-red-500">{manualError}</p>}

              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => { setShowAdd(false); setManualError('') }}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={submitManual} disabled={savingManual} className="bg-brand-blue hover:bg-brand-blue-dark">
                  {savingManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  {ar ? 'حفظ الحجز' : 'Save booking'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice Viewer */}
      {invoiceBookingId && (
        <InvoiceViewer
          bookingId={invoiceBookingId}
          bookingNumber={invoiceBookingNumber}
          bookingType="accommodation"
          locale={locale as 'ar' | 'en'}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      )}
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, tone = 'default',
}: { label: string; value: string; icon: typeof Users; tone?: 'default' | 'warn' | 'info' }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'warn' ? 'bg-yellow-100 text-yellow-600' : tone === 'info' ? 'bg-purple-100 text-purple-600' : 'bg-brand-blue/10 text-brand-blue',
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold text-gray-900 leading-tight truncate">{value}</div>
          <div className="text-xs text-gray-500 truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailField({
  icon: Icon, label, value, dir,
}: { icon?: typeof Phone; label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="text-sm text-gray-900" dir={dir}>{value}</div>
    </div>
  )
}

/**
 * The auto-calculated price, itemised.
 *
 * The employee sees the same components the customer's invoice will list, so
 * a wrong total is traceable to the field that caused it instead of being a
 * bare number to argue with. The override exists for genuinely exceptional
 * cases and is deliberately explicit: the computed figure stays on screen
 * beside the manual one, and the reason travels with the booking.
 */
function PricePreview({
  ar, quote, loading, error, needsDate, override, totalPrice, reason,
  onToggleOverride, onTotalChange, onReasonChange,
}: {
  ar: boolean
  quote: AdminQuote | null
  loading: boolean
  error: string
  needsDate: boolean
  override: boolean
  totalPrice?: number
  reason: string
  onToggleOverride: (on: boolean) => void
  onTotalChange: (v: number | undefined) => void
  onReasonChange: (v: string) => void
}) {
  const egp = ar ? 'ج.م' : 'EGP'
  const money = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')
  const differs = override && quote != null && totalPrice != null && totalPrice !== quote.total

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="h-4 w-4" />
          {ar ? 'السعر المحسوب تلقائياً' : 'Auto-calculated price'}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
        </Label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={override}
            onChange={e => onToggleOverride(e.target.checked)}
            className="h-3.5 w-3.5 accent-amber-600"
          />
          {ar ? 'تعديل السعر يدوياً' : 'Set the price manually'}
        </label>
      </div>

      {needsDate ? (
        <p className="text-xs text-gray-500">
          {ar
            ? 'حدد تاريخ الذهاب (والفندق لو الحجز مش انتقالات بس) عشان السعر يتحسب.'
            : 'Pick a trip date (and an accommodation unless this is transfer-only) to calculate the price.'}
        </p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : quote ? (
        <>
          <div className="space-y-1.5">
            {quote.lines.map(line => (
              <div key={line.key} className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-gray-800">{ar ? line.label_ar : line.label_en}</div>
                  {(ar ? line.detail_ar : line.detail_en) && (
                    <div className="text-[11px] text-gray-500">{ar ? line.detail_ar : line.detail_en}</div>
                  )}
                </div>
                <div className="shrink-0 tabular-nums text-gray-900">{money(line.amount)}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-gray-200 pt-2">
            <span className="text-sm font-semibold text-gray-700">
              {ar ? 'الإجمالي المحسوب' : 'Calculated total'}
            </span>
            <span className={cn('tabular-nums text-lg font-bold', differs ? 'text-gray-400 line-through' : 'text-gray-900')}>
              {money(quote.total)} {egp}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            {ar
              ? `${money(Math.round(quote.per_person))} ${egp} للفرد × ${quote.num_people}`
              : `${money(Math.round(quote.per_person))} ${egp} per person × ${quote.num_people}`}
          </div>

          {!quote.is_priced && (
            <p className="mt-2 text-[11px] text-amber-700">
              {ar
                ? 'تنبيه: أسعار الجزء ده لسه مش متظبطة في الإعدادات، فالإجمالي ممكن يكون ناقص.'
                : 'Heads up: rates for this component are not configured yet, so the total may be incomplete.'}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-500">
          {ar ? 'جاري الحساب…' : 'Calculating…'}
        </p>
      )}

      {override && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          <div>
            <Label className="text-xs">{ar ? 'السعر النهائي المتفق عليه' : 'Agreed final price'}</Label>
            <Input
              type="number" min={0}
              value={totalPrice ?? ''}
              onChange={e => onTotalChange(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">{ar ? 'سبب التعديل (اختياري)' : 'Reason for the override (optional)'}</Label>
            <Input
              value={reason}
              onChange={e => onReasonChange(e.target.value)}
              placeholder={ar ? 'مثلاً: خصم لعميل دائم' : 'e.g. returning-customer discount'}
              className="mt-1"
            />
          </div>
          {differs && quote && (
            <p className="text-[11px] text-amber-700">
              {ar
                ? `الفرق عن السعر المحسوب: ${money((totalPrice ?? 0) - quote.total)} ${egp}`
                : `Difference from the calculated price: ${money((totalPrice ?? 0) - quote.total)} ${egp}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
