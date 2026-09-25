'use client'

import type { Dispatch } from 'react'
import { useTranslations } from 'next-intl'
import { formatAmount } from '@/lib/format'
import { roomCapacity, roomsFit } from '@/lib/trip-builder/rooms'
import type { BuilderAction } from '@/lib/trip-builder/state'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import type { RoomAllocationInput } from '@/lib/trip-requests/schema'
import { ChoiceCard, Stepper, handleRadioGroupKeyDown } from './controls'

const ROOM_TYPES = ['single', 'double', 'triple'] as const

/** Literal-key switch — see the note in `JourneySection.tsx`. */
function roomTypeLabel(t: ReturnType<typeof useTranslations>, type: (typeof ROOM_TYPES)[number]): string {
  switch (type) {
    case 'single': return t('roomsSingle')
    case 'double': return t('roomsDouble')
    case 'triple': return t('roomsTriple')
  }
}

/** Section 5 — room allocation, room upgrade and meal plan for the chosen stay. */
export function RoomsMealStep({
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
  const stay = catalog.accommodations.find((item) => item.id === state.accommodation_id)
  if (!stay) return null

  const allocations = state.room_allocations ?? []
  const people = (state.adults ?? 1) + (state.children ?? 0)
  const capacity = roomCapacity(allocations)
  const fits = roomsFit(people, allocations)

  const setCount = (type: (typeof ROOM_TYPES)[number], count: number) => {
    const next: RoomAllocationInput[] = ROOM_TYPES.map((roomType) => ({
      type: roomType,
      count: roomType === type ? count : allocations.find((item) => item.type === roomType)?.count ?? 0,
    })).filter((item) => item.count > 0)
    dispatch({ type: 'setRooms', allocations: next })
  }

  // Room-only leads the list (it's the baseline everything else is priced against).
  const meals = [...stay.meal_plans].sort((a, b) => (a.key === 'room_only' ? -1 : b.key === 'room_only' ? 1 : 0))

  return (
    <div className="space-y-6">
      <div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ROOM_TYPES.map((type) => (
            <Stepper
              key={type}
              label={roomTypeLabel(t, type)}
              value={allocations.find((item) => item.type === type)?.count ?? 0}
              min={0}
              max={20}
              locale={locale}
              onChange={(count) => setCount(type, count)}
            />
          ))}
        </div>
        <p className={fits || !allocations.length ? 'mt-2.5 text-xs text-ink-subtle' : 'mt-2.5 text-xs font-semibold text-red-700'} role={fits ? undefined : 'alert'}>
          {fits || !allocations.length ? t('roomsCapacity', { capacity: capacity || people }) : t('roomsNotEnough', { people })}
        </p>
      </div>

      {stay.room_upgrades.length > 0 && (
        <div>
          <p className="mb-2.5 text-sm font-semibold text-sea-900">{t('roomsUpgrades')}</p>
          <div role="radiogroup" aria-label={t('roomsUpgrades')} onKeyDown={handleRadioGroupKeyDown} className="grid gap-2.5 sm:grid-cols-2">
            {stay.room_upgrades.map((upgrade) => (
              <ChoiceCard
                key={upgrade.id}
                active={state.upgrade_id === upgrade.id}
                title={locale === 'ar' ? upgrade.name_ar : upgrade.name_en}
                detail={`+${formatAmount(upgrade.extra_price_per_night, locale)} EGP · ${t('perPersonPerNight')}`}
                onClick={() => dispatch({ type: 'setUpgrade', id: state.upgrade_id === upgrade.id ? undefined : upgrade.id })}
                className="min-h-16 p-3.5"
              />
            ))}
          </div>
        </div>
      )}

      {meals.length > 0 && (
        <div>
          <p className="mb-2.5 text-sm font-semibold text-sea-900">{t('mealPlan')}</p>
          <div role="radiogroup" aria-label={t('mealPlan')} onKeyDown={handleRadioGroupKeyDown} className="grid gap-2.5 sm:grid-cols-2">
            {meals.map((meal) => (
              <ChoiceCard
                key={meal.key}
                active={state.meal_plan_key === meal.key}
                title={locale === 'ar' ? meal.label_ar : meal.label_en}
                detail={meal.price_per_person_per_night > 0 ? `+${formatAmount(meal.price_per_person_per_night, locale)} EGP · ${t('perPersonPerNight')}` : t('included')}
                onClick={() => dispatch({ type: 'setMeal', key: meal.key })}
                className="min-h-16 p-3.5"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
