import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The map-coordinate kicker — `28.49°N · 34.51°E` — used as a small,
 * factual signature above a heading. `coords` must be a real coordinate for
 * the place being described; it is decorative-but-true, never invented
 * (see "Map motif" in docs/m2/BRIEF.md).
 *
 * Arabic never gets the Latin uppercase + letter-spacing treatment (see the
 * `html[dir="rtl"] .eyebrow` override in globals.css) — same visual weight,
 * delivered through color and the hairline rule instead.
 */
export function Eyebrow({
  children,
  coords,
  tone = 'ink',
  className,
}: {
  children: ReactNode
  /** Real coordinates only, e.g. "28.49°N · 34.51°E". */
  coords?: string
  tone?: 'ink' | 'light'
  className?: string
}) {
  return (
    <span
      className={cn(
        'eyebrow',
        tone === 'light' ? 'text-sun-200' : 'text-sun-700',
        className,
      )}
    >
      <span aria-hidden className="h-px w-6 bg-current" />
      {children}
      {coords && (
        <span
          className={cn(
            'ltr-only font-mono text-[0.65rem] normal-case tracking-normal',
            tone === 'light' ? 'text-sun-200/85' : 'text-sun-700',
          )}
        >
          · {coords}
        </span>
      )}
    </span>
  )
}
