'use client'

import type { Dispatch } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar } from '@/components/ui/calendar'
import { ChipRail, Chip } from '@/components/brand'
import { formatCount, formatDate } from '@/lib/format'
import { arrivalOptions, earliestArrival, isoFromLocalDate, journeyNights, patternsForMode, returnDateFor, stayNights } from '@/lib/trip-builder/dates'
import type { BuilderAction } from '@/lib/trip-builder/state'
import { recommendedCheckInWeekdayNames } from '@/lib/trip-builder/summaries'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'
import { handleRadioGroupKeyDown } from './controls'

const ARRIVAL_WINDOW = 30

/** Section 2 — dates: pattern + date strip for transport, a range picker for stay-only. */
export function DatesStep({
  state,
  catalog,
  locale,
  dispatch,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  dispatch: Dispatch<BuilderAction>
}) {
  const t = useTranslations('builder')

  if (!state.transport_mode) {
    return <p className="text-sm text-ink-subtle">{t('datesChooseTransportFirst')}</p>
  }

  if (state.transport_mode === 'stay_only') {
    return <StayOnlyDates state={state} catalog={catalog} locale={locale} dispatch={dispatch} t={t} />
  }

  return <TransportDates state={state} catalog={catalog} locale={locale} dispatch={dispatch} t={t} />
}

function TransportDates({
  state,
  catalog,
  locale,
  dispatch,
  t,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  dispatch: Dispatch<BuilderAction>
  t: ReturnType<typeof useTranslations>
}) {
  const mode = state.transport_mode
  const patterns = patternsForMode(catalog.schedule, mode)
  const dates = state.stay_pattern_code
    ? arrivalOptions(catalog.schedule, { mode, patternCode: state.stay_pattern_code, originCode: state.origin_governorate_code, from: earliestArrival(catalog.today), count: ARRIVAL_WINDOW })
    : []
  const returnDate = returnDateFor(catalog.schedule, { mode, patternCode: state.stay_pattern_code, originCode: state.origin_governorate_code, arrivalDate: state.arrival_date })
  const nights = journeyNights(catalog.schedule, {
    mode,
    patternCode: state.stay_pattern_code,
    originCode: state.origin_governorate_code,
    arrivalDate: state.arrival_date,
  })

  if (!patterns.length) return <p className="text-sm text-ink-subtle">{t('datesNoPatterns')}</p>

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-sea-900">{t('datesPatternLabel')}</p>
        <ChipRail>
          {patterns.map((pattern) => (
            <Chip key={pattern.code} selected={state.stay_pattern_code === pattern.code} onClick={() => dispatch({ type: 'setPattern', pattern: pattern.code, catalog })}>
              {locale === 'ar' ? pattern.nameAr : pattern.nameEn}
            </Chip>
          ))}
        </ChipRail>
      </div>

      {state.stay_pattern_code && (
        <div>
          <p className="mb-2 text-sm font-semibold text-sea-900">{t('datesPickArrival')}</p>
          {dates.length ? (
            <div role="radiogroup" aria-label={t('datesPickArrival')} onKeyDown={handleRadioGroupKeyDown} className="rail-snap -mx-1 gap-2 px-1 pb-1">
              {dates.map((date) => (
                <button
                  key={date}
                  type="button"
                  role="radio"
                  aria-checked={state.arrival_date === date}
                  tabIndex={state.arrival_date === date ? 0 : -1}
                  onClick={() => dispatch({ type: 'setArrival', arrival: date })}
                  className={cn(
                    'rail-snap-item flex min-h-16 w-20 shrink-0 flex-col items-center justify-center rounded-xl border-[1.5px] text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600',
                    state.arrival_date === date ? 'border-sun-600 bg-sun-50' : 'border-sand-300 bg-white hover:border-sea-900/40',
                  )}
                >
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-subtle">{formatDate(date, locale, { weekday: 'short' })}</span>
                  <span className="font-display text-base font-bold text-sea-900">{formatDate(date, locale, { day: 'numeric' })}</span>
                  <span className="text-[0.65rem] text-ink-subtle">{formatDate(date, locale, { month: 'short' })}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">{t('datesNoArrivals')}</p>
          )}
        </div>
      )}

      {returnDate && state.arrival_date && (
        <p role="status" className="rounded-xl bg-sea-50 px-4 py-3 text-sm font-medium text-sea-900">
          {t('datesReturnHint', { date: formatDate(returnDate, locale), nights: nights ?? 0, n: formatCount(nights ?? 0, locale) })}
        </p>
      )}
    </div>
  )
}

function StayOnlyDates({
  state,
  catalog,
  locale,
  dispatch,
  t,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  dispatch: Dispatch<BuilderAction>
  t: ReturnType<typeof useTranslations>
}) {
  const min = earliestArrival(catalog.today)
  const selected = state.arrival_date
    ? { from: new Date(`${state.arrival_date}T00:00:00`), to: state.departure_date ? new Date(`${state.departure_date}T00:00:00`) : undefined }
    : undefined
  const recommendedDays = recommendedCheckInWeekdayNames(catalog.schedule, locale)
  const nights = stayNights(state.arrival_date, state.departure_date)

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-subtle">{t('datesRangeHint')}</p>
      {recommendedDays && <p className="text-xs font-medium text-sun-700">{t('datesRecommendedCheckIn', { days: recommendedDays })}</p>}
      <div className="overflow-x-auto">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) => {
            const arrival = range?.from ? isoFromLocalDate(range.from) : undefined
            const departure = range?.to ? isoFromLocalDate(range.to) : undefined
            dispatch({ type: 'setArrival', arrival })
            // The picker reports a one-day range (from === to) after the first
            // tap; only a later check-out day is a real departure.
            dispatch({ type: 'setDeparture', departure: arrival && departure && departure > arrival ? departure : undefined })
          }}
          disabled={{ before: new Date(`${min}T00:00:00`) }}
          modifiers={{ recommended: (date) => catalog.schedule.recommendedCheckInWeekdays.includes(date.getDay()) }}
          modifiersClassNames={{ recommended: 'font-bold text-sun-700' }}
          numberOfMonths={1}
          // react-day-picker's default formatters go through date-fns, which
          // renders day numbers and captions in Latin digits/English
          // regardless of the app locale (see src/lib/format.ts's rationale).
          // Routing through the same locale-aware helpers every other date
          // in this app uses keeps this calendar consistent in Arabic.
          formatters={{
            formatDay: (date) => formatCount(date.getDate(), locale),
            formatCaption: (date) => formatDate(date, locale, { month: 'long', year: 'numeric' }),
            formatWeekdayName: (date) => formatDate(date, locale, { weekday: 'narrow' }),
          }}
        />
      </div>
      {state.arrival_date && state.departure_date && (
        <p role="status" className="rounded-xl bg-sea-50 px-4 py-3 text-sm font-medium text-sea-900">
          {t('summaryStayDates', { arrival: formatDate(state.arrival_date, locale), departure: formatDate(state.departure_date, locale), nights: nights ?? 0, n: formatCount(nights ?? 0, locale) })}
        </p>
      )}
    </div>
  )
}
