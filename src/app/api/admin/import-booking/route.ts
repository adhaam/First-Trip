import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as cheerio from 'cheerio'
import { requireAdmin } from '@/lib/admin-auth'

// ─── Import a property from a Booking.com listing URL ───
//
// Best-effort scrape: Booking.com pages are JS-heavy and sometimes sit
// behind bot-detection, so this reads whatever server-rendered HTML and
// JSON-LD it gets back. It never promises a perfect import — the admin UI
// tells the user to review everything, and Arabic fields are deliberately
// left for a human to write (we don't machine-translate).

const bodySchema = z.object({
  url: z.string().url(),
})

interface HotelJsonLd {
  name?: string
  description?: string
  image?: string | string[]
  aggregateRating?: { ratingValue?: string | number }
  geo?: { latitude?: string | number; longitude?: string | number }
  amenityFeature?: { name?: string }[]
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let host = ''
  try {
    host = new URL(parsed.data.url).hostname
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (!host.includes('booking.com')) {
    return NextResponse.json({ error: 'Only booking.com links are supported' }, { status: 400 })
  }

  let html = ''
  try {
    const res = await fetch(parsed.data.url, {
      headers: {
        // A normal browser UA — booking.com serves a stripped-down page (or
        // blocks entirely) to obvious bot user-agents.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Booking.com returned ${res.status}. The listing may be blocking automated access — fill the fields manually.` }, { status: 502 })
    }
    html = await res.text()
  } catch (err) {
    console.error('import-booking fetch error:', err)
    return NextResponse.json({ error: 'Could not reach that URL. Fill the fields manually.' }, { status: 502 })
  }

  try {
    const $ = cheerio.load(html)

    // JSON-LD is the most reliable structured source when present.
    // (Typed loosely on purpose — this is a best-effort scrape of a third
    // party's markup, which varies and isn't worth fighting the type system over.)
    function findHotelLd(): HotelJsonLd | null {
      let found: HotelJsonLd | null = null
      $('script[type="application/ld+json"]').each((_, el) => {
        if (found) return
        try {
          const parsed: unknown = JSON.parse($(el).contents().text())
          const candidates = (Array.isArray(parsed) ? parsed : [parsed]) as Array<Record<string, unknown>>
          const hotel = candidates.find(
            (c) => c && (c['@type'] === 'Hotel' || c['@type'] === 'LodgingBusiness' || c['@type'] === 'Resort'),
          )
          if (hotel) found = hotel as HotelJsonLd
        } catch {
          // ignore malformed blocks
        }
      })
      return found
    }
    const ld = findHotelLd()

    const name_en =
      ld?.name || $('meta[property="og:title"]').attr('content')?.replace(/\s*\|\s*Booking\.com.*$/i, '') || ''

    const description_en =
      ld?.description || $('meta[property="og:description"]').attr('content') || ''

    // Rating: JSON-LD first, else regex fallback on inline page data.
    let rating: number | undefined
    if (ld?.aggregateRating?.ratingValue) {
      const n = parseFloat(String(ld.aggregateRating.ratingValue))
      // Booking.com ratings are out of 10 — normalize to a 5-star scale.
      if (Number.isFinite(n)) rating = Math.round((n / 2) * 10) / 10
    }
    if (rating === undefined) {
      const m = html.match(/"reviewScore":\s*([\d.]+)/)
      if (m) rating = Math.round((parseFloat(m[1]) / 2) * 10) / 10
    }

    // Coordinates: JSON-LD geo, else the data-atlas-latlng attribute Booking.com
    // puts on its map link.
    let latitude: number | undefined
    let longitude: number | undefined
    if (ld?.geo?.latitude && ld?.geo?.longitude) {
      latitude = parseFloat(String(ld.geo.latitude))
      longitude = parseFloat(String(ld.geo.longitude))
    } else {
      const m = html.match(/data-atlas-latlng="(-?\d+\.\d+),(-?\d+\.\d+)"/)
      if (m) {
        latitude = parseFloat(m[1])
        longitude = parseFloat(m[2])
      }
    }

    // Images: collect unique hotel photo URLs, upgraded to a larger size
    // where Booking.com's thumbnail size suffix is present.
    const imageSet = new Set<string>()
    if (ld?.image) {
      const arr = Array.isArray(ld.image) ? ld.image : [ld.image]
      arr.forEach((u: string) => imageSet.add(u))
    }
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (src && /bstatic\.com\/xdata\/images\/hotel/.test(src)) {
        imageSet.add(src.replace(/square\d+|max\d+x\d+/i, 'max1024x768'))
      }
    })
    const images = Array.from(imageSet).slice(0, 12)

    // Amenities: Booking.com's "most popular facilities" list.
    const amenities_en: string[] = []
    $('[data-testid="property-most-popular-facilities-wrapper"] li, [data-testid*="facility"] span').each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.length < 60 && !amenities_en.includes(text)) amenities_en.push(text)
    })

    if (!name_en && images.length === 0 && amenities_en.length === 0) {
      return NextResponse.json(
        { error: 'Could not read this listing — Booking.com may be blocking automated access. Fill the fields manually.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      name_en,
      description_en,
      rating,
      latitude,
      longitude,
      images,
      amenities_en: amenities_en.slice(0, 20),
    })
  } catch (err) {
    console.error('import-booking parse error:', err)
    return NextResponse.json({ error: 'Failed to parse that page. Fill the fields manually.' }, { status: 500 })
  }
}
