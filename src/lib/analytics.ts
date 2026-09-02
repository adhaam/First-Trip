// ─── Marketing tag IDs ───
// Supplied by the marketing team. They default to the live WEEMAP SINAI
// containers so the tags work without extra configuration, but each can be
// overridden per-environment (e.g. a staging GTM container) through env vars.
// Setting the var to an empty string disables that tag entirely.
export const GTM_ID =
  process.env.NEXT_PUBLIC_GTM_ID ?? 'GTM-K7BXCRC2'

export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? '1765899771082599'

type Fbq = {
  (...args: unknown[]): void
  queue?: unknown[]
  loaded?: boolean
  version?: string
  callMethod?: (...args: unknown[]) => void
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
    dataLayer?: unknown[]
  }
}

/**
 * Fire a Meta Pixel event (`Purchase`, `Lead`, `AddToCart`, …) from anywhere in
 * the app. No-ops safely when the pixel is disabled or has not loaded yet.
 */
export function trackPixel(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return
  window.fbq('track', event, params)
}

/**
 * Push an event onto the GTM dataLayer. No-ops safely before GTM loads.
 */
export function pushDataLayer(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(payload)
}
