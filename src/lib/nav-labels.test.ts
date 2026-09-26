// ─── No public nav label says "Signature" ───
// Run with:  npx tsx --test src/lib/nav-labels.test.ts
//
// WEEMAP Editions replaced the public Signature entry point (header,
// footer, homepage gateway tiles). This checks the actual rendered label
// strings — not just hrefs/keys — so a future edit that reintroduces the
// word in the label text (rather than the route) is caught too.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NAV_ITEMS, NAV_LABEL_KEYS } from './constants'

function readJson(...segments: string[]) {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'src', 'messages', ...segments), 'utf8'))
}

const SIGNATURE_WORDS = [/signature/i, /سيجنتشر/, /سيغنتشر/]

function containsSignatureWording(value: string): boolean {
  return SIGNATURE_WORDS.some((re) => re.test(value))
}

test('header/footer NAV_ITEMS hrefs no longer point at /signature', () => {
  const hrefs = NAV_ITEMS.map((item) => item.href)
  assert.ok(!hrefs.includes('/signature'), `NAV_ITEMS still has a /signature entry: ${hrefs.join(', ')}`)
})

test('every resolved header/footer nav label (en + ar) is Signature-free', () => {
  const ia = { en: readJson('en', 'ia.json'), ar: readJson('ar', 'ia.json') }
  for (const item of NAV_ITEMS) {
    const key = NAV_LABEL_KEYS[item.href]
    if (!key) continue
    for (const locale of ['en', 'ar'] as const) {
      const label = ia[locale][key]
      assert.equal(typeof label, 'string', `${item.href} -> ia.${locale}.${key} is missing`)
      assert.ok(!containsSignatureWording(label), `${locale} label for ${item.href} says "${label}"`)
    }
  }
})

test('homepage IntentGateway tiles (homeV2.gateway) are Signature-free', () => {
  for (const locale of ['en', 'ar'] as const) {
    const gateway = readJson(locale, 'homeV2.json').gateway
    for (const [key, value] of Object.entries(gateway)) {
      if (typeof value !== 'object' || value === null) continue
      const { title, body } = value as { title?: string; body?: string }
      assert.ok(!containsSignatureWording(String(title)), `${locale} homeV2.gateway.${key}.title says "${title}"`)
      assert.ok(!containsSignatureWording(String(body)), `${locale} homeV2.gateway.${key}.body says "${body}"`)
    }
  }
})

test('the homepage Editions teaser copy (editions.homeTeaser) is Signature-free', () => {
  for (const locale of ['en', 'ar'] as const) {
    const teaser = readJson(locale, 'editions.json').homeTeaser
    for (const value of Object.values(teaser)) {
      assert.ok(!containsSignatureWording(String(value)), `${locale} editions.homeTeaser says "${value}"`)
    }
  }
})
