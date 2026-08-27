'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
        },
      ) => string
      reset: (widgetId?: string) => void
    }
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/**
 * Optional Cloudflare Turnstile widget. Renders nothing — and never fetches
 * Cloudflare's script — unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured.
 * That's the default for this project today, so this is inert until a real
 * site key is set.
 */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Lazy initializer (not an effect) so an already-present script — e.g. a
  // second Turnstile instance on the same page — doesn't need a synchronous
  // setState-in-effect to pick that up.
  const [scriptLoaded, setScriptLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.turnstile),
  )

  useEffect(() => {
    if (!SITE_KEY || scriptLoaded) return
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => setScriptLoaded(true))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'true'
    script.addEventListener('load', () => setScriptLoaded(true))
    document.head.appendChild(script)
  }, [scriptLoaded])

  useEffect(() => {
    if (!SITE_KEY || !scriptLoaded || !containerRef.current || !window.turnstile) return
    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token: string) => onToken(token),
      'error-callback': () => onToken(null),
      'expired-callback': () => onToken(null),
    })
    return () => {
      try {
        window.turnstile?.reset(widgetId)
      } catch {
        // widget already gone — nothing to clean up
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded])

  if (!SITE_KEY) return null

  return <div ref={containerRef} className="cf-turnstile mt-1" />
}
