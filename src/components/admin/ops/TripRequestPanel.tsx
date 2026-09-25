'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { formatAmount, formatCount, formatDateShort } from '@/lib/format'
import { paymentPlanSummary, quoteSnapshotLines } from '@/lib/trip-request-admin'

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : []
}

const TRANSPORT_LABEL: Record<string, { ar: string; en: string }> = {
  package_bus: { ar: 'باص جماعي', en: 'Shared bus' },
  hiace: { ar: 'هايِس خاص', en: 'Private Hiace' },
  stay_only: { ar: 'إقامة فقط', en: 'Stay only' },
}

/** Read-only rendering of a trip_request's frozen, customer-submitted journey. Never editable here. */
export function TripRequestPanel({ record }: { record: Record<string, unknown> }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const t = useTranslations('ops.item')

  const accommodation = record.accommodations as { name_ar?: string; name_en?: string } | null
  const experiences = records(record.experiences)
  const allocations = records(record.room_allocations)
  const lines = quoteSnapshotLines(record.quote_snapshot, ar ? 'ar' : 'en')
  const transportMode = typeof record.transport_mode === 'string' ? record.transport_mode : null

  return (
    <section className="rounded-lg border bg-amber-50/40 p-4 ring-1 ring-amber-200">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('customerRequestPanel')}</h2>
      <div className="grid gap-5 text-sm md:grid-cols-2">
        <div>
          <Row label={t('origin')} value={String(record.origin_governorate_code || '—')} />
          <Row label={t('transportMode')} value={transportMode ? (ar ? TRANSPORT_LABEL[transportMode]?.ar : TRANSPORT_LABEL[transportMode]?.en) ?? transportMode : '—'} />
          <Row
            label={t('dates')}
            value={`${formatDateShort(record.arrival_date as string, locale)} → ${formatDateShort(record.departure_date as string, locale)}`}
          />
          <Row
            label={t('travellers')}
            value={`${formatCount(Number(record.adults ?? 0), locale)} ${ar ? 'بالغ' : 'adults'} · ${formatCount(Number(record.children ?? 0), locale)} ${ar ? 'أطفال' : 'children'}`}
          />
          <Row label={t('accommodation')} value={accommodation ? (ar ? accommodation.name_ar : accommodation.name_en) ?? '—' : t('noAccommodation')} />
          <Row label={t('mealPlan')} value={String(record.meal_plan_key || '—')} />
        </div>

        <div>
          <h3 className="mb-1 font-medium text-gray-900">{t('roomAllocations')}</h3>
          {allocations.length ? (
            <ul className="mb-3 space-y-1 text-gray-600">
              {allocations.map((allocation, i) => (
                <li key={i}>{String(allocation.type || 'room')} × {String(allocation.count || 0)}</li>
              ))}
            </ul>
          ) : <p className="mb-3 text-gray-500">{t('noRoomAllocations')}</p>}

          <h3 className="mb-1 font-medium text-gray-900">{t('experiences')}</h3>
          {experiences.length ? (
            <ul className="space-y-1 text-gray-600">
              {experiences.map((experience, i) => (
                <li key={i}><Badge variant="outline" className="me-2">{String(experience.kind || '—')}</Badge>{String(experience.id || '—')}</li>
              ))}
            </ul>
          ) : <p className="text-gray-500">{t('noExperiences')}</p>}
        </div>

        <div>
          <h3 className="mb-1 font-medium text-gray-900">{t('quoteLines')}</h3>
          {lines.length ? (
            <ul className="space-y-1 text-gray-600">
              {lines.map((line, i) => (
                <li key={i}>
                  {line.label}{line.detail ? ` — ${line.detail}` : ''}{line.amount !== null ? ` · ${formatAmount(line.amount, locale)}` : ''}
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500">{t('noQuoteLines')}</p>}
          <p className="mt-2 text-xs text-gray-500">{paymentPlanSummary(record.payment_plan, ar ? 'ar' : 'en')}</p>
        </div>

        <div>
          <h3 className="mb-1 font-medium text-gray-900">{t('customerNotes')}</h3>
          <p className="whitespace-pre-wrap text-gray-600">{String(record.notes || '—')}</p>
        </div>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex justify-between gap-2 border-b border-amber-100 pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  )
}
