'use client'

import { useEffect, useState } from 'react'
import { quoteReadiness, toQuotePayload } from '@/lib/trip-builder/sections'
import type { BuilderState } from '@/lib/trip-builder/types'
import { quoteErrorKey, type QuoteView } from '@/lib/trip-builder/view'
import { settledQuote, type QuoteAnswer } from '@/lib/trip-builder/quote-state'

const DEBOUNCE_MS = 500

/**
 * Debounced, abort-safe access to `POST /api/trip-requests/quote`.
 *
 * - Keyed on the exact priced payload (not the whole builder state), so
 *   typing contact details never re-prices and every answer is tied to the
 *   selections it was priced for.
 * - Aborts the in-flight request when the payload changes again before it
 *   resolves, so a slow, stale response can never overwrite a fresher one.
 * - Never shows a total for selections it wasn't priced for: while the new
 *   payload is debouncing or loading, `quote` is null and `refreshing` is
 *   true ("Recalculating…"); after a failure the total stays hidden. Only
 *   `lastQuote` (for the room steppers' recommendation) may be older.
 *
 * The server is the only source of truth for the total and payment plan;
 * this hook never computes either — it only fetches, debounces and caches.
 */
export function useQuote(state: BuilderState, locale: 'ar' | 'en') {
  const [answer, setAnswer] = useState<QuoteAnswer | null>(null)
  const [lastQuote, setLastQuote] = useState<QuoteView | null>(null)

  const readiness = quoteReadiness(state)
  const payload = readiness.ready ? JSON.stringify(toQuotePayload(state, locale)) : null

  useEffect(() => {
    if (!payload) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/trip-requests/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: controller.signal,
        })
        const body = (await response.json()) as QuoteView & { code?: string }
        if (!response.ok) throw new Error(body.code ?? String(response.status))
        setAnswer({ key: payload, quote: body, errorKey: '' })
        setLastQuote(body)
      } catch (error) {
        if ((error as Error).name === 'AbortError' || controller.signal.aborted) return
        setAnswer({ key: payload, quote: null, errorKey: quoteErrorKey((error as Error).message) })
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [payload])

  const settled = settledQuote(answer, payload)
  return {
    quote: settled.quote,
    lastQuote,
    refreshing: settled.refreshing,
    errorKey: settled.errorKey,
    ready: readiness.ready,
    missing: readiness.missing,
  }
}
