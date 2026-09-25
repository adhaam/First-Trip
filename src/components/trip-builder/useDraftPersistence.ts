'use client'

import { type Dispatch, useEffect, useRef } from 'react'
import { applyPrefill, type BuilderAction } from '@/lib/trip-builder/state'
import { clearDraft, loadDraft, saveDraft } from '@/lib/trip-builder/storage'
import { initialBuilderState } from '@/lib/trip-builder/state'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'

const SAVE_DEBOUNCE_MS = 350

/**
 * Owns the local-only lifecycle of the draft: hydrate from `localStorage` on
 * mount, layer the URL prefill (`?stay=`, `?mode=`, `?trip=`, `?package=`,
 * `?from=`) on top of it, then keep saving on every change until the visitor
 * either submits (the caller calls `clear()`) or the tab closes.
 *
 * Hydration is deliberately a `useEffect`, not render-time state — the
 * server-rendered shell must match the client's first paint before
 * `localStorage` (which the server can't see) gets a say.
 */
export function useDraftPersistence({
  state,
  dispatch,
  catalog,
  prefill,
  paused,
}: {
  state: BuilderState
  dispatch: Dispatch<BuilderAction>
  catalog: BuilderCatalog
  prefill: Record<string, string | string[] | undefined>
  /** Stop autosaving once the request has been submitted (success screen is showing). */
  paused: boolean
}) {
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const draft = loadDraft(window.localStorage)
    dispatch({ type: 'hydrate', draft: applyPrefill(draft ?? initialBuilderState(), prefill, catalog) })
    // Intentionally runs once: prefill/catalog are the server's first payload,
    // and re-hydrating on every catalog re-render would stomp on live edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated.current || paused) return
    const timer = window.setTimeout(() => saveDraft(window.localStorage, state), SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state, paused])

  return {
    clear: () => clearDraft(window.localStorage),
  }
}
