'use client'

import type { Dispatch } from 'react'
import { MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatAmount, formatCount } from '@/lib/format'
import { roomCapacity, roomsExceedPeople, roomsFit } from '@/lib/trip-builder/rooms'
import type { BuilderAction } from '@/lib/trip-builder/state'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import { recommendedAllocations, type QuoteView } from '@/lib/trip-builder/view'
import type { RoomAllocationInput } from '@/lib/trip-requests/schema'
import { cn } from '@/lib/utils'
import { ChoiceCard, Stepper, handleRadioGroupKeyDown } from './controls'

const ROOM_TYPES = ['single', 'double', 'triple'] as const
type RoomType = (typeof ROOM_TYPES)[number]

/** Literal-key switch — see the note in `JourneySection.tsx`. */
function roomTypeLabel(t: ReturnType<typeof useTranslations>, type: RoomType): string {
  switch (type) {
    case 'single': return t('roomsSingle')
    case 'double': return t('roomsDouble')
    case 'triple': return t('roomsTriple')
  }
}

/**
 * Section 5 — room allocation, room upgrade and meal plan for the chosen stay.
 *
 * Rooms are server-recommended (lowest valid price) until the customer
 * touches a stepper. `state.room_allocations` being unset IS auto mode, and
 * the steppers then display the quote's recommendation.
 */
export function RoomsMealStep({
  state,
  catalog,
  locale,
  quote,
  refreshing,
  errorKey,
  whatsappHref,
  dispatch,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  quote: QuoteView | null
  refreshing: boolean
  errorKey: string
  whatsappHref?: string
  dispatch: Dispatch<BuilderAction>
}) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  const stay = catalog.accommodations.find((item) => item.id === state.accommodation_id)
  if (!stay) return null

  const people = (state.adults ?? 1) + (state.children ?? 0)
  const custom = Boolean(state.room_allocations?.length)
  const recommended = recommendedAllocations(quote, people)
  // Steppers show the customer's own rooms, else the server's recommendation.
  const allocations: RoomAllocationInput[] = custom ? state.room_allocations ?? [] : recommended ?? []
  const capacity = roomCapacity(allocations)
  const tooMany = roomsExceedPeople(people, allocations)
  const notEnough = !roomsFit(people, allocations)
  const problem = !allocations.length ? null : tooMany ? 'tooMany' : notEnough ? 'notEnough' : null
  const plan = quote?.rooms && quote.rooms.people === people ? quote.rooms : null
  const manual = errorKey === 'quoteRoomsManual'
  const money = (amount: number) => `${formatAmount(amount, locale)} ${common('egp')}`

  const setCount = (type: RoomType, count: number) => {
    const next: RoomAllocationInput[] = ROOM_TYPES.map((roomType) => ({
      type: roomType,
      count: roomType === type ? count : allocations.find((item) => item.type === roomType)?.count ?? 0,
    })).filter((item) => item.count > 0)
    dispatch({ type: 'setRooms', allocations: next })
  }

  const roomInfo = (type: RoomType) => plan?.room_types.find((item) => item.type === type)
  const roomHint = (type: RoomType): string | undefined => {
    const info = roomInfo(type)
    if (!info) return undefined
    if (!info.available) return t('roomTypeUnavailable')
    if (info.stay_total_per_room == null) return undefined
    return t('roomTypePerStay', { amount: money(info.stay_total_per_room) })
  }

  // Room-only leads the list (it's the baseline everything else is priced against).
  const meals = [...stay.meal_plans].sort((a, b) => (a.key === 'room_only' ? -1 : b.key === 'room_only' ? 1 : 0))

  return (
    <div className="space-y-6">
      <div>
        <div className="grid gap-2.5">
          {ROOM_TYPES.map((type) => (
            <Stepper
              key={type}
              label={roomTypeLabel(t, type)}
              hint={roomHint(type)}
              value={allocations.find((item) => item.type === type)?.count ?? 0}
              min={0}
              max={20}
              locale={locale}
              disabled={roomInfo(type)?.available === false}
              onChange={(count) => setCount(type, count)}
            />
          ))}
        </div>

        {problem ? (
          <p className="mt-2.5 text-xs font-semibold text-red-700" role="alert">
            {problem === 'tooMany'
              ? t('roomsTooMany')
              : t('roomsNotEnough', { people, n: formatCount(people, locale) })}
          </p>
        ) : (
          <p className="mt-2.5 text-xs text-ink-subtle">
            {t('roomsCapacity', { capacity: capacity || people, n: formatCount(capacity || people, locale) })}
          </p>
        )}

        <div aria-live="polite" className={cn('mt-3 space-y-2.5', refreshing && 'opacity-60')}>
          {manual && (
            <div className="space-y-3 rounded-xl border border-sand-300 bg-sand-100 p-3.5">
              <div>
                <p className="text-sm font-semibold text-sea-900">{t('roomsManualTitle')}</p>
                <p className="mt-1 text-xs text-ink-muted">{t('roomsManualHint')}</p>
              </div>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#0f7a3f]
                    px-4 text-sm font-semibold text-[#0f7a3f]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {t('whatsapp')}
                </a>
              )}
            </div>
          )}

          {!manual && !custom && !plan && <p className="text-xs text-ink-subtle">{t('roomsAwaitingDates')}</p>}

          {!manual && !custom && plan && (
            <div className="rounded-xl border border-sun-600 bg-sun-50 px-3.5 py-2.5 text-sm text-sea-900">
              <p className="font-semibold">{t('roomsRecommended', { people, n: formatCount(people, locale) })}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t('roomsRecommendedTotal', { amount: money(plan.accommodation_total) })}
              </p>
            </div>
          )}

          {!manual && custom && plan?.mode === 'custom' && (
            <div className="space-y-1 rounded-xl bg-sand-100 px-3.5 py-2.5 text-sm text-sea-900">
              <p className="font-semibold">
                {plan.recommended
                  ? t('roomsYoursVsRecommended', {
                      yours: money(plan.accommodation_total),
                      recommended: money(plan.recommended.accommodation_total),
                    })
                  : t('roomsYours', { yours: money(plan.accommodation_total) })}
              </p>
              {plan.recommended && (
                <p className="text-xs text-ink-muted">
                  {plan.difference > 0
                    ? t('roomsMoreThanRecommended', { amount: money(plan.difference) })
                    : plan.difference < 0
                      ? t('roomsLessThanRecommended', { amount: money(Math.abs(plan.difference)) })
                      : t('roomsSameAsRecommended')}
                </p>
              )}
            </div>
          )}

          {custom && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'useRecommendedRooms' })}
              className={cn(
                'min-h-11 rounded-full border-[1.5px] border-sea-900 px-4 text-sm font-semibold text-sea-900',
                'transition-colors hover:bg-sea-900/5',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600',
              )}
            >
              {t('roomsUseRecommended')}
            </button>
          )}
        </div>
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
                detail={`+${formatAmount(upgrade.extra_price_per_night, locale)} ${common('egp')} · ${t('perRoomPerNight')}`}
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
                detail={meal.price_per_person_per_night > 0 ? `+${formatAmount(meal.price_per_person_per_night, locale)} ${common('egp')} · ${t('perPersonPerNight')}` : t('included')}
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
