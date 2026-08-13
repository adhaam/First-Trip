'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Scroll-triggered reveal.
 *
 * Deliberately CSS-driven rather than framer-motion: the whole effect is one
 * opacity + translateY transition (see `.reveal` in globals.css) toggled by a
 * shared IntersectionObserver, so a page with 40 revealed elements still costs
 * ~zero JS per frame. Respects `prefers-reduced-motion` through the stylesheet.
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

interface RevealProps {
  children: ReactNode
  /** Stagger in ms — use the index when mapping over a list. */
  delay?: number
  className?: string
  as?: ElementType
}

export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = getObserver()
    if (!io) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no IntersectionObserver support, just show the content
      setVisible(true)
      return
    }

    callbacks.set(el, () => setVisible(true))
    io.observe(el)

    return () => {
      io.unobserve(el)
      callbacks.delete(el)
    }
  }, [])

  return (
    <Tag
      ref={ref}
      className={cn('reveal', className)}
      data-visible={visible ? 'true' : 'false'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
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
