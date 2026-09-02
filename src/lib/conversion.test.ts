import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
// Static import: the globals above are assigned in this module's body, which
// runs before node:test executes any test callback, and conversion.ts only
// touches `window` from inside its functions.
import {
  captureAttribution,
  trackConversion,
  trackRequestFailure,
  __resetConversionDedupe,
} from './conversion'

/**
 * The conversion layer runs in the browser, so these tests stand up the minimum
 * DOM surface it touches — window, document, navigator, storage — before the
 * module is imported. `@vercel/analytics`'s `track` is a no-op outside a real
 * page, so the assertions here target the two destinations we control: the GTM
 * dataLayer and the Meta Pixel.
 */

type Captured = { fbq: unknown[][]; dataLayer: Record<string, unknown>[] }

const captured: Captured = { fbq: [], dataLayer: [] }

function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

const sessionStorage = makeStorage()
const localStorage = makeStorage()

const g = globalThis as unknown as Record<string, unknown>

g.window = {
  fbq: (...args: unknown[]) => captured.fbq.push(args),
  dataLayer: [] as unknown[],
  location: { search: '?utm_source=meta&utm_campaign=sinai_spring', pathname: '/book-dahab', origin: 'https://weemapsinai.com' },
  navigator: { globalPrivacyControl: false },
  sessionStorage,
  localStorage,
}
g.document = {
  documentElement: { lang: 'ar' },
  referrer: 'https://l.facebook.com/some/path?fbclid=abc',
}
// Note: only `window.navigator` is read by the module — globalThis.navigator
// is getter-only in Node and must not be reassigned.

// dataLayer.push is what the module actually calls.
;(g.window as Record<string, unknown>).dataLayer = {
  push: (payload: Record<string, unknown>) => captured.dataLayer.push(payload),
  length: 0,
} as unknown as unknown[]


beforeEach(() => {
  captured.fbq.length = 0
  captured.dataLayer.length = 0
  __resetConversionDedupe()
})

const metaEvents = () => captured.fbq.filter((a) => a[0] === 'track').map((a) => a[1])
const metaParams = () =>
  captured.fbq.filter((a) => a[0] === 'track').map((a) => a[2] as Record<string, unknown>)
const dlEvents = () => captured.dataLayer.map((p) => p.event)

// ─── PII: the hard guarantee ────────────────────────────────────────────────

test('a name, phone, email or free-text note can never reach a vendor', () => {
  trackConversion('accommodation_request_submitted', {
    item_id: 'acc-1',
    // @ts-expect-error — deliberately passing fields the type forbids, because
    // a future call site could do exactly this by mistake.
    full_name: 'Adham Abdallah',
    phone: '+201005744083',
    email: 'someone@example.com',
    notes: 'Please call me on 01005744083 before 6pm',
  })

  const sent = JSON.stringify(captured.dataLayer) + JSON.stringify(captured.fbq)
  assert.doesNotMatch(sent, /Adham/)
  assert.doesNotMatch(sent, /201005744083/)
  assert.doesNotMatch(sent, /someone@example\.com/)
  assert.doesNotMatch(sent, /Please call me/)
  // The allowed field still made it through.
  assert.match(sent, /acc-1/)
})

test('an allowlisted field whose value looks like a person is dropped too', () => {
  trackConversion('trip_request_submitted', {
    content_type: 'trip',
    item_name: 'contact me at buyer@example.com',
    item_id: 'trip-9',
  })
  const sent = JSON.stringify(captured.dataLayer)
  assert.doesNotMatch(sent, /buyer@example\.com/)
  assert.match(sent, /trip-9/)
})

test('a booking reference is allowed to be a long digit run', () => {
  trackConversion('order_request_submitted', { reference: 'WM-2026-0001234567', order_type: 'merch' })
  assert.match(JSON.stringify(captured.dataLayer), /WM-2026-0001234567/)
})

// ─── success vs failure ─────────────────────────────────────────────────────

test('a failed request is never reported as a conversion to Meta', () => {
  trackRequestFailure('accommodation', 'server')
  assert.deepEqual(metaEvents(), [], 'request_failed must have no Meta mapping')
  assert.ok(dlEvents().includes('request_failed'), 'but it is still visible for diagnostics')
})

test('the failure reason is a slug we chose, never a server message', () => {
  trackRequestFailure('trip', 'network')
  const payload = captured.dataLayer.find((p) => p.event === 'request_failed')
  assert.equal(payload?.reason, 'network')
})

// ─── Purchase is never sent ─────────────────────────────────────────────────

test('no event maps to a Meta Purchase — nothing is ever paid for on this site', () => {
  const everyEvent = [
    'accommodation_request_submitted', 'trip_request_submitted', 'trip_package_request_submitted',
    'signature_request_submitted', 'build_signature_request_submitted', 'order_request_submitted',
    'partner_inquiry_submitted', 'assistant_lead_submitted', 'newsletter_subscribed',
    'cart_item_added', 'checkout_started', 'whatsapp_click', 'search_result_selected',
    'assistant_opened', 'request_failed',
  ] as const

  for (const name of everyEvent) {
    __resetConversionDedupe()
    trackConversion(name, { item_id: `x-${name}` }, { once: false })
  }
  assert.ok(!metaEvents().includes('Purchase'), 'Purchase would misstate a request as a sale')
})

test('request submissions map to Lead, not to a commerce conversion', () => {
  trackConversion('accommodation_request_submitted', { item_id: 'a' })
  trackConversion('trip_request_submitted', { item_id: 'b' })
  assert.deepEqual(metaEvents(), ['Lead', 'Lead'])
})

// ─── de-duplication ─────────────────────────────────────────────────────────

test('a double-submitted conversion is only reported once', () => {
  trackConversion('order_request_submitted', { reference: 'WM-1' })
  trackConversion('order_request_submitted', { reference: 'WM-1' })
  trackConversion('order_request_submitted', { reference: 'WM-1' })
  assert.equal(metaEvents().length, 1)
})

test('two genuinely different orders are both reported', () => {
  trackConversion('order_request_submitted', { reference: 'WM-1' })
  trackConversion('order_request_submitted', { reference: 'WM-2' })
  assert.equal(metaEvents().length, 2)
})

test('repeatable intent signals opt out of de-duplication', () => {
  trackConversion('whatsapp_click', { source: 'floating_button' }, { once: false })
  trackConversion('whatsapp_click', { source: 'floating_button' }, { once: false })
  assert.equal(metaEvents().length, 2)
})

// ─── no PageView ────────────────────────────────────────────────────────────

test('this module never sends a page view — that belongs to AnalyticsScripts', () => {
  trackConversion('checkout_started', { items_count: 2 })
  assert.ok(!metaEvents().includes('PageView'))
  assert.ok(!dlEvents().includes('PageView'))
})

// ─── attribution ────────────────────────────────────────────────────────────

test('campaign attribution rides along with every conversion', () => {
  sessionStorage.clear()
  captureAttribution()
  trackConversion('trip_request_submitted', { item_id: 'trip-1' })
  const payload = captured.dataLayer.find((p) => p.event === 'trip_request_submitted')
  assert.equal(payload?.utm_source, 'meta')
  assert.equal(payload?.utm_campaign, 'sinai_spring')
  assert.equal(payload?.landing_path, '/book-dahab')
})

test('the referrer is reduced to an origin — another site\'s query string is not ours to keep', () => {
  sessionStorage.clear()
  captureAttribution()
  const stored = sessionStorage.getItem('weemap-attribution')!
  assert.match(stored, /https:\/\/l\.facebook\.com/)
  assert.doesNotMatch(stored, /fbclid/)
})

test('the locale is attached so campaigns can be split by language', () => {
  trackConversion('newsletter_subscribed', {})
  const payload = captured.dataLayer.find((p) => p.event === 'newsletter_subscribed')
  assert.equal(payload?.locale, 'ar')
})

// ─── GA4 shape ──────────────────────────────────────────────────────────────

test('a GA4-shaped alias is pushed alongside the WEEMAP name', () => {
  trackConversion('cart_item_added', { item_id: 'p-1', quantity: 1 })
  assert.ok(dlEvents().includes('cart_item_added'))
  assert.ok(dlEvents().includes('add_to_cart'))
})

// ─── resilience ─────────────────────────────────────────────────────────────

test('a throwing vendor SDK can never break a booking', () => {
  const original = (g.window as Record<string, unknown>).fbq
  ;(g.window as Record<string, unknown>).fbq = () => {
    throw new Error('pixel blocked by an extension')
  }
  assert.doesNotThrow(() => trackConversion('trip_request_submitted', { item_id: 'trip-2' }))
  ;(g.window as Record<string, unknown>).fbq = original
})

test('currency defaults to EGP whenever a value is reported', () => {
  trackConversion('checkout_started', { value: 4500, items_count: 1 })
  const params = metaParams()[0]
  assert.equal(params.currency, 'EGP')
  assert.equal(params.value, 4500)
})

// ─── Global Privacy Control ─────────────────────────────────────────────────

test('Global Privacy Control suppresses everything', () => {
  const nav = (g.window as Record<string, unknown>).navigator as Record<string, unknown>
  nav.globalPrivacyControl = true
  trackConversion('trip_request_submitted', { item_id: 'trip-gpc' })
  assert.equal(captured.dataLayer.length, 0)
  assert.equal(captured.fbq.length, 0)
  nav.globalPrivacyControl = false
})
