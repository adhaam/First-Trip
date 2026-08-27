import { track } from '@vercel/analytics'

/**
 * Thin wrapper around @vercel/analytics's `track()` — the one place to swap
 * providers later (e.g. PostHog) without touching every call site.
 *
 * Safe to call from any client component. No-ops silently if analytics
 * isn't available (e.g. during SSR or before the script loads).
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  try {
    track(name, props)
  } catch (err) {
    // Never let analytics break a real user flow.
    console.error('trackEvent error:', err)
  }
}
