'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw } from 'lucide-react'
import { formatAmount, formatDate } from '@/lib/format'
import type { Activity, WorkItem } from '@/lib/ops/types'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { WorkItemTable } from '@/components/admin/ops/WorkItemTable'
import type { PaymentRecord } from '@/components/admin/ops/PaymentsPanel'

type CustomerProfileResponse = {
  customer: { id: string; name: string; phone: string; email: string | null; merged_into: string | null }
  merged_from: { id: string; name: string; phone: string }[]
  items: WorkItem[]
  payments: (PaymentRecord & { entity_type: string; entity_id: string; reference: string })[]
  activity: Activity[]
  totals: { items: number; open_items: number; lifetime_paid: number; outstanding_now: number }
}

export function CustomerProfile({ id }: { id: string }) {
  const locale = useLocale()
  const t = useTranslations('ops.customer')
  const tCommon = useTranslations('ops.common')
  const tMethod = useTranslations('ops.method')
  const fetchJson = useOpsFetch()

  const [data, setData] = useState<CustomerProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchJson(`/api/admin/customers/${id}/profile`)
      setData(res)
    } catch (err) {
      if (err instanceof Error && err.message !== 'unauthorized') setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [id, fetchJson, t])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={load}><RotateCcw className="me-2 h-4 w-4" />{tCommon('retry')}</Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return <p className="text-sm text-muted-foreground">{t('notFound')}</p>
  const { customer, totals } = data

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('title')}</p>
        <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span dir="ltr">{customer.phone}</span>
          {customer.email && <span dir="ltr">{customer.email}</span>}
        </div>
        {data.merged_from.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('mergedFrom')}: {data.merged_from.map((m) => m.name).join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t('totals.items')} value={String(totals.items)} />
        <Tile label={t('totals.openItems')} value={String(totals.open_items)} />
        <Tile label={t('totals.lifetimePaid')} value={formatAmount(totals.lifetime_paid, locale)} />
        <Tile label={t('totals.outstandingNow')} value={formatAmount(totals.outstanding_now, locale)} />
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('items')}</h2>
        <WorkItemTable items={data.items} emptyMessage={t('itemsEmpty')} />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('payments')}</h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('paymentsEmpty')}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                <span>{payment.reference} · {tMethod(payment.method)}</span>
                <span className="font-medium">{payment.direction === 'received' ? '+' : '−'}{formatAmount(payment.amount, locale)}</span>
                <span className="text-xs text-muted-foreground">{formatDate(payment.received_at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('activity')}</h2>
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('activityEmpty')}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.activity.map((activity, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{activity.reference} · {activity.from_value} → {activity.to_value}</span>
                <span className="text-xs text-muted-foreground">{formatDate(activity.at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
