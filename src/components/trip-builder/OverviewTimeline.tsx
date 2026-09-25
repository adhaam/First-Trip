'use client'

import { useTranslations } from 'next-intl'
import { CalendarCheck, MapPin, Sparkles, Tent } from 'lucide-react'
import { formatCount, formatDate } from '@/lib/format'
import { journeyNights, returnDateFor } from '@/lib/trip-builder/dates'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import { summaryFor } from '@/lib/trip-builder/view'
import { cn } from '@/lib/utils'
import { useTransportCopy } from './useTransportCopy'

/** Section 7 — the route-line recap of the whole journey, plus what WEEMAP still confirms. */
export function OverviewTimeline({ state, catalog, locale }: { state: BuilderState; catalog: BuilderCatalog; locale: 'ar' | 'en' }) {
  const t = useTranslations('builder')
  const summary = summaryFor(state, catalog, locale)
  const isStayOnly = state.transport_mode === 'stay_only'
  const origin = catalog.governorates.find((item) => item.code === state.origin_governorate_code)
  // Designed name ("WEEMAP Bus" / "Private Hiace"), never the raw catalog
  // label — `useTransportCopy` always needs a mode, so this falls back to
  // 'package_bus' when none is chosen yet; the result is only used below
  // once `state.transport_mode` is confirmed truthy.
  const transportCopy = useTransportCopy(state.transport_mode ?? 'package_bus')
  const returnDate = isStayOnly ? undefined : returnDateFor(catalog.schedule, { mode: state.transport_mode, patternCode: state.stay_pattern_code, originCode: state.origin_governorate_code, arrivalDate: state.arrival_date })
  const departureDate = isStayOnly ? state.departure_date : returnDate ?? undefined
  const nights = journeyNights(catalog.schedule, {
    mode: state.transport_mode,
    patternCode: state.stay_pattern_code,
    originCode: state.origin_governorate_code,
    arrivalDate: state.arrival_date,
    departureDate,
  })

  const steps: { icon: React.ReactNode; label: string }[] = []

  if (isStayOnly) {
    if (state.arrival_date) steps.push({ icon: <CalendarCheck className="h-4 w-4" />, label: t('checkIn', { date: formatDate(state.arrival_date, locale) }) })
  } else if (state.arrival_date) {
    steps.push({ icon: <MapPin className="h-4 w-4" />, label: t('depart', { date: formatDate(state.arrival_date, locale) }) + (origin ? ` — ${locale === 'ar' ? origin.name_ar : origin.name_en}` : '') })
  }

  if (summary.stay) {
    steps.push({ icon: <Tent className="h-4 w-4" />, label: nights ? t('stayNights', { nights, stay: summary.stay, n: formatCount(nights, locale) }) : summary.stay })
  } else if (!isStayOnly) {
    steps.push({ icon: <Tent className="h-4 w-4" />, label: t('dahab') })
  }

  for (const experience of summary.experiences) {
    steps.push({ icon: <Sparkles className="h-4 w-4" />, label: `${experience} · ${t('dateArranged')}` })
  }

  if (departureDate) {
    steps.push({ icon: <CalendarCheck className="h-4 w-4" />, label: t(isStayOnly ? 'checkOut' : 'return', { date: formatDate(departureDate, locale) }) })
  }

  const confirmations = [
    summary.stay && t('confirmNextStay', { stay: summary.stay }),
    state.transport_mode && state.transport_mode !== 'stay_only' && t('confirmNextTransport', { mode: transportCopy.title }),
    summary.experiences.length > 0 && t('confirmNextExperiences'),
  ].filter((line): line is string => Boolean(line))
  if (!confirmations.length && state.transport_mode) confirmations.push(t('confirmNextGeneric'))

  return (
    <div className="space-y-6">
      <ol className={cn('space-y-4 border-sun-500 text-sm text-sea-900', 'border-dashed ps-6 [border-inline-start-width:1.5px]')}>
        {steps.map((step, index) => (
          <li key={index} className="relative">
            <span aria-hidden className="absolute -start-[calc(1.5rem+9px)] top-0 grid size-6 -translate-x-0 place-items-center rounded-full border-[1.5px] border-sun-500 bg-sand-50 text-sun-700 rtl:translate-x-0">
              {step.icon}
            </span>
            <span className="font-medium">{step.label}</span>
          </li>
        ))}
        {!steps.length && <li className="text-ink-subtle">{t('datesChooseTransportFirst')}</li>}
      </ol>

      {confirmations.length > 0 && (
        <div className="rounded-2xl bg-sea-50 p-4">
          <p className="text-sm font-bold text-sea-900">{t('confirmNextTitle')}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-sea-900/90">
            {confirmations.map((line, index) => (
              <li key={index} className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-600" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
