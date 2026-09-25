'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import type { AttentionCode, OpsEntityType, WorkItem } from '@/lib/ops/types'

const STATUS_TONE: Record<string, string> = {
  new: 'bg-purple-100 text-purple-800',
  pending: 'bg-amber-100 text-amber-800',
  contacted: 'bg-sky-100 text-sky-800',
  checking_availability: 'bg-sky-100 text-sky-800',
  planning: 'bg-sky-100 text-sky-800',
  alternatives_required: 'bg-orange-100 text-orange-800',
  awaiting_payment: 'bg-violet-100 text-violet-800',
  confirmed: 'bg-green-100 text-green-800',
  preparing: 'bg-sky-100 text-sky-800',
  ready: 'bg-teal-100 text-teal-800',
  out_for_delivery: 'bg-teal-100 text-teal-800',
  completed: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
}

/** Status conveyed by text (translated label) — colour is a secondary cue, never the only one. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const t = useTranslations('ops.status')
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_TONE[status] ?? 'bg-gray-100 text-gray-700',
        className,
      )}
    >
      {t.has(status) ? t(status) : status}
    </span>
  )
}

const PAYMENT_TONE: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  refunded: 'bg-gray-200 text-gray-700',
  converted: 'bg-sea-100 text-sea-800',
}

export function PaymentPill({ paymentStatus, className }: { paymentStatus: string | null; className?: string }) {
  const t = useTranslations('ops.paymentStatus')
  if (!paymentStatus) {
    return <span className={cn('text-xs text-muted-foreground', className)}>{t('none')}</span>
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        PAYMENT_TONE[paymentStatus] ?? 'bg-gray-100 text-gray-700',
        className,
      )}
    >
      {t.has(paymentStatus) ? t(paymentStatus) : paymentStatus}
    </span>
  )
}

export function AttentionChips({ codes }: { codes: AttentionCode[] }) {
  const t = useTranslations('ops.attention')
  if (!codes.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <span
          key={code}
          className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200"
        >
          {t(code)}
        </span>
      ))}
    </div>
  )
}

export function NextActionLabel({ action }: { action: WorkItem['next_action'] }) {
  const t = useTranslations('ops.nextAction')
  return <>{t(action)}</>
}

export function EntityTypeLabel({ type }: { type: OpsEntityType }) {
  const t = useTranslations('ops.entityType')
  return <>{t(type)}</>
}

/** Item title in the current locale, falling back to the other locale or the reference. */
export function itemTitle(item: Pick<WorkItem, 'title_en' | 'title_ar' | 'reference'>, locale: string): string {
  const primary = locale === 'ar' ? item.title_ar : item.title_en
  const secondary = locale === 'ar' ? item.title_en : item.title_ar
  return primary || secondary || item.reference
}

/** Waiting duration as a compact, translated string — hours under a day, days after. */
export function WaitingLabel({ hours, stale }: { hours: number; stale: boolean }) {
  const t = useTranslations('ops.queue.waiting')
  const label = hours < 24 ? t('hours', { count: Math.round(hours) }) : t('days', { count: Math.floor(hours / 24) })
  return <span className={cn(stale && 'font-semibold text-red-700')}>{label}</span>
}

export function useLocaleDir() {
  const locale = useLocale()
  return locale === 'ar' ? 'rtl' : 'ltr'
}
