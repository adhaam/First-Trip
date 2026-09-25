'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatAmount } from '@/lib/format'
import { activeMealPlans, roomRateRows, type RoomTypeKey } from '@/lib/stays'
import type { Accommodation, RoomUpgrade } from '@/lib/types'

const ROOM_LABEL_KEY: Record<RoomTypeKey, 'roomSingle' | 'roomDouble' | 'roomTriple'> = {
  single: 'roomSingle',
  double: 'roomDouble',
  triple: 'roomTriple',
}

/** Room rates, room upgrades and meal plan supplements — all read from data, nothing hardcoded. */
export function StayRoomsSection({
  accommodation,
}: {
  accommodation: Pick<Accommodation, 'price_single_room' | 'price_double_room' | 'price_triple_room' | 'room_upgrades' | 'meal_plans'>
}) {
  const t = useTranslations('stays')
  const common = useTranslations('common')
  const locale = useLocale()

  const rows = roomRateRows(accommodation)
  const upgrades = (accommodation.room_upgrades ?? []).filter((u: RoomUpgrade) => u.is_active && u.extra_price_per_night > 0)
  const mealPlans = activeMealPlans(accommodation.meal_plans)

  if (rows.length === 0 && mealPlans.length === 0) return null

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {rows.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-bold text-sea-900">{t('detail.roomsTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-subtle">{t('detail.roomsHint')}</p>

          <ul className="mt-5 space-y-2.5">
            {rows.map((row) => (
              <li
                key={row.type}
                className="flex items-start justify-between gap-3 rounded-xl border border-sand-300 bg-card px-4 py-3.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-sea-900">{t(`detail.${ROOM_LABEL_KEY[row.type]}`)}</div>
                  {row.occupancy > 1 && (
                    <div className="mt-0.5 text-xs text-ink-subtle">
                      {t('detail.perPersonPerNight', { amount: `${formatAmount(row.pricePerPerson, locale)} ${common('egp')}` })}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-end">
                  <span className="font-display text-lg font-bold text-sea-900">{formatAmount(row.pricePerRoom, locale)}</span>{' '}
                  <span className="text-xs font-semibold text-ink-muted">{common('egp')}</span>
                </div>
              </li>
            ))}
          </ul>

          {upgrades.length > 0 && (
            <div className="mt-6">
              <h3 className="eyebrow text-sun-700">{t('detail.upgradesTitle')}</h3>
              <ul className="mt-3 space-y-2">
                {upgrades.map((upgrade) => (
                  <li
                    key={upgrade.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-sand-300 bg-sand-50 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-ink">{locale === 'ar' ? upgrade.name_ar : upgrade.name_en}</span>
                    <span className="shrink-0 font-semibold text-sea-900">
                      {t('detail.upgradeSupplement', { amount: `${formatAmount(upgrade.extra_price_per_night, locale)} ${common('egp')}` })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {mealPlans.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-bold text-sea-900">{t('detail.mealPlansTitle')}</h2>
          <ul className="mt-5 space-y-2.5">
            {mealPlans.map((plan) => (
              <li
                key={plan.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-sand-300 bg-card px-4 py-3.5"
              >
                <span className="text-sm font-semibold text-sea-900">{locale === 'ar' ? plan.label_ar : plan.label_en}</span>
                <span className="shrink-0 text-sm font-medium text-ink-muted">
                  {plan.price_per_person_per_night > 0
                    ? t('detail.mealPlanSupplement', { amount: `${formatAmount(plan.price_per_person_per_night, locale)} ${common('egp')}` })
                    : t('detail.mealPlanIncluded')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
