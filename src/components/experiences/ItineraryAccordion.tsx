'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { localized, type ItineraryDay } from '@/lib/experiences'

export function ItineraryAccordion({ days }: { days: ItineraryDay[] }) {
  const t = useTranslations('experiences')
  const locale = useLocale()
  // First day open by default — the most common thing a reader wants to see.
  const [open, setOpen] = useState<number[]>(days.length ? [0] : [])

  if (!days.length) return null

  const toggle = (index: number) =>
    setOpen((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))

  return (
    <ol className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
      {days.map((day, index) => {
        const expanded = open.includes(index)
        const title = localized(day, 'title', locale)
        const description = localized(day, 'description', locale)
        return (
          <li key={`${day.day}-${index}`}>
            <h3>
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={expanded}
                aria-controls={`itinerary-panel-${index}`}
                id={`itinerary-trigger-${index}`}
                className="flex w-full items-center gap-4 px-5 py-4 text-start transition-colors hover:bg-sand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sea-500"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sea-50 font-display text-sm font-bold text-sea-700">
                  {day.day}
                </span>
                <span className="flex-1">
                  <span className="block text-[11px] uppercase tracking-wider text-sea-900/50">
                    {t('day', { day: day.day })}
                  </span>
                  <span className="block font-display text-base font-semibold text-sea-900">{title}</span>
                </span>
                <ChevronDown
                  className={cn('h-5 w-5 shrink-0 text-sea-600 transition-transform', expanded && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
            </h3>
            {expanded && description && (
              <div
                id={`itinerary-panel-${index}`}
                role="region"
                aria-labelledby={`itinerary-trigger-${index}`}
                className="px-5 pb-5 ltr:pl-[4.25rem] rtl:pr-[4.25rem]"
              >
                <p className="whitespace-pre-line text-sm leading-7 text-sea-900/75">{description}</p>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
