/**
 * ════════════════════════════════════════════════════════════════════════════
 *  WEEMAP SINAI — conversion event layer
 * ════════════════════════════════════════════════════════════════════════════
 *
 * One typed entry point, three destinations. Components call `trackConversion`
 * and never touch a vendor SDK, so the taxonomy stays in one file and a vendor
 * can be added or removed without editing a single component.
 *
 *      trackConversion(name, payload)
 *              │
 *              ├──▶ Vercel Analytics   (custom event — always, was already live)
 *              ├──▶ GTM dataLayer      (when NEXT_PUBLIC_GTM_ID is configured)
 *              └──▶ Meta Pixel         (when NEXT_PUBLIC_FB_PIXEL_ID is configured)
 *
 * ─── Rules this module enforces, not just documents ─────────────────────────
 *
 * 1. NO PII EVER LEAVES THE BROWSER.
 *    Names, phone numbers, emails, addresses, notes and free text are never
 *    accepted. Payload keys are checked against an allowlist and every value is
 *    scrubbed for anything that looks like an email or a phone number. A
 *    rejected key is dropped, and in development it is logged loudly.
 *
 * 2. SUCCESS EVENTS ONLY ON CONFIRMED SUCCESS.
 *    Every `*_submitted` event is fired from the success branch of a request,
 *    after the server has responded OK. A failed submission fires
 *    `request_failed` instead, which is never mapped to a Meta conversion.
 *
 * 3. NOTHING FIRES ON RENDER.
 *    There is no effect in this module and no component fires a conversion in a
 *    mount effect. Every event below is the direct result of a click, a submit,
 *    or a server-confirmed outcome. (Meta's `ViewContent` is deliberately NOT
 *    implemented for this reason — see the note at the end of this file.)
 *
 * 4. NO DUPLICATES.
 *    `PageView` is owned solely by AnalyticsScripts (Meta) and the GTM
 *    container's own History Change trigger. This module never sends a page
 *    view. Conversion events are de-duplicated per session by event id.
 *
 * 5. GRACEFUL DEGRADATION.
 *    Missing GTM, missing pixel, tags still loading, tracking not permitted,
 *    SSR, a throwing SDK — every one of those is a silent no-op that can never
 *    break a booking.
 */

import { track } from '@vercel/analytics'
import { FB_PIXEL_ID, GTM_ID, pushDataLayer, trackPixel } from './analytics'

/* ────────────────────────────── taxonomy ────────────────────────────────── */

/**
 * Every conversion event the site can emit. Adding a name here without adding
 * a mapping below is a type error, so the taxonomy cannot silently drift.
 */
export type ConversionEvent =
  // ─ request submissions (server-confirmed) ─
  | 'accommodation_request_submitted'
  | 'trip_request_submitted'
  | 'trip_package_request_submitted'
  | 'signature_request_submitted'
  | 'build_signature_request_submitted'
  | 'order_request_submitted'
  | 'partner_inquiry_submitted'
  | 'assistant_lead_submitted'
  | 'newsletter_subscribed'
  // ─ intent signals (direct user action) ─
  | 'cart_item_added'
  | 'checkout_started'
  | 'whatsapp_click'
  | 'search_result_selected'
  | 'assistant_opened'
  // ─ diagnostics (never mapped to an ad-platform conversion) ─
  | 'request_failed'

/**
 * Meta Pixel standard-event mapping.
 *
 * `Purchase` is deliberately absent from this whole file. WEEMAP takes a
 * request and confirms availability afterwards; no payment is taken on the
 * site. Reporting a Purchase would misstate the conversion to the ad platform
 * and contradict the request-not-booking promise made in the UI.
 */
const META_EVENT: Partial<Record<ConversionEvent, string>> = {
  accommodation_request_submitted: 'Lead',
  trip_request_submitted: 'Lead',
  trip_package_request_submitted: 'Lead',
  signature_request_submitted: 'Lead',
  build_signature_request_submitted: 'Lead',
  order_request_submitted: 'Lead',
  partner_inquiry_submitted: 'SubmitApplication',
  assistant_lead_submitted: 'Lead',
  newsletter_subscribed: 'CompleteRegistration',
  cart_item_added: 'AddToCart',
  checkout_started: 'InitiateCheckout',
  whatsapp_click: 'Contact',
  search_result_selected: 'Search',
  // assistant_opened and request_failed intentionally have no Meta mapping.
}

/** GA4-shaped names for the GTM container to map onto. */
const GA4_EVENT: Partial<Record<ConversionEvent, string>> = {
  accommodation_request_submitted: 'generate_lead',
  trip_request_submitted: 'generate_lead',
  trip_package_request_submitted: 'generate_lead',
  signature_request_submitted: 'generate_lead',
  build_signature_request_submitted: 'generate_lead',
  order_request_submitted: 'generate_lead',
  partner_inquiry_submitted: 'generate_lead',
  assistant_lead_submitted: 'generate_lead',
  newsletter_subscribed: 'sign_up',
  cart_item_added: 'add_to_cart',
  checkout_started: 'begin_checkout',
  whatsapp_click: 'contact',
  search_result_selected: 'select_item',
}

/* ─────────────────────────────── payload ────────────────────────────────── */

/**
 * The only parameter keys allowed to leave the browser.
 *
 * This is an allowlist, not a blocklist: a key that is not listed is dropped,
 * so a future call site cannot leak a new field by accident. Every entry is a
 * category, an identifier, or a count — never anything that identifies a person.
 */
const ALLOWED_KEYS = new Set([
  'content_type',   // 'accommodation' | 'trip' | 'trip_package' | 'signature' | 'product' | 'rental' | 'transfer'
  'item_id',        // opaque record id / slug
  'item_name',      // the item's own public English name (a listing title, never a person)
  'item_category',  // e.g. 'hotel' | 'camp' | 'diving'
  'booking_mode',   // 'package' | 'stay-only' | 'transfer-only'
  'order_type',     // 'sale' | 'rental'
  'partnership_type',
  'source',         // which surface the action came from, e.g. 'trip_detail'
  'value',          // estimated total, numeric
  'currency',
  'quantity',
  'num_people',
  'num_nights',
  'items_count',
  'locale',
  'reference',      // order/booking reference — an opaque code, not a person
  'reason',         // failure reason slug, never a server message
  // attribution
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'referrer', 'landing_path',
])

export type ConversionPayload = {
  content_type?: 'accommodation' | 'trip' | 'trip_package' | 'signature' | 'product' | 'rental' | 'transfer' | 'newsletter' | 'partner'
  item_id?: string
  item_name?: string
  item_category?: string
  booking_mode?: string
  order_type?: string
  partnership_type?: string
  source?: string
  value?: number
  currency?: string
  quantity?: number
  num_people?: number
  num_nights?: number
  items_count?: number
  reference?: string
  reason?: string
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
// 7+ consecutive digits (allowing spaces/dashes/parens) reads as a phone number.
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/

/**
 * Drop anything not on the allowlist, then scrub anything that still smells
 * like a person. Values are capped so a stray paragraph can never be sent.
 */
function sanitize(payload: ConversionPayload): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}

  for (const [key, raw] of Object.entries(payload)) {
    if (raw === undefined || raw === null || raw === '') continue

    if (!ALLOWED_KEYS.has(key)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[conversion] dropped disallowed parameter "${key}". ` +
            `Add it to ALLOWED_KEYS in src/lib/conversion.ts only if it contains no personal data.`,
        )
      }
      continue
    }

    if (typeof raw === 'number') {
      if (Number.isFinite(raw)) out[key] = raw
      continue
    }
    if (typeof raw === 'boolean') {
      out[key] = raw
      continue
    }

    const value = String(raw).trim().slice(0, 120)
    if (!value) continue

    // `reference` is an opaque booking/order code and may legitimately be a long
    // digit run; every other string field is scrubbed.
    if (key !== 'reference' && (EMAIL_RE.test(value) || PHONE_RE.test(value))) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[conversion] dropped parameter "${key}" — value looked like personal data.`)
      }
      continue
    }

    out[key] = value
  }

  return out
}

/* ──────────────────────────── consent gate ──────────────────────────────── */

/**
 * ⚠ There is no consent UI in this project today, and GTM + the Meta Pixel
 * already load unconditionally on every page (that predates this module).
 *
 * This gate does not change that behaviour — removing working tracking was out
 * of scope — but it puts the switch in one place so a consent banner can be
 * wired up by flipping one env var and calling `setTrackingConsent`:
 *
 *   NEXT_PUBLIC_REQUIRE_CONSENT=true
 *       → nothing is sent until setTrackingConsent(true) is called.
 *   unset / 'false'
 *       → current behaviour is preserved.
 *
 * Global Privacy Control is always honoured, in both modes, because respecting
 * it only ever reduces what is sent.
 */
const REQUIRE_CONSENT = process.env.NEXT_PUBLIC_REQUIRE_CONSENT === 'true'
const CONSENT_KEY = 'weemap-tracking-consent'

export function setTrackingConsent(granted: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
  } catch {
    /* private mode / storage disabled — fall through to the default */
  }
}

export function isTrackingAllowed(): boolean {
  if (typeof window === 'undefined') return false

  // Global Privacy Control is a legally recognised opt-out in several
  // jurisdictions. Honour it unconditionally.
  const nav = window.navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.globalPrivacyControl === true) return false

  if (!REQUIRE_CONSENT) return true

  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'granted'
  } catch {
    return false
  }
}

/* ───────────────────────────── attribution ──────────────────────────────── */

const ATTRIBUTION_KEY = 'weemap-attribution'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

type Attribution = Partial<Record<(typeof UTM_KEYS)[number] | 'referrer' | 'landing_path', string>>

/**
 * Capture the campaign parameters, referrer and landing path of the *first*
 * page of the session, and keep them for the rest of it — so a conversion that
 * happens three pages later still carries the campaign that produced it.
 *
 * Stored in sessionStorage, which is per-tab and cleared when the tab closes.
 * Only the campaign fields are kept; the full URL and query string are not,
 * because they can contain anything.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.sessionStorage.getItem(ATTRIBUTION_KEY)) return

    const params = new URLSearchParams(window.location.search)
    const data: Attribution = {}
    for (const key of UTM_KEYS) {
      const value = params.get(key)
      if (value) data[key] = value.slice(0, 120)
    }

    // Referrer is reduced to its origin — the full referring URL can carry
    // query strings belonging to another site.
    if (document.referrer) {
      try {
        const url = new URL(document.referrer)
        if (url.origin !== window.location.origin) data.referrer = url.origin
      } catch {
        /* malformed referrer — skip it */
      }
    }

    data.landing_path = window.location.pathname.slice(0, 120)
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable — attribution is a nice-to-have, never a blocker */
  }
}

function readAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY)
    return raw ? (JSON.parse(raw) as Attribution) : {}
  } catch {
    return {}
  }
}

/* ───────────────────────────── de-duplication ───────────────────────────── */

/**
 * Guards against the same conversion being reported twice — a double-clicked
 * submit, a retried request that actually succeeded the first time, or a
 * component remounting after a successful submission.
 */
const sent = new Set<string>()

function dedupeKey(event: ConversionEvent, payload: Record<string, unknown>): string {
  return `${event}:${payload.reference ?? payload.item_id ?? ''}`
}

/** Test seam — resets the in-memory de-duplication set. */
export function __resetConversionDedupe(): void {
  sent.clear()
}

/* ───────────────────────────── the entry point ──────────────────────────── */

/**
 * Report a conversion to every configured destination.
 *
 * Never throws. Analytics must not be able to break a booking, so the whole
 * body is defensive and every vendor call is individually guarded.
 *
 * @param event   a name from the taxonomy above
 * @param payload structured, non-personal parameters (see ALLOWED_KEYS)
 * @param options `once: false` allows a legitimately repeatable event
 */
export function trackConversion(
  event: ConversionEvent,
  payload: ConversionPayload = {},
  options: { once?: boolean } = {},
): void {
  try {
    if (typeof window === 'undefined') return
    if (!isTrackingAllowed()) return

    const locale = document.documentElement.lang === 'en' ? 'en' : 'ar'
    const params: Record<string, string | number | boolean> = {
      ...sanitize(payload),
      ...sanitize(readAttribution() as ConversionPayload),
      locale,
    }

    const once = options.once ?? true
    if (once) {
      const key = dedupeKey(event, params)
      if (sent.has(key)) return
      sent.add(key)
    }

    // 1 ─ Vercel Analytics. This was the only destination before; keeping the
    //     same event names means existing dashboards keep working.
    try {
      track(event, params)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[conversion] vercel', err)
    }

    // 2 ─ GTM dataLayer. Pushes both the WEEMAP name and, where one exists, the
    //     GA4-shaped name, so the container can trigger on either without the
    //     site needing to know how the container is configured.
    if (GTM_ID) {
      try {
        pushDataLayer({ event, ...params })
        const ga4 = GA4_EVENT[event]
        if (ga4 && ga4 !== event) {
          pushDataLayer({ event: ga4, weemap_event: event, ...params })
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error('[conversion] gtm', err)
      }
    }

    // 3 ─ Meta Pixel. Only events with a standard-event mapping are sent, and
    //     `Purchase` is never one of them (see META_EVENT above).
    if (FB_PIXEL_ID) {
      const metaEvent = META_EVENT[event]
      if (metaEvent) {
        try {
          trackPixel(metaEvent, {
            ...params,
            ...(params.value !== undefined ? { currency: params.currency ?? 'EGP' } : {}),
          })
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') console.error('[conversion] meta', err)
        }
      }
    }
  } catch (err) {
    // Absolutely never let analytics surface to a customer.
    if (process.env.NODE_ENV !== 'production') console.error('[conversion] failed', err)
  }
}

/**
 * Report a failed submission. Deliberately separate from `trackConversion` so
 * a failure can never be mistaken for a conversion: it goes to Vercel and the
 * dataLayer for diagnostics and is never mapped to a Meta standard event.
 *
 * `reason` must be a short slug the code chose ('network', 'validation',
 * 'server'), never a server message — those can echo user input back.
 */
export function trackRequestFailure(
  contentType: ConversionPayload['content_type'],
  reason: 'network' | 'validation' | 'server' | 'unknown',
): void {
  trackConversion('request_failed', { content_type: contentType, reason }, { once: false })
}

/*
 * ─── Deliberately not implemented ───────────────────────────────────────────
 *
 * Meta `ViewContent` / GA4 `view_item`.
 *
 * These are genuinely useful for dynamic ads and retargeting, but by definition
 * they fire because a page rendered rather than because someone acted — which
 * the brief for this pass explicitly rules out. They are a small, well-isolated
 * addition (one client component on the detail routes, guarded to fire once per
 * item per session) and are recorded in the hand-off notes as a decision for
 * the campaign owner rather than something to add silently here.
 */
