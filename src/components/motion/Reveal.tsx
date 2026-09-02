'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Scroll-triggered reveal — progressive enhancement, not a gate.
 *
 * Deliberately CSS-driven rather than framer-motion: the whole effect is one
 * opacity + translateY transition (see `.reveal` in globals.css) toggled by a
 * shared IntersectionObserver, so a page with 40 revealed elements still costs
 * ~zero JS per frame. Respects `prefers-reduced-motion` through the stylesheet.
 *
 * ─── Why the default state is VISIBLE ───────────────────────────────────────
 * This component used to render `data-visible="false"` on the server, which the
 * stylesheet turned into `opacity: 0`. That meant every page — including the
 * hero headline and both hero CTAs — shipped invisible and only appeared once
 * React had hydrated and an observer had fired. With JS disabled, blocked or
 * failing, the content never appeared at all.
 *
 * Now: the server and the first client render both emit `data-visible="true"`.
 * After mount, a layout effect measures the element. Only elements sitting
 * safely below the fold are flipped to hidden and put under observation — and
 * because they are off-screen at that moment, nobody sees them disappear.
 * Anything already on screen stays visible forever and never animates, so the
 * LCP element is never delayed.
 *
 * Pass `always` to opt a subtree out of the effect entirely (hero, sticky CTAs,
 * anything that must never move).
 */

let observer: IntersectionObserver | null = null
const callbacks = new WeakMap<Element, () => void>()

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          callbacks.get(entry.target)?.()
          observer?.unobserve(entry.target)
          callbacks.delete(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
  }
  return observer
}

/** useLayoutEffect warns during SSR; this component renders on the server too. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface RevealProps {
  children: ReactNode
  /** Stagger in ms — use the index when mapping over a list. */
  delay?: number
  className?: string
  as?: ElementType
  /**
   * Never hide or animate this subtree. Use for above-the-fold and
   * conversion-critical content that must be painted immediately.
   */
  always?: boolean
}

export function Reveal({ children, delay = 0, className, as: Tag = 'div', always = false }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  // Starts true so SSR HTML and the first client render agree — no hydration
  // mismatch, and no flash of missing content.
  const [hidden, setHidden] = useState(false)
  const [armed, setArmed] = useState(false)

  useIsomorphicLayoutEffect(() => {
    if (always) return
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) return

    const io = getObserver()
    if (!io) return

    // Only take over elements that are comfortably below the fold right now.
    // Anything on screen (or nearly on screen) is left visible permanently:
    // hiding it here would be a visible flash, and it would delay the LCP.
    const rect = el.getBoundingClientRect()
    const belowTheFold = rect.top > window.innerHeight * 0.9
    if (!belowTheFold) return

    setHidden(true)
    setArmed(true)

    callbacks.set(el, () => setHidden(false))
    io.observe(el)

    return () => {
      io.unobserve(el)
      callbacks.delete(el)
    }
  }, [always])

  return (
    <Tag
      ref={ref}
      className={cn('reveal', className)}
      data-visible={hidden ? 'false' : 'true'}
      data-reveal={armed ? 'armed' : undefined}
      style={delay && armed ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

/**
 * Pointer-tracking glow. Writes --mx/--my so the CSS radial-gradient in
 * `.glow-follow` follows the cursor. Touch devices simply never fire it and
 * fall back to the :hover/:active styles.
 */
export function GlowCard({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: ElementType
}) {
  const ref = useRef<HTMLElement>(null)

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current
    if (!el || e.pointerType === 'touch') return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <Tag ref={ref} onPointerMove={onMove} className={cn('glow-follow', className)}>
      {children}
    </Tag>
  )
}
