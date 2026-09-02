'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { MapPin, ExternalLink } from 'lucide-react'

/**
 * Google Maps preview.
 *
 * Uses the keyless `output=embed` endpoint, so there's no API key to manage
 * and no billing surprise. The iframe is only mounted after the visitor asks
 * for it — an always-on Maps embed is one of the heaviest third-party things
 * you can put on a page, and most visitors never look at it.
 */
export function MapPreview({
  latitude,
  longitude,
  label,
}: {
  latitude?: number | null
  longitude?: number | null
  label?: string
}) {
  const t = useTranslations('book')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [loaded, setLoaded] = useState(false)

  if (latitude == null || longitude == null) return null

  const coords = `${latitude},${longitude}`
  const embed = `https://www.google.com/maps?q=${coords}&hl=${locale}&z=15&output=embed`
  const external = `https://www.google.com/maps/search/?api=1&query=${coords}`

  return (
    <div>
      <h3 className="font-display text-xl font-bold text-sea-900">{t('mapTitle')}</h3>

      <div className="mt-4 overflow-hidden border-[1.5px] border-sand-300 bg-sand-100 pin-card">
        <div className="relative aspect-[16/10] w-full sm:aspect-[2/1]">
          {loaded ? (
            <iframe
              title={label || 'Map'}
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => setLoaded(true)}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 topo-bg transition-colors hover:bg-sand-200"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sea-900 text-white transition-transform duration-300 group-hover:scale-110">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-sea-900">
                {ar ? 'اعرض الخريطة' : 'Show map'}
              </span>
              {label && <span className="text-xs text-ink-subtle">{label}</span>}
            </button>
          )}
        </div>
      </div>

      <a
        href={external}
        target="_blank"
        rel="noopener"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 transition-colors hover:text-sun-700"
      >
        {t('openInMaps')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
