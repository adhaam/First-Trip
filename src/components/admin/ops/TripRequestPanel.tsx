'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { formatAmount, formatCount, formatDateShort } from '@/lib/format'
import type { RequestJourney } from '@/lib/ops/request-journey'

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : []
}

/**
 * Read-only rendering of a trip_request's frozen, customer-submitted journey.
 * Amounts are the snapshot taken at submission (never recomputed); names come
 * from `record.journey`, which the item API resolves. Never editable here.
 */
export function TripRequestPanel({ record }: { record: Record<string, unknown> }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const t = useTranslations('ops.item')
  const tj = useTranslations('ops.journey')

  const journey = record.journey as RequestJourney | undefined
  const accommodation = record.accommodations as { name_ar?: string; name_en?: string } | null
  const pattern = record.stay_patterns as { name_ar?: string; name_en?: string } | null
  const allocations = records(record.room_allocations)
  const transportMode = typeof record.transport_mode === 'string' ? record.transport_mode : null
  const name = (value: { name_ar?: string; name_en?: string } | null | undefined) =>
    value ? (ar ? value.name_ar || value.name_en : value.name_en || value.name_ar) || '—' : '—'

  return (
    <section className="rounded-lg border bg-amber-50/40 p-4 ring-1 ring-amber-200">
      <h2 className="text-sm font-semibold text-gray-900">{t('customerRequestPanel')}</h2>
      <p className="mb-3 text-xs text-gray-600">{tj('frozenNote')}</p>
      <div className="grid gap-5 text-sm md:grid-cols-2">
        <div>
          <Row
            label={t('origin')}
            value={journey?.origin ? name(journey.origin) : tj('noOrigin')}
          />
          <Row
            label={t('transportMode')}
            value={transportMode ? tj(`transport.${transportMode}`) : '—'}
          />
          {pattern && <Row label={tj('stayPattern')} value={name(pattern)} />}
          <Row
            label={t('dates')}
            value={`${formatDateShort(record.arrival_date as string, locale)} → ${
              formatDateShort(record.departure_date as string, locale)}`}
          />
          <Row
            label={t('travellers')}
            value={tj('travellers', {
              adults: formatCount(Number(record.adults ?? 0), locale),
              children: formatCount(Number(record.children ?? 0), locale),
            })}
          />
          <Row
            label={t('accommodation')}
            value={accommodation ? name(accommodation) : t('noAccommodation')}
          />
          <Row label={t('mealPlan')} value={journey?.meal_plan ? name(journey.meal_plan) : '—'} />
        </div>

        <div>
          <h3 className="mb-1 font-medium text-gray-900">{t('roomAllocations')}</h3>
          {allocations.length ? (
            <ul className="mb-3 space-y-1 text-gray-600">
              {allocations.map((allocation, i) => (
                <li key={i}>
                  {tj('room', {
                    type: tj.has(`roomTypes.${String(allocation.type)}`)
                      ? tj(`roomTypes.${String(allocation.type)}`)
                      : String(allocation.type || ''),
                    count: formatCount(Number(allocation.count || 0), locale),
                  })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-gray-500">{t('noRoomAllocations')}</p>
          )}

          <h3 className="mb-1 font-medium text-gray-900">{t('experiences')}</h3>
          {journey?.experiences.length ? (
            <ul className="space-y-1 text-gray-600">
              {journey.experiences.map((experience) => (
                <li key={`${experience.kind}:${experience.id}`} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{tj(`kind.${experience.kind}`)}</Badge>
                  <span className="font-medium text-gray-800">{name(experience)}</span>
                  {experience.preferred_date && (
                    <span className="text-xs">{formatDateShort(experience.preferred_date, locale)}</span>
                  )}
                  {experience.total !== null && (
                    <span className="text-xs">· {formatAmount(experience.total, locale)}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">{t('noExperiences')}</p>
          )}
        </div>

        <div>
          <h3 className="mb-1 font-medium text-gray-900">{t('quoteLines')}</h3>
          {journey?.quote_lines.length ? (
            <ul className="space-y-1 text-gray-600">
              {journey.quote_lines.map((line) => (
                <li key={line.key} className="flex justify-between gap-2">
                  <span>{tj(`quote.${line.key}`)}</span>
                  <span>{formatAmount(line.amount, locale)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">{t('noQuoteLines')}</p>
          )}
          {journey?.quote_total !== null && journey?.quote_total !== undefined && (
            <p className="mt-2 flex justify-between gap-2 border-t border-amber-200 pt-1 font-semibold">
              <span>{tj('quote.total')}</span>
              <span>{formatAmount(journey.quote_total, locale)}</span>
            </p>
          )}
          {journey?.payment && (
            <dl className="mt-2 space-y-1 text-xs text-gray-700">
              <div className="flex justify-between gap-2">
                <dt>{tj('payment.afterConfirmation')}</dt>
                <dd>{journey.payment.after_confirmation !== null
                  ? formatAmount(journey.payment.after_confirmation, locale) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{tj('payment.onArrival')}</dt>
                <dd>{journey.payment.on_arrival !== null
                  ? formatAmount(journey.payment.on_arrival, locale) : '—'}</dd>
              </div>
            </dl>
          )}
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
