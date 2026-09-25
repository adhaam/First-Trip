'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { SearchX, AlertTriangle, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_ICON = {
  'no-results': <SearchX className="h-8 w-8" />,
  error: <AlertTriangle className="h-8 w-8" />,
  curating: <Compass className="h-9 w-9" />,
} as const

/**
 * The empty state, now in three flavours.
 *
 * `no-results` (the default) is exactly the original component's look —
 * every existing call site (Book Dahab, Sinai Trips, Merch, Rent) passes no
 * `variant`, so nothing about their rendering changes.
 *
 * `curating` is for zero *inventory*, not a filter that happened to match
 * nothing — there is a real difference between "you filtered too hard" and
 * "WEEMAP hasn't listed anything here yet", and a bordered dashed box reading
 * "no results" was dishonest for the second case. It gets the brand's topo
 * texture, a calmer icon treatment, and room for a primary CTA (`action`)
 * alongside the secondary one (`onClear`) rather than reading as a dead end.
 *
 * `error` covers a failed fetch — same shape as `no-results` but with a
 * firmer (non-dashed) border, since "try again" is a different ask than
 * "clear your filters".
 */
export function EmptyState({
  title,
  hint,
  onClear,
  action,
  icon,
  variant = 'no-results',
  className,
}: {
  title: string
  hint?: string
  /** Shows a "clear filters" action. Omit when there is nothing to clear. */
  onClear?: () => void
  /** A primary CTA slot, e.g. a `<ButtonLink>` to WhatsApp or another surface. */
  action?: ReactNode
  icon?: ReactNode
  variant?: 'curating' | 'no-results' | 'error'
  className?: string
}) {
  const states = useTranslations('states')

  const clearButton = onClear && (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex min-h-11 items-center justify-center rounded-full border-[1.5px] border-sea-900 px-5 text-sm font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-700"
    >
      {states('clearFilters')}
    </button>
  )

  if (variant === 'curating') {
    return (
      <div
        className={cn(
          'topo-bg relative overflow-hidden rounded-3xl border-[1.5px] border-sand-300 bg-sand-100 px-6 py-16 text-center sm:px-10 sm:py-20',
          className,
        )}
      >
        <span
          aria-hidden
          className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-sun-500/40 bg-sand-50 text-sun-700"
        >
          {icon ?? DEFAULT_ICON.curating}
        </span>
        <p className="mx-auto max-w-md font-display text-xl font-bold text-sea-900 sm:text-2xl">{title}</p>
        {hint && <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-ink-muted">{hint}</p>}
        {(action || clearButton) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {action}
            {clearButton}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-16 text-center',
        variant === 'error'
          ? 'rounded-2xl border-[1.5px] border-sand-300 bg-sand-100'
          : 'rounded-2xl border border-dashed border-sand-300 bg-card/60',
        className,
      )}
    >
      <span aria-hidden className="text-sun-700">
        {icon ?? DEFAULT_ICON[variant]}
      </span>
      <p className="max-w-sm text-sm font-medium text-ink-muted">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-subtle">{hint}</p>}
      {(action || clearButton) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action}
          {clearButton}
        </div>
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
