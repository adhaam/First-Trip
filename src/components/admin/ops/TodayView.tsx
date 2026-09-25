'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { formatDate } from '@/lib/format'
import type { Activity, WorkItem } from '@/lib/ops/types'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { WorkItemTable } from '@/components/admin/ops/WorkItemTable'
import { queueHref } from '@/components/admin/ops/nav'
import { cn } from '@/lib/utils'

type TodayCounts = {
  needs_action: number; new_requests: number; awaiting_availability: number; alternatives_required: number
  awaiting_payment: number; arrivals_today: number; departures_today: number; trips_today: number
  transfers_attention: number; stale: number; exceptions: number
}

type TodayResponse = {
  date: string
  counts: TodayCounts
  sections: {
    needs_action: WorkItem[]; arrivals: WorkItem[]; departures: WorkItem[]; trips: WorkItem[]
    transfers: WorkItem[]; upcoming: WorkItem[]; stale: WorkItem[]; exceptions: WorkItem[]
    recent_activity: Activity[]
  }
}

function todayIso(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function TodayView() {
  const locale = useLocale()
  const t = useTranslations('ops.today')
  const tTiles = useTranslations('ops.today.tiles')
  const tSections = useTranslations('ops.today.sections')
  const tEmpty = useTranslations('ops.today.empty')
  const tCommon = useTranslations('ops.common')
  const fetchJson = useOpsFetch()

  const [date, setDate] = useState(todayIso)
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchJson(`/api/admin/ops/today?date=${encodeURIComponent(date)}`)
      setData(res)
    } catch (err) {
      if (err instanceof Error && err.message !== 'unauthorized') setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [date, fetchJson, t])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const tiles = useMemo(() => {
    if (!data) return []
    const c = data.counts
    return [
      { key: 'needsAction', value: c.needs_action, href: queueHref('needs_action') },
      { key: 'newRequests', value: c.new_requests, href: queueHref('needs_action', { status: 'new' }) },
      { key: 'awaitingAvailability', value: c.awaiting_availability, href: queueHref('needs_action', { status: 'checking_availability' }) },
      { key: 'alternativesRequired', value: c.alternatives_required, href: queueHref('needs_action', { status: 'alternatives_required' }) },
      { key: 'awaitingPayment', value: c.awaiting_payment, href: queueHref('awaiting_payment') },
      { key: 'arrivalsToday', value: c.arrivals_today, href: queueHref('all', { from: date, to: date }) },
      { key: 'departuresToday', value: c.departures_today, href: queueHref('all', { from: date, to: date }) },
      { key: 'tripsToday', value: c.trips_today, href: queueHref('all', { type: 'trip_booking', from: date, to: date }) },
      { key: 'transfersAttention', value: c.transfers_attention, href: queueHref('exceptions', { from: date, to: date }) },
      { key: 'stale', value: c.stale, href: queueHref('stale') },
      { key: 'exceptions', value: c.exceptions, href: queueHref('exceptions') },
    ] as const
  }, [data, date])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div>
          <Label htmlFor="today-date">{t('datePicker')}</Label>
          <Input
            id="today-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-44"
            dir="ltr"
          />
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RotateCcw className="me-2 h-4 w-4" />{tCommon('retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 11 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border bg-white p-4 transition-colors hover:border-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange',
                  tile.value > 0 && (tile.key === 'exceptions' || tile.key === 'stale') && 'border-red-200 bg-red-50',
                )}
              >
                <span className="text-2xl font-semibold text-gray-900">{tile.value}</span>
                <span className="text-xs text-muted-foreground">{tTiles(tile.key)}</span>
              </Link>
            ))}
          </div>

          <Section title={tSections('needsAction')} empty={!data.sections.needs_action.length} emptyLabel={tEmpty('needsAction')}>
            <WorkItemTable items={data.sections.needs_action} emptyMessage={tEmpty('needsAction')} />
          </Section>

          <Section title={tSections('exceptions')} empty={!data.sections.exceptions.length} emptyLabel={tEmpty('exceptions')}>
            <WorkItemTable items={data.sections.exceptions} emptyMessage={tEmpty('exceptions')} />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={tSections('arrivals')} empty={!data.sections.arrivals.length} emptyLabel={tEmpty('arrivals')}>
              <WorkItemTable items={data.sections.arrivals} emptyMessage={tEmpty('arrivals')} />
            </Section>
            <Section title={tSections('departures')} empty={!data.sections.departures.length} emptyLabel={tEmpty('departures')}>
              <WorkItemTable items={data.sections.departures} emptyMessage={tEmpty('departures')} />
            </Section>
          </div>

          <Section title={tSections('trips')} empty={!data.sections.trips.length} emptyLabel={tEmpty('trips')}>
            <WorkItemTable items={data.sections.trips} emptyMessage={tEmpty('trips')} />
          </Section>

          <Section title={tSections('transfers')} empty={!data.sections.transfers.length} emptyLabel={tEmpty('transfers')}>
            <WorkItemTable items={data.sections.transfers} emptyMessage={tEmpty('transfers')} />
          </Section>

          <Section title={tSections('upcoming')} empty={!data.sections.upcoming.length} emptyLabel={tEmpty('upcoming')}>
            <WorkItemTable items={data.sections.upcoming} emptyMessage={tEmpty('upcoming')} />
          </Section>

          <Section title={tSections('recentActivity')} empty={!data.sections.recent_activity.length} emptyLabel={tEmpty('recentActivity')}>
            <RecentActivity items={data.sections.recent_activity} locale={locale} />
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; empty: boolean; emptyLabel: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
        {children}
      </CardContent>
    </Card>
  )
}

function RecentActivity({ items, locale }: { items: Activity[]; locale: string }) {
  const t = useTranslations('ops.item')
  if (!items.length) return null
  return (
    <ul className="flex flex-col divide-y">
      {items.map((activity, i) => (
        <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div>
            <span className="font-medium">{activity.actor_name || t('websiteCustomer')}</span>{' '}
            <span className="text-muted-foreground">
              {activity.reference} · {activity.customer_name}
              {activity.from_value && activity.to_value ? ` · ${activity.from_value} → ${activity.to_value}` : ''}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(activity.at, locale)}</span>
        </li>
      ))}
    </ul>
  )
}
