'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatAmount, formatCount, formatDateShort, formatReference } from '@/lib/format'
import { allowedNextStatuses, STATUSES } from '@/lib/request-workflow'
import { paymentPlanSummary, quoteSnapshotLines } from '@/lib/trip-request-admin'

type TripRequestStatus = (typeof STATUSES.trip_request)[number]
type TripRequest = { id: string; reference: string; status: TripRequestStatus; submitted_at: string; customer_name: string; customer_phone: string; transport_mode: 'package_bus' | 'hiace' | 'stay_only'; origin_governorate_code: string | null; arrival_date: string; departure_date: string; adults: number; children: number; accommodations: { name_ar: string; name_en: string } | null; experiences: unknown; room_allocations: unknown; meal_plan_key: string | null; quote_snapshot: unknown; quoted_total: number | string | null; payment_plan: unknown; notes: string | null }

const STATUS: Record<TripRequestStatus, { ar: string; en: string; cls: string }> = {
  new: { ar: 'جديد', en: 'New', cls: 'bg-purple-100 text-purple-700' },
  checking_availability: { ar: 'جارٍ التحقق من التوفر', en: 'Checking availability', cls: 'bg-sky-100 text-sky-800' },
  alternatives_required: { ar: 'بدائل مطلوبة', en: 'Alternatives required', cls: 'bg-orange-100 text-orange-800' },
  awaiting_payment: { ar: 'في انتظار الدفع', en: 'Awaiting payment', cls: 'bg-violet-100 text-violet-800' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'bg-green-100 text-green-800' },
  completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-gray-200 text-gray-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-100 text-red-800' },
}

function useAdminFetch() {
  const locale = useLocale()
  return useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
    if (res.status === 401) { window.location.href = locale === 'ar' ? '/admin' : '/en/admin'; throw new Error('unauthorized') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [locale])
}

function records(value: unknown) { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [] }

export function TripRequestsManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async (filter = statusFilter) => {
    setLoading(true); setLoadError('')
    try {
      const data = await api(`/api/admin/trip-requests${filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`}`)
      setRequests(data.requests || []); setUnavailable(data.unavailable === true)
    } catch { setLoadError(ar ? 'تعذر تحميل طلبات الرحلات' : 'Failed to load trip requests') } finally { setLoading(false) }
  }, [api, ar, statusFilter])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const update = async (id: string, patch: { status: TripRequestStatus }) => {
    try {
      const data = await api(`/api/admin/trip-requests/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setRequests((current) => current.map((request) => request.id === id ? data.request : request))
    } catch (error) { window.alert(error instanceof Error ? error.message : (ar ? 'فشل تحديث الطلب' : 'Failed to update request')) }
  }

  const selectFilter = (value: string | null) => {
    if (!value) return
    setStatusFilter(value)
    void load(value)
  }

  return <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-gray-900">{ar ? 'طلبات الرحلات — Trip Builder' : 'Trip Builder requests'}</h2><p className="text-sm text-gray-500">{ar ? 'طلبات مجمّعة من الموقع بانتظار متابعة فريق العمليات.' : 'Structured website requests awaiting operations follow-up.'}</p></div><Select value={statusFilter} onValueChange={selectFilter}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{ar ? 'كل الحالات' : 'All statuses'}</SelectItem>{STATUSES.trip_request.map((status) => <SelectItem key={status} value={status}>{ar ? STATUS[status].ar : STATUS[status].en}</SelectItem>)}</SelectContent></Select></div>
    <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>{ar ? 'المرجع / العميل' : 'Reference / customer'}</TableHead><TableHead>{ar ? 'الرحلة' : 'Journey'}</TableHead><TableHead>{ar ? 'الإقامة والتجارب' : 'Stay & experiences'}</TableHead><TableHead>{ar ? 'الإجمالي وخطة الدفع' : 'Total & payment plan'}</TableHead><TableHead>{ar ? 'الحالة' : 'Status'}</TableHead><TableHead>{ar ? 'تم الإرسال' : 'Submitted'}</TableHead><TableHead><span className="sr-only">{ar ? 'تفاصيل' : 'Details'}</span></TableHead></TableRow></TableHeader><TableBody>
      {loading && <TableRow><TableCell colSpan={7} className="py-8 text-center"><Loader2 className="inline h-5 w-5 animate-spin" /></TableCell></TableRow>}
      {!loading && loadError && <TableRow><TableCell colSpan={7} className="py-8 text-center text-red-500">{loadError}</TableCell></TableRow>}
      {!loading && !loadError && unavailable && <TableRow><TableCell colSpan={7} className="py-8 text-center text-amber-700">{ar ? 'جدول طلبات الرحلات لم يُرحّل بعد. شغّل migration 032 أولاً.' : 'The trip requests table is not migrated yet. Run migration 032 first.'}</TableCell></TableRow>}
      {!loading && !loadError && !unavailable && requests.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-gray-400">{ar ? 'لا توجد طلبات رحلات بهذه الحالة.' : 'No trip requests for this status.'}</TableCell></TableRow>}
      {!loading && !loadError && !unavailable && requests.map((request) => {
        const experiences = records(request.experiences), allocations = records(request.room_allocations), isExpanded = expandedId === request.id, phoneDigits = request.customer_phone.replace(/[^0-9]/g, ''), lines = quoteSnapshotLines(request.quote_snapshot, ar ? 'ar' : 'en')
        return <Fragment key={request.id}><TableRow><TableCell><div className="font-semibold" dir="ltr">{formatReference(request.reference)}</div><div className="mt-1 text-sm">{request.customer_name}</div><div className="mt-1 flex gap-2 text-xs" dir="ltr"><a href={`tel:${request.customer_phone}`} className="text-weemap-orange hover:underline">{request.customer_phone}</a><a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">WhatsApp</a></div></TableCell><TableCell className="text-sm text-gray-600"><div>{request.transport_mode === 'package_bus' ? (ar ? 'باص جماعي' : 'Shared bus') : request.transport_mode === 'hiace' ? (ar ? 'هايِس خاص' : 'Private Hiace') : (ar ? 'إقامة فقط' : 'Stay only')}</div><div>{request.origin_governorate_code || (ar ? 'بدون نقطة انطلاق' : 'No origin')}</div><div>{formatDateShort(request.arrival_date, locale)} → {formatDateShort(request.departure_date, locale)}</div><div>{formatCount(request.adults, locale)} {ar ? 'بالغ' : 'adults'} · {formatCount(request.children, locale)} {ar ? 'أطفال' : 'children'}</div></TableCell><TableCell className="text-sm text-gray-600"><div>{request.accommodations ? (ar ? request.accommodations.name_ar : request.accommodations.name_en) : (ar ? 'بدون إقامة' : 'No accommodation')}</div><div>{formatCount(experiences.length, locale)} {ar ? 'تجارب' : 'experiences'}</div></TableCell><TableCell className="text-sm"><div className="font-medium">{request.quoted_total == null ? '—' : `${formatAmount(request.quoted_total, locale)} EGP`}</div><div className="mt-1 max-w-52 text-xs text-gray-500">{paymentPlanSummary(request.payment_plan, ar ? 'ar' : 'en')}</div></TableCell><TableCell><Select value={request.status} onValueChange={(value) => void update(request.id, { status: value as TripRequestStatus })}><SelectTrigger className={cn('h-8 w-44 border-0 text-xs', STATUS[request.status].cls)}><SelectValue /></SelectTrigger><SelectContent>{allowedNextStatuses('trip_request', request.status).map((status) => <SelectItem key={status} value={status}>{ar ? STATUS[status].ar : STATUS[status].en}</SelectItem>)}</SelectContent></Select></TableCell><TableCell className="whitespace-nowrap text-xs text-gray-500">{formatDateShort(request.submitted_at, locale)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => setExpandedId(isExpanded ? null : request.id)} aria-label={ar ? 'عرض التفاصيل' : 'Show details'}><ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} /></Button></TableCell></TableRow>
        {isExpanded && <TableRow><TableCell colSpan={7} className="bg-gray-50 p-4"><div className="grid gap-5 text-sm md:grid-cols-2"><section><h3 className="mb-2 font-semibold">{ar ? 'تفاصيل الإقامة' : 'Stay details'}</h3><p>{ar ? 'خطة الوجبات:' : 'Meal plan:'} {request.meal_plan_key || '—'}</p><ul className="mt-2 space-y-1 text-gray-600">{allocations.length ? allocations.map((allocation, index) => <li key={index}>{String(allocation.type || 'room')} × {String(allocation.count || 0)}{allocation.upgrade_id ? ` · ${ar ? 'ترقية' : 'upgrade'}` : ''}</li>) : <li>{ar ? 'لا توجد توزيعات غرف.' : 'No room allocations.'}</li>}</ul></section><section><h3 className="mb-2 font-semibold">{ar ? 'التجارب' : 'Experiences'}</h3><ul className="space-y-1 break-all text-gray-600">{experiences.length ? experiences.map((experience, index) => <li key={index}><Badge variant="outline" className="me-2">{String(experience.kind || 'unknown')}</Badge>{String(experience.id || '—')}</li>) : <li>{ar ? 'لا توجد تجارب.' : 'No experiences.'}</li>}</ul></section><section><h3 className="mb-2 font-semibold">{ar ? 'بنود السعر المحفوظة' : 'Stored quote lines'}</h3><ul className="space-y-1 text-gray-600">{lines.length ? lines.map((line, index) => <li key={index}>{line.label}{line.detail ? ` — ${line.detail}` : ''}{line.amount !== null ? ` · ${formatAmount(line.amount, locale)} EGP` : ''}</li>) : <li>{ar ? 'لا توجد بنود محفوظة.' : 'No stored lines.'}</li>}</ul></section><section><h3 className="mb-2 font-semibold">{ar ? 'ملاحظات العميل' : 'Customer notes'}</h3><p className="whitespace-pre-wrap text-gray-600">{request.notes || '—'}</p></section></div></TableCell></TableRow>}
        </Fragment>
      })}
    </TableBody></Table></CardContent></Card>
  </div>
}
