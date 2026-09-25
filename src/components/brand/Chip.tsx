'use client'

import type { ReactNode } from 'react'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * A filter/category pill. Renders as a `<Link>` when `href` is given
 * (category navigation), otherwise a toggle `<button>` (in-page filter
 * state) — the two things every chip row on Book Dahab / Sinai Trips /
 * Merch / Rent actually needs, unified into one component.
 */
export function Chip({
  selected = false,
  onClick,
  href,
  icon,
  count,
  children,
  className,
}: {
  selected?: boolean
  onClick?: () => void
  href?: string
  icon?: ReactNode
  count?: number
  children: ReactNode
  className?: string
}) {
  const classes = cn(
    'rail-snap-item inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500',
    selected
      ? 'border-sea-900 bg-sea-900 text-sand-50'
      : 'border-sand-300 bg-card text-ink-muted hover:border-sea-900/40 hover:text-ink',
    className,
  )

  const content = (
    <>
      {icon && (
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
      )}
      <span>{children}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'rounded-full px-1.5 text-xs font-bold tabular-nums',
            selected ? 'bg-white/20' : 'bg-sand-200 text-ink-subtle',
          )}
        >
          {count}
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} aria-current={selected ? 'page' : undefined} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={classes}>
      {content}
    </button>
  )
}

/**
 * Horizontal scroll row for a set of `<Chip>`s — snap-scrolls on mobile,
 * wraps naturally once there's room (it's a flex row, not a fixed-width
 * rail, so it degrades to a normal wrapping row when callers want that).
 */
export function ChipRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rail-snap -mx-4 gap-2 px-4 pb-1 sm:mx-0 sm:px-0', className)}>
      {children}
    </div>
  )
}
