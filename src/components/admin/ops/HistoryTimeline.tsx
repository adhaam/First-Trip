'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatAmount, formatDate } from '@/lib/format'

type StatusHistoryEntry = { field: string; from_value: string | null; to_value: string | null; actor: string | null; actor_name: string | null; changed_at: string }
type PaymentEntry = { id: string; direction: 'received' | 'refunded'; amount: number; method: string; received_at: string; recorded_by_name: string | null }
type AuditEntry = { id: string; occurred_at: string; action: string; changes: unknown; actor: string | null; actor_name: string | null }

type TimelineEvent = { at: string; kind: 'status' | 'payment' | 'audit'; content: React.ReactNode; actorName: string | null }

export function HistoryTimeline({ history, payments, audit }: { history: StatusHistoryEntry[]; payments: PaymentEntry[]; audit: AuditEntry[] }) {
  const locale = useLocale()
  const t = useTranslations('ops.item')
  const tStatus = useTranslations('ops.status')
  const tMethod = useTranslations('ops.method')

  const events: TimelineEvent[] = [
    ...history.map((h): TimelineEvent => ({
      at: h.changed_at,
      kind: 'status',
      actorName: h.actor_name,
      content: (
        <>
          {h.field === 'status' && h.from_value && h.to_value
            ? `${tStatus.has(h.from_value) ? tStatus(h.from_value) : h.from_value} → ${tStatus.has(h.to_value) ? tStatus(h.to_value) : h.to_value}`
            : `${h.field}: ${h.from_value ?? '—'} → ${h.to_value ?? '—'}`}
        </>
      ),
    })),
    ...payments.map((p): TimelineEvent => ({
      at: p.received_at,
      kind: 'payment',
      actorName: p.recorded_by_name,
      content: <>{p.direction === 'received' ? '+' : '−'}{formatAmount(p.amount, locale)} · {tMethod(p.method)}</>,
    })),
    ...audit.map((a): TimelineEvent => ({
      at: a.occurred_at,
      kind: 'audit',
      actorName: a.actor_name,
      content: <>{a.action}</>,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  if (!events.length) return <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>

  return (
    <ol className="flex flex-col divide-y">
      {events.map((event, i) => (
        <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div>
            <span className="font-medium">{event.actorName || t('websiteCustomer')}</span>{' '}
            <span className="text-muted-foreground">{event.content}</span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.at, locale)}</span>
        </li>
      ))}
    </ol>
  )
}
