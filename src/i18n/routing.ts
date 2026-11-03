import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'as-needed',
  // Auto-detect user's preferred locale from Accept-Language header + cookie.
  // The Header component still exposes a manual language toggle that sets the
  // NEXT_LOCALE cookie, so users can override the detection at any time.
  localeDetection: true,
})

export type AppLocale = (typeof routing.locales)[number]

/** True only for a locale the site actually serves (the [locale] segment can be any string). */
export function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value)
}