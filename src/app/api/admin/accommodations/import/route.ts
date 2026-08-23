import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as cheerio from 'cheerio'
import { requireAdmin } from '@/lib/admin-auth'
import { AMENITIES_LIBRARY } from '@/lib/amenities'
import type { MealPlan, MealPlanKey } from '@/lib/types'

// Only southsinaihotels.com (and its hotel subdomains) may be fetched —
// this is a server-side fetch triggered by admin input, so an open fetch
// target would be an SSRF hole. Keep this allowlist in sync with the one
// piece of UI copy that tells admins where import links must come from.
const ALLOWED_HOST_SUFFIX = '.southsinaihotels.com'
const ALLOWED_HOST_EXACT = 'southsinaihotels.com'

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === ALLOWED_HOST_EXACT || h.endsWith(ALLOWED_HOST_SUFFIX)
}

const bodySchema = z.object({ url: z.string().url() })

// Decodes HTML entities (e.g. &#039;, &amp;) by round-tripping the string
// through cheerio's own HTML parser instead of hand-rolling an entity table.
function decodeHtml(raw: string): string {
  return cheerio.load(`<div>${raw}</div>`)('div').text().trim()
}

const MEAL_PLAN_LABELS: Record<MealPlanKey, { label_ar: string; label_en: string; needles: string[] }> = {
  all_inclusive: { label_ar: 'شامل كليًا (All Inclusive)', label_en: 'All inclusive', needles: ['all inclusive', 'all-inclusive'] },
  half_board: { label_ar: 'نص إقامة (إفطار وعشاء)', label_en: 'Half board (breakfast & dinner)', needles: ['half board', 'half-board'] },
  breakfast: { label_ar: 'إقامة وإفطار', label_en: 'Bed & breakfast', needles: ['bed & breakfast', 'bed and breakfast', 'breakfast included'] },
  room_only: { label_ar: 'إقامة فقط', label_en: 'Room only', needles: ['room only'] },
}

function extractLatLng(hasMap: string | undefined): { latitude?: number; longitude?: number } {
  if (!hasMap) return {}
  const match =
    hasMap.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/) ||
    hasMap.match(/place\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/) ||
    hasMap.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
  if (!match) return {}
  const latitude = parseFloat(match[1])
  const longitude = parseFloat(match[2])
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return {}
  return { latitude, longitude }
}

// Finds a JSON-LD node of the given @type, walking into @graph arrays where
// the site nests multiple structured-data objects under one <script> tag.
function findJsonLdOfType($: cheerio.CheerioAPI, type: string): Record<string, unknown> | null {
  const scripts = $('script[type="application/ld+json"]').toArray()
  for (const el of scripts) {
    const raw = $(el).contents().text()
    if (!raw || !raw.trim()) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed]
    for (const node of candidates) {
      if (!node || typeof node !== 'object') continue
      const obj = node as Record<string, unknown>
      if (obj['@type'] === type) return obj
      const graph = obj['@graph']
      if (Array.isArray(graph)) {
        const hit = graph.find(g => g && typeof g === 'object' && (g as Record<string, unknown>)['@type'] === type)
        if (hit) return hit as Record<string, unknown>
      }
    }
  }
  return null
}

function extractFacilities($: cheerio.CheerioAPI): string[] {
  const items = new Set<string>()

  // Full categorized facilities list (Main / Dining / Leisure / Services / Room Comforts / ...)
  $('.hotel-facilities__services-item .service__list-item').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text) items.add(text)
  })

  // Fallback / supplement: the short "Main Features" list near the top.
  $('.hotel-description__facilities .facilities__list-item').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text) items.add(text)
  })

  return Array.from(items)
}

function mapAmenities(facilities: string[]): { amenities_ar: string[]; amenities_en: string[] } {
  const amenities_ar: string[] = []
  const amenities_en: string[] = []
  const seen = new Set<string>()

  for (const facility of facilities) {
    const key = facility.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const libMatch = AMENITIES_LIBRARY.find(def => def.en.toLowerCase() === key)
    if (libMatch) {
      amenities_ar.push(libMatch.ar)
      amenities_en.push(libMatch.en)
    } else {
      // Not in our curated library — add as a custom amenity, same string on
      // both sides (identical to how the admin UI adds a manual custom entry).
      amenities_ar.push(facility)
      amenities_en.push(facility)
    }
  }

  return { amenities_ar, amenities_en }
}

function detectMealPlans(facilities: string[]): MealPlan[] {
  const haystack = facilities.join(' | ').toLowerCase()
  const plans: MealPlan[] = []
  for (const key of Object.keys(MEAL_PLAN_LABELS) as MealPlanKey[]) {
    const { label_ar, label_en, needles } = MEAL_PLAN_LABELS[key]
    if (needles.some(n => haystack.includes(n))) {
      plans.push({ key, label_ar, label_en, price_per_person_per_night: 0, is_active: true })
    }
  }
  return plans
}

function detectType(name: string): 'hotel' | 'chalet' | 'camp' {
  const n = name.toLowerCase()
  if (n.includes('chalet')) return 'chalet'
  if (n.includes('camp')) return 'camp'
  return 'hotel'
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const validated = bodySchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(validated.data.url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: 'Only http(s) URLs are supported' }, { status: 400 })
  }
  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: 'Only southsinaihotels.com links are supported' }, { status: 400 })
  }

  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WeemapSinaiImportBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    // Guard against a redirect landing us off the allowlisted host.
    const finalHost = new URL(res.url || target.toString()).hostname
    if (!isAllowedHost(finalHost)) {
      return NextResponse.json({ error: 'Only southsinaihotels.com links are supported' }, { status: 400 })
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Source page returned ${res.status}` }, { status: 502 })
    }
    html = await res.text()
  } catch {
    return NextResponse.json({ error: 'Failed to fetch the source page' }, { status: 502 })
  }

  const $ = cheerio.load(html)
  const hotel = findJsonLdOfType($, 'Hotel')

  if (!hotel) {
    return NextResponse.json(
      { error: 'Could not find hotel data on that page. Make sure the link points to a hotel page on southsinaihotels.com.' },
      { status: 422 },
    )
  }

  const nameRaw = typeof hotel.name === 'string' ? hotel.name : ''
  const name_en = nameRaw ? decodeHtml(nameRaw) : ''
  const descriptionRaw = typeof hotel.description === 'string' ? hotel.description : ''
  const description_en = descriptionRaw ? decodeHtml(descriptionRaw) : ''

  const address = (hotel.address && typeof hotel.address === 'object' ? hotel.address : {}) as Record<string, unknown>
  const addressParts = [address.streetAddress, address.addressLocality, address.addressRegion, address.addressCountry]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map(p => decodeHtml(p))
  const location_en = Array.from(new Set(addressParts)).join(', ')

  const { latitude, longitude } = extractLatLng(typeof hotel.hasMap === 'string' ? hotel.hasMap : undefined)

  let rating: number | undefined
  const starRating = hotel.starRating as { ratingValue?: string | number } | undefined
  if (starRating?.ratingValue !== undefined) {
    const parsed = parseFloat(String(starRating.ratingValue))
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) rating = parsed
  }

  const facilities = extractFacilities($)
  const { amenities_ar, amenities_en } = mapAmenities(facilities)
  const meal_plans = detectMealPlans(facilities)
  const type = name_en ? detectType(name_en) : 'hotel'

  return NextResponse.json({
    source_url: target.toString(),
    extracted: {
      name_en,
      description_en,
      location_en,
      type,
      ...(rating !== undefined ? { rating } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      amenities_ar,
      amenities_en,
      meal_plans,
    },
  })
}
