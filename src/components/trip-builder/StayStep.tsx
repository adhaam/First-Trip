'use client'

import type { Dispatch } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SafeImage } from '@/components/SafeImage'
import { PriceTag } from '@/components/brand'
import type { BuilderAction } from '@/lib/trip-builder/state'
import type { BuilderCatalog, BuilderState, CatalogAccommodation } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'
import { handleRadioGroupKeyDown } from './controls'

/** Section 4 — stay. Optional ("just the ride") for a transport mode; required for stay-only. */
export function StayStep({
  state,
  catalog,
  locale,
  prefillStayId,
  dispatch,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  prefillStayId?: string
  dispatch: Dispatch<BuilderAction>
}) {
  const t = useTranslations('builder')
  const isStayOnly = state.transport_mode === 'stay_only'

  if (!catalog.accommodations.length) {
    return <EmptyState variant="curating" title={t('stayEmpty')} hint={t('stayEmptyHint')} />
  }

  // The prefilled stay (from `?stay=`) leads the list; otherwise data order.
  const stays = prefillStayId
    ? [...catalog.accommodations].sort((a, b) => (a.id === prefillStayId ? -1 : b.id === prefillStayId ? 1 : 0))
    : catalog.accommodations

  return (
    <div className="space-y-4">
      {!isStayOnly && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'setStay', id: undefined, catalog })}
          className={cn(
            'min-h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors',
            !state.accommodation_id ? 'border-sea-900 bg-sea-900 text-sand-50' : 'border-sand-300 text-sea-900 hover:border-sea-900/40',
          )}
        >
          {t('stayTransferOnly')}
        </button>
      )}

      <div
        role="radiogroup"
        aria-label={t('stepStayTitle')}
        onKeyDown={handleRadioGroupKeyDown}
        className="flex -mx-1 gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
      >
        {stays.map((stay) => (
          <AccommodationCard
            key={stay.id}
            stay={stay}
            active={state.accommodation_id === stay.id}
            prefilled={stay.id === prefillStayId}
            locale={locale}
            onClick={() => dispatch({ type: 'setStay', id: stay.id, catalog })}
          />
        ))}
      </div>
    </div>
  )
}

function AccommodationCard({
  stay,
  active,
  prefilled,
  locale,
  onClick,
}: {
  stay: CatalogAccommodation
  active: boolean
  prefilled: boolean
  locale: 'ar' | 'en'
  onClick: () => void
}) {
  const t = useTranslations('builder')
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        'group w-64 shrink-0 overflow-hidden rounded-2xl border-[1.5px] bg-white text-start transition-colors sm:w-auto sm:shrink',
        active ? 'border-sun-600 ring-1 ring-sun-200' : 'border-sand-300 hover:border-sea-900/40',
      )}
    >
      <div className="relative aspect-[4/3]">
        {stay.image ? (
          <SafeImage src={stay.image} alt="" fill sizes="(max-width: 640px) 60vw, 33vw" className="object-cover" />
        ) : (
          <div aria-hidden className="h-full w-full bg-sand-200" />
        )}
        {prefilled && (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-sand-50/95 px-2.5 py-1 text-[0.65rem] font-semibold text-sea-900 backdrop-blur">
            {t('stayPrefilled')}
          </span>
        )}
        {active && (
          <span aria-hidden className="absolute end-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-sun-500 text-on-accent">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="font-display text-sm font-bold leading-snug text-sea-900">{locale === 'ar' ? stay.name_ar : stay.name_en}</p>
        <p className="mt-0.5 text-xs capitalize text-ink-subtle">{stay.type}{stay.tier ? ` · ${stay.tier}` : ''}</p>
        <PriceTag amount={stay.from_price_per_person_per_night} from unit="personNight" size="sm" className="mt-2.5" />
      </div>
    </button>
  )
}
