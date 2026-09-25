'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal snap rail — the mobile-first alternative to a grid ("Hierarchy
 * over uniformity" / "rails on mobile" in docs/m2/BRIEF.md). Prev/next
 * buttons are RTL-aware: they read the track's computed `direction` rather
 * than assuming a scrollLeft sign convention, since browsers disagree on
 * that in RTL.
 *
 * Children are responsible for their own width (e.g. `w-[85vw] sm:w-80`)
 * and should carry `rail-snap-item` — `<EditorialCard>` already does.
 */
export function Rail({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const ui = useTranslations('ui')
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const update = () => {
      const start = Math.abs(el.scrollLeft)
      setCanPrev(start > 4)
      setCanNext(start + el.clientWidth < el.scrollWidth - 4)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [children])

  const scrollByAmount = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const amount = el.clientWidth * 0.85
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollBy({ left: (rtl ? -direction : direction) * amount, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-subtle">{label}</h3>
        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            disabled={!canPrev}
            aria-label={ui('railPrev')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 text-ink-muted transition-colors hover:bg-sand-100 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
          >
            <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            disabled={!canNext}
            aria-label={ui('railNext')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 text-ink-muted transition-colors hover:bg-sand-100 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
          >
            <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </div>
      <div ref={trackRef} className="rail-snap -mx-4 gap-4 px-4 sm:mx-0 sm:px-0">
        {children}
      </div>
    </div>
  )
}
