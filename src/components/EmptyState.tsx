'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The one empty state.
 *
 * There were three different treatments before: a bordered card with an icon on
 * Merch and Rent, and a bare line of low-contrast grey text on Book Dahab and
 * Sinai Trips. None of them offered a way out of the filter that produced the
 * empty result, which leaves the visitor stuck on a page with nothing on it.
 */
export function EmptyState({
  title,
  hint,
  onClear,
  icon,
  className,
}: {
  title: string
  hint?: string
  /** Shows a "clear filters" action. Omit when there is nothing to clear. */
  onClear?: () => void
  icon?: ReactNode
  className?: string
}) {
  const states = useTranslations('states')

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-card/60 px-6 py-16 text-center',
        className,
      )}
    >
      <span aria-hidden className="text-sun-700">
        {icon ?? <SearchX className="h-8 w-8" />}
      </span>
      <p className="max-w-sm text-sm font-medium text-ink-muted">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-subtle">{hint}</p>}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full border-[1.5px] border-sea-900 px-5 text-sm font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-700"
        >
          {states('clearFilters')}
        </button>
      )}
    </div>
  )
}

/**
 * Announces how many results a filter produced.
 *
 * Filtering is a keyboard/pointer action whose entire outcome is visual — the
 * grid silently swaps out. Without a live region a screen-reader user presses
 * "Camps" and is told nothing at all.
 */
export function ResultCount({
  count,
  label,
  className,
}: {
  count: number
  /** Already-pluralised, already-translated label, e.g. "12 places". */
  label: string
  className?: string
}) {
  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      className={cn('text-sm text-ink-subtle', className)}
      data-count={count}
    >
      {label}
    </p>
  )
}
