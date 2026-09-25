'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OpsEntityType, WorkItem } from '@/lib/ops/types'
import { STATUSES } from '@/lib/request-workflow'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { WorkItemTable } from '@/components/admin/ops/WorkItemTable'
import { dashboardHref } from '@/components/admin/ops/nav'

const VIEWS = ['needs_action', 'awaiting_payment', 'upcoming', 'stale', 'exceptions', 'all'] as const
const ENTITY_TYPES: OpsEntityType[] = ['accommodation_booking', 'trip_booking', 'signature_request', 'trip_request', 'commerce_order']
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'] as const
const ALL_STATUSES = Array.from(new Set(Object.values(STATUSES).flat()))

type QueueResponse = { items: WorkItem[]; total: number; page: number; page_size: number }

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function QueueView() {
  const t = useTranslations('ops.queue')
  const tViews = useTranslations('ops.queue.views')
  const tFilters = useTranslations('ops.queue.filters')
  const tStatus = useTranslations('ops.status')
  const tPayment = useTranslations('ops.paymentStatus')
  const tEntity = useTranslations('ops.entityType')
  const tCommon = useTranslations('ops.common')
  const fetchJson = useOpsFetch()
  const router = useRouter()
  const searchParams = useSearchParams()

  const view = searchParams.get('view') || 'needs_action'
  const type = searchParams.get('type') || ''
  const status = searchParams.get('status') || ''
  const payment = searchParams.get('payment') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const page = Number(searchParams.get('page') || '1')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const debouncedSearch = useDebouncedValue(searchInput, 400)

  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const setParam = useCallback((patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', 'queue')
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (!('page' in patch)) params.delete('page')
    router.push(`/admin/dashboard?${params.toString()}`)
  }, [router, searchParams])

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get('q') || '')) setParam({ q: debouncedSearch || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ view, page: String(page || 1), page_size: '25' })
      if (type) params.set('type', type)
      if (status) params.set('status', status)
      if (payment) params.set('payment', payment)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const q = searchParams.get('q') || ''
      if (q) params.set('q', q)
      const res = await fetchJson(`/api/admin/ops/queue?${params.toString()}`)
      setData(res)
    } catch (err) {
      if (err instanceof Error && err.message !== 'unauthorized') setError(t('loadError'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, type, status, payment, from, to, page, fetchJson, t])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const hasFilters = !!(type || status || payment || from || to || searchInput)

  const clearFilters = () => {
    setSearchInput('')
    router.push(dashboardHref('queue', { view }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2" role="tablist" aria-label={t('title')}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setParam({ view: v })}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange',
              view === v ? 'bg-weemap-orange text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            )}
          >
            {tViews(v)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="queue-search">{tFilters('search')}</Label>
            <Input id="queue-search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="queue-type">{tFilters('type')}</Label>
            <Select value={type || 'all'} onValueChange={(v) => setParam({ type: v === 'all' ? undefined : String(v) })}>
              <SelectTrigger id="queue-type" className="mt-1 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tFilters('anyType')}</SelectItem>
                {ENTITY_TYPES.map((et) => <SelectItem key={et} value={et}>{tEntity(et)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="queue-status">{tFilters('status')}</Label>
            <Select value={status || 'all'} onValueChange={(v) => setParam({ status: v === 'all' ? undefined : String(v) })}>
              <SelectTrigger id="queue-status" className="mt-1 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tFilters('anyStatus')}</SelectItem>
                {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="queue-payment">{tFilters('payment')}</Label>
            <Select value={payment || 'all'} onValueChange={(v) => setParam({ payment: v === 'all' ? undefined : String(v) })}>
              <SelectTrigger id="queue-payment" className="mt-1 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tFilters('anyPayment')}</SelectItem>
                {PAYMENT_STATUSES.map((p) => <SelectItem key={p} value={p}>{tPayment(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="queue-from">{tFilters('from')}</Label>
            <Input id="queue-from" type="date" dir="ltr" value={from} onChange={(e) => setParam({ from: e.target.value || undefined })} className="mt-1 w-40" />
          </div>
          <div>
            <Label htmlFor="queue-to">{tFilters('to')}</Label>
            <Input id="queue-to" type="date" dir="ltr" value={to} onChange={(e) => setParam({ to: e.target.value || undefined })} className="mt-1 w-40" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>{tFilters('clear')}</Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={load}><RotateCcw className="me-2 h-4 w-4" />{tCommon('retry')}</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          {loading && !data ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : (
            <WorkItemTable items={data?.items ?? []} emptyMessage={t('empty')} />
          )}
        </CardContent>
      </Card>

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tCommon('showingResults', { count: data.items.length, total: data.total })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>
              {t('pagination.previous')}
            </Button>
            <span>{tCommon('page')} {page} {tCommon('of')} {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setParam({ page: String(page + 1) })}>
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
