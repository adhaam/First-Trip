'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const LOCKUP_HEIGHT: Record<LogoSize, string> = {
  sm: 'h-7 w-auto',
  md: 'h-9 w-auto',
  lg: 'h-14 w-auto',
  xl: 'h-20 w-auto',
}

const MARK_SIZE: Record<LogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
}

/** Text sizes for the last-resort wordmark, matched to the lockup heights. */
const WORDMARK_TEXT: Record<LogoSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

/**
 * Single source of truth for the WEEMAP SINAI logo — official artwork,
 * never recolored or filtered. `tone="ink"` wraps the mark in a dark
 * chip since the artwork itself is a light cream+orange lockup and
 * requires a dark/high-contrast host surface (see WEEMAP_SINAI_BRAND_PACK
 * usage rules).
 *
 * ─── Why the brand assets bypass the image optimiser ────────────────────────
 * `unoptimized` renders the file straight from `/public` on the CDN instead of
 * routing it through `/_next/image`. Two reasons:
 *
 *  1. There is nothing left to optimise. The lockup is already a hand-encoded
 *     720x301 WebP at 41 KB for a mark that renders 28-80px tall, and the pin
 *     is a 192px PNG. Next's own guidance is to skip the optimiser for small
 *     images.
 *  2. `/_next/image` is a Vercel function, and on a deployment with Deployment
 *     Protection enabled it answers every request with a 302 to the Vercel SSO
 *     page. An <img> that follows that redirect receives HTML, cannot decode
 *     it, and shows the browser's broken-image icon. That is exactly what
 *     happened on the ad-readiness Preview: `/brand/logo.webp` served 200 with
 *     valid `RIFF....WEBP` bytes, while
 *     `/_next/image?url=%2Fbrand%2Flogo.webp&w=256&q=75` returned 302 -> SSO.
 *     The brand mark is the one asset that must never depend on a function
 *     being reachable.
 *
 * A two-step fallback backs this up so a failed request can never leave a
 * broken-image icon in the header or the footer: WebP -> the original PNG
 * artwork -> a styled text wordmark.
 */
export function Logo({
  size = 'md',
  variant = 'lockup',
  tone = 'ink',
  className,
  priority,
}: {
  size?: LogoSize
  variant?: 'lockup' | 'mark'
  tone?: 'ink' | 'light'
  className?: string
  priority?: boolean
}) {
  // 0 = preferred asset, 1 = original PNG artwork, 2 = text wordmark
  const [step, setStep] = useState(0)
  const isLockup = variant === 'lockup'
  // The mark has no intermediate PNG to fall back to — it already is the PNG —
  // so it goes straight to the wordmark rather than re-requesting a dead URL.
  const next = () => setStep((current) => (isLockup ? Math.min(current + 1, 2) : 2))

  let image
  if (step === 2) {
    // Last resort. Never a broken-image icon.
    image = (
      <span
        className={cn(
          'font-display font-extrabold uppercase tracking-tight',
          WORDMARK_TEXT[size],
          tone === 'light' ? 'text-white' : 'text-weemap-cream',
        )}
      >
        WEEMAP{isLockup && <span className="text-weemap-orange"> SINAI</span>}
      </span>
    )
  } else if (isLockup) {
    image = (
      <Image
        // 720x301 WebP (41 KB) rather than the 1800x752 PNG (304 KB) this used
        // to load on every page for a lockup that renders 28-80px tall. Still
        // well over 3x the largest rendered height, so it stays crisp.
        src={step === 0 ? '/brand/logo.webp' : '/brand/logo.png'}
        alt="WEEMAP SINAI"
        width={step === 0 ? 720 : 1800}
        height={step === 0 ? 301 : 752}
        priority={priority}
        unoptimized
        onError={next}
        className={cn(LOCKUP_HEIGHT[size], 'object-contain')}
      />
    )
  } else {
    image = (
      <Image
        src="/brand/icon-192.png"
        alt="WEEMAP SINAI"
        width={192}
        height={192}
        priority={priority}
        unoptimized
        onError={next}
        className={cn(MARK_SIZE[size], 'object-contain')}
      />
    )
  }

  if (tone === 'light') {
    return <span className={cn('inline-flex items-center', className)}>{image}</span>
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xl bg-weemap-charcoal px-2.5 py-1.5',
        className,
      )}
    >
      {image}
    </span>
  )
}
