'use client'

import { useEffect, useRef, useState } from 'react'
import { quoteReadiness, toQuotePayload } from '@/lib/trip-builder/sections'
import type { BuilderState } from '@/lib/trip-builder/types'
import { quoteErrorKey, type QuoteView } from '@/lib/trip-builder/view'

const DEBOUNCE_MS = 500

/**
 * Debounced, abort-safe access to `POST /api/trip-requests/quote`.
 *
 * - Debounces 500ms after the last change so typing/stepping doesn't fire a
 *   request per keystroke.
 * - Aborts the in-flight request when the journey changes again before it
 *   resolves, so a slow, stale response can never overwrite a fresher one.
 * - Keeps the last good quote visible while a refresh is in flight (or has
 *   failed) — the price panel should never flash blank because the visitor
 *   nudged a stepper.
 *
 * The server is the only source of truth for the total and payment plan;
 * this hook never computes either — it only fetches, debounces and caches.
 */
export function useQuote(state: BuilderState, locale: 'ar' | 'en') {
  const [quote, setQuote] = useState<QuoteView | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [errorKey, setErrorKey] = useState('')
  const requestId = useRef(0)

  const readiness = quoteReadiness(state)

  useEffect(() => {
    if (!readiness.ready) {
      setRefreshing(false)
      return
    }

    const controller = new AbortController()
    const myId = ++requestId.current

    const timer = window.setTimeout(async () => {
      setRefreshing(true)
      setErrorKey('')
      try {
        const response = await fetch('/api/trip-requests/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toQuotePayload(state, locale)),
          signal: controller.signal,
        })
        const body = (await response.json()) as QuoteView & { code?: string }
        if (!response.ok) throw new Error(body.code ?? String(response.status))
        if (requestId.current === myId) setQuote(body)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        if (requestId.current === myId) setErrorKey(quoteErrorKey((error as Error).message))
      } finally {
        if (requestId.current === myId) setRefreshing(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // `readiness.ready` is derived from `state`; re-running on `state` alone
    // covers both and avoids a redundant dependency on a freshly-computed object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, locale, readiness.ready])

  return { quote, refreshing, errorKey, ready: readiness.ready, missing: readiness.missing }
}
