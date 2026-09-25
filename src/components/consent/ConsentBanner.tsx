'use client'

import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { setTrackingConsent, useTrackingConsent } from '@/lib/conversion'

/**
 * The consent boundary for non-essential tracking (Google Tag Manager, Meta
 * Pixel). Shown only while the visitor has not yet decided — `useTrackingConsent`
 * reports 'unset' — and never on an Operations Center route.
 *
 * Fixed at the bottom, non-blocking (no overlay), and reacts immediately:
 * clicking Accept/Decline calls `setTrackingConsent`, which flips
 * `useTrackingConsent()` to 'granted'/'denied' without a reload, so this
 * banner and AnalyticsScripts both update in the same tick.
 */
export function ConsentBanner() {
  const t = useTranslations('consent')
  const pathname = usePathname()
  const consent = useTrackingConsent()

  const isAdminRoute = /^\/(?:(?:ar|en)\/)?admin(?:\/|$)/.test(pathname)

  if (isAdminRoute || consent !== 'unset') return null

  return (
    <div
      role="region"
      aria-label={t('ariaLabel')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sand-200 bg-white/95 px-4 py-4 shadow-[0_-6px_24px_-6px_rgba(0,0,0,0.15)] backdrop-blur supports-[backdrop-filter]:bg-white/90"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink-700">
          {t('message')}{' '}
          <Link
            href="/policy#cookies"
            className="font-semibold text-sea-700 underline underline-offset-2 hover:text-sun-700"
          >
            {t('policyLink')}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setTrackingConsent(false)}
            className="min-h-11 rounded-full border border-sand-300 px-5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea-900"
          >
            {t('decline')}
          </button>
          <button
            type="button"
            onClick={() => setTrackingConsent(true)}
            className="min-h-11 rounded-full bg-sea-900 px-5 py-2 text-sm font-semibold text-sand-50 transition-colors hover:bg-sea-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
