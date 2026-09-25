import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { TripBuilder } from '@/components/trip-builder/TripBuilder'
import { pageMetadata } from '@/lib/seo'
import { getTripBuilderCatalog } from '@/lib/trip-builder/catalog.server'

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const [{ locale }, prefill] = await Promise.all([params, searchParams])
  const t = await getTranslations({ locale, namespace: 'builder' })
  // The bare /plan URL is the real, indexable "Build Your Trip" landing
  // page (see sitemap.ts). A ?stay=/?trip=/?package= prefilled URL renders
  // the same builder pre-populated for one visitor's click-through — not a
  // distinct piece of content worth indexing — so only that variant is
  // marked noindex,follow.
  const hasPrefill = Object.keys(prefill).length > 0
  return pageMetadata({
    locale,
    path: '/plan',
    title: t('metaTitle'),
    description: t('metaDescription'),
    ...(hasPrefill ? { robots: { index: false, follow: true } } : {}),
  })
}

export default async function PlanPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, prefill, catalog] = await Promise.all([params, searchParams, getTripBuilderCatalog()])
  return <TripBuilder catalog={catalog} locale={locale === 'ar' ? 'ar' : 'en'} prefill={prefill}/>
}
