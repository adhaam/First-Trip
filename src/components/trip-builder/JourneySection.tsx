'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { formatCount, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SectionSummary } from '@/lib/trip-builder/summaries'

/**
 * Resolves a `SectionSummary` to its display text via an exhaustive switch of
 * literal `t('...')` calls, rather than `t(summary.key, summary.values)`.
 *
 * This is good practice on its own (grep-able, type-checked per key), but it
 * is NOT a fix for a real constraint: verified against a standalone
 * `next-intl` translator with these exact merged messages, `summary.key`
 * resolves correctly either way. What we observed in the running local dev
 * server was every `builder.summary*` key — dynamic AND literal — failing
 * with `MISSING_MESSAGE`, while an unrelated file (`TripPackageCard.tsx`,
 * `explore` namespace, also a plain literal `t('explorePackage')`) showed the
 * identical symptom at the same time. That points to a Turbopack dev-server
 * staleness/HMR artifact on this long-running, heavily-edited process, not a
 * defect in these keys or this call pattern — see the verification report.
 * `summaryStay` is a pure name passthrough (the stay's own localized name)
 * and never had a message to begin with.
 */
function useSectionSummaryText(summary: SectionSummary | undefined, locale: 'ar' | 'en'): string | undefined {
  const t = useTranslations('builder')
  if (!summary) return undefined
  switch (summary.key) {
    case 'summaryStayOnly': return t('summaryStayOnly')
    case 'summaryTransportPackageBus': return t('summaryTransportPackageBus', summary.values as { origin: string })
    case 'summaryTransportHiace': return t('summaryTransportHiace', summary.values as { origin: string })
    case 'summaryTransportDates': return t('summaryTransportDates', summary.values as { pattern: string; arrival: string; return: string })
    case 'summaryStayDates': {
      const values = summary.values as { arrival: string; departure: string; nights: number }
      return t('summaryStayDates', { ...values, n: formatCount(values.nights, locale) })
    }
    case 'summaryTravelers': {
      const values = summary.values as { adults: number; children: number }
      return t('summaryTravelers', { ...values, n: formatCount(values.adults, locale) })
    }
    case 'summaryTravelersWithChildren': {
      const values = summary.values as { adults: number; children: number }
      return t('summaryTravelersWithChildren', { adults: formatCount(values.adults, locale), children: formatCount(values.children, locale) })
    }
    case 'summaryTransferOnly': return t('summaryTransferOnly')
    case 'summaryStay': return summary.values?.stay as string | undefined
    case 'summaryRooms': {
      const values = summary.values as { rooms: number; capacity: number }
      return t('summaryRooms', { rooms: values.rooms, capacity: formatCount(values.capacity, locale), n: formatCount(values.rooms, locale) })
    }
    case 'summaryRoomsMeal': {
      const values = summary.values as { rooms: number; capacity: number; meal: string }
      return t('summaryRoomsMeal', { rooms: values.rooms, capacity: formatCount(values.capacity, locale), meal: values.meal, n: formatCount(values.rooms, locale) })
    }
    case 'summaryExperiences': {
      const values = summary.values as { count: number }
      return t('summaryExperiences', { ...values, n: formatCount(values.count, locale) })
    }
    default: return undefined
  }
}

/**
 * The one shell every journey step (transport, dates, travellers, stay,
 * rooms, experiences) renders through — collapsed one-line recap with an
 * "Edit" affordance, or expanded with its full controls. A number + icon on
 * the route line ties it visually to `OverviewTimeline` (same motif, same
 * "plotting a route" read the brief asks for).
 *
 * Only the active section renders its (potentially heavy) children — this
 * keeps closed steps cheap and keeps focus-order sane, since a collapsed
 * step has nothing focusable inside it besides its own header.
 */
export function JourneySection({
  index,
  icon,
  title,
  subtitle,
  active,
  complete,
  optional,
  skippable,
  summary,
  locale,
  onActivate,
  onSkip,
  children,
}: {
  index: number
  icon: ReactNode
  title: string
  subtitle?: string
  active: boolean
  complete: boolean
  optional?: boolean
  /** Shows a "Skip" action in the collapsed header (e.g. stay is optional for transfer modes). */
  skippable?: boolean
  summary?: SectionSummary
  locale: 'ar' | 'en'
  onActivate: () => void
  onSkip?: () => void
  children: ReactNode
}) {
  const t = useTranslations('builder')
  const summaryText = useSectionSummaryText(summary, locale)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const wasActive = useRef(active)

  useEffect(() => {
    // Move focus to the newly active section's heading — the "focus moves to
    // the next section heading on completion" requirement — but never on the
    // very first render, or every step would steal focus from the page load.
    if (active && !wasActive.current) headingRef.current?.focus()
    wasActive.current = active
  }, [active])

  return (
    <section
      className={cn(
        'relative rounded-3xl border-[1.5px] bg-white shadow-sm transition-colors',
        active ? 'border-sea-900/30' : 'border-sand-300',
      )}
    >
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-bold',
            complete ? 'border-sun-600 bg-sun-500 text-on-accent' : active ? 'border-sea-900 text-sea-900' : 'border-sand-300 text-ink-subtle',
          )}
        >
          {complete ? <Check className="h-5 w-5" /> : icon}
        </span>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onActivate}
            aria-expanded={active}
            className="flex w-full min-h-11 items-center justify-between gap-3 rounded-xl text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <h2 ref={headingRef} tabIndex={-1} className="font-display text-lg font-bold leading-none text-sea-900 outline-none sm:text-xl">
                  {title}
                </h2>
                {optional && (
                  <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-subtle">
                    {t('optional')}
                  </span>
                )}
              </span>
              {!active && summaryText && <p className="mt-1 truncate text-sm text-ink-muted">{summaryText}</p>}
              {!active && !summaryText && subtitle && <p className="mt-1 text-sm text-ink-subtle">{subtitle}</p>}
            </span>
            {!active && (
              <span className="shrink-0 text-xs font-semibold text-sea-700 underline-offset-4 hover:underline">{t('edit')}</span>
            )}
          </button>

          {active && subtitle && <p className="mt-1 text-sm text-ink-subtle">{subtitle}</p>}
        </div>

        <span aria-hidden className="hidden shrink-0 self-start pt-1 text-xs font-semibold tabular-nums text-ink-subtle sm:block">
          {formatNumber(index, locale)}
        </span>
      </div>

      {active && (
        <div className="border-t border-sand-200 p-5 pt-5 sm:p-6 sm:pt-6">
          {children}
          {skippable && onSkip && (
            <button type="button" onClick={onSkip} className="mt-4 min-h-11 text-sm font-semibold text-ink-subtle underline-offset-4 hover:text-sea-900 hover:underline">
              {t('skip')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * The always-expanded counterpart to `JourneySection` — for the two steps
 * that never collapse: the Overview recap (nothing to "edit" there, it just
 * reflects the sections above it) and Contact & request (the terminal step).
 * Same route-line numbering and icon treatment, no header button.
 */
export function StaticSection({
  index,
  icon,
  title,
  subtitle,
  locale,
  children,
}: {
  index: number
  icon: ReactNode
  title: string
  subtitle?: string
  locale: 'ar' | 'en'
  children: ReactNode
}) {
  return (
    <section className="relative rounded-3xl border-[1.5px] border-sand-300 bg-white shadow-sm">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span aria-hidden className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] border-sea-900 text-sea-900">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-none text-sea-900 sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-subtle">{subtitle}</p>}
        </div>
        <span aria-hidden className="hidden shrink-0 self-start pt-1 text-xs font-semibold tabular-nums text-ink-subtle sm:block">
          {formatNumber(index, locale)}
        </span>
      </div>
      <div className="border-t border-sand-200 p-5 pt-5 sm:p-6 sm:pt-6">{children}</div>
    </section>
  )
}
