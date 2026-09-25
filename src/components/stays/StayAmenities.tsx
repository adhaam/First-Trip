'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { buildAmenityIconMap } from '@/lib/amenities'
import { groupAmenities, type AmenityGroupKey } from '@/lib/stays'

const amenityIcons = buildAmenityIconMap()

const GROUP_LABEL_KEY: Record<AmenityGroupKey, 'amenityGroupWater' | 'amenityGroupComfort' | 'amenityGroupFood' | 'amenityGroupOutdoor' | 'amenityGroupOther'> = {
  water: 'amenityGroupWater',
  comfort: 'amenityGroupComfort',
  food: 'amenityGroupFood',
  outdoor: 'amenityGroupOutdoor',
  other: 'amenityGroupOther',
}

/** Grouped amenities — see groupAmenities() in lib/stays.ts for the grouping rule. */
export function StayAmenities({ amenities }: { amenities: string[] }) {
  const t = useTranslations('stays')
  const groups = groupAmenities(amenities)

  if (groups.length === 0) return null

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-sea-900">{t('detail.amenitiesTitle')}</h2>
      <div className="mt-6 space-y-7">
        {groups.map((group) => (
          <div key={group.key}>
            <h3 className="eyebrow text-sun-700">{t(`detail.${GROUP_LABEL_KEY[group.key]}`)}</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.items.map((amenity, i) => {
                const Icon = amenityIcons[amenity] || Check
                return (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-sand-300 bg-card px-4 py-3"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sea-50 text-sea-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-ink-muted">{amenity}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
