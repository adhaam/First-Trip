'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExperienceItineraryStep } from '@/lib/types'

/**
 * Itinerary-only-where-data-has-it accordion. Adapted from the read-only
 * `feat/signature-experiences` branch's `ItineraryAccordion` component for
 * today's schema: that branch's `ItineraryDay` carried a numeric `day` and a
 * `localized()` helper reading `title_ar`/`title_en` pairs off a generic
 * shape; `ExperienceItineraryStep` here is the same ar/en pair without a day
 * number, so the day badge is the step's position, not admin-entered data —
 * never a real calendar date (see BRIEF.md "Never invent trip
 * schedules/itinerary days").
 */
export function SignatureItinerary({ steps }: { steps: ExperienceItineraryStep[] }) {
  const t = useTranslations('signatureV2')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [open, setOpen] = useState<number[]>(steps.length ? [0] : [])

  if (steps.length === 0) return null

  const toggle = (index: number) =>
    setOpen((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))

  return (
    <div>
      <ol className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white">
        {steps.map((stepItem, index) => {
          const expanded = open.includes(index)
          const title = ar ? stepItem.title_ar : stepItem.title_en
          const description = ar ? stepItem.description_ar : stepItem.description_en
          return (
            <li key={index}>
              <h3>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={expanded}
                  aria-controls={`sig-itinerary-panel-${index}`}
                  id={`sig-itinerary-trigger-${index}`}
                  className="flex w-full items-center gap-4 px-5 py-4 text-start transition-colors hover:bg-sand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sun-500"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun-500/10 font-display text-sm font-bold text-sun-700">
                    {index + 1}
                  </span>
                  <span className="flex-1 font-display text-base font-semibold text-sea-900">{title}</span>
                  <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-subtle transition-transform', expanded && 'rotate-180')} aria-hidden />
                </button>
              </h3>
              {expanded && description && (
                <div
                  id={`sig-itinerary-panel-${index}`}
                  role="region"
                  aria-labelledby={`sig-itinerary-trigger-${index}`}
                  className="px-5 pb-5 ps-[4.25rem]"
                >
                  <p className="whitespace-pre-line text-sm leading-7 text-ink-muted">{description}</p>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-ink-subtle">{t('itineraryNote')}</p>
    </div>
  )
}
