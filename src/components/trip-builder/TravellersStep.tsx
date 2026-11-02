'use client'

import type { Dispatch } from 'react'
import { useTranslations } from 'next-intl'
import type { BuilderAction } from '@/lib/trip-builder/state'
import type { BuilderState } from '@/lib/trip-builder/types'
import { Stepper } from './controls'

/**
 * Section 3 — adults / children steppers. The section stays open while the
 * customer adjusts the counts (TripBuilder holds it); it only moves on when
 * they press Continue, which also confirms a party left at the default.
 */
export function TravellersStep({
  state,
  locale,
  dispatch,
  onContinue,
}: {
  state: BuilderState
  locale: 'ar' | 'en'
  dispatch: Dispatch<BuilderAction>
  onContinue: () => void
}) {
  const t = useTranslations('builder')
  const adults = state.adults ?? 1
  const children = state.children ?? 0

  return (
    <div className="space-y-3">
      {!state.travellers_confirmed && <p className="text-sm text-ink-subtle">{t('travellersConfirmHint')}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Stepper label={t('adults')} hint={t('adultsHint')} value={adults} min={1} max={20} locale={locale} onChange={(next) => dispatch({ type: 'setTravelers', adults: next, children })} />
        <Stepper label={t('children')} hint={t('childrenHint')} value={children} min={0} max={20} locale={locale} onChange={(next) => dispatch({ type: 'setTravelers', adults, children: next })} />
      </div>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'confirmTravelers' })
          onContinue()
        }}
        className="min-h-11 rounded-full bg-sea-900 px-5 text-sm font-bold text-sand-50 transition-colors hover:bg-sea-800"
      >
        {t('travellersContinue')}
      </button>
    </div>
  )
}
