import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSinaiTrips } from '@/lib/data'
import { getSitePage } from '@/lib/site-pages'
import { pickCopy } from '@/lib/site-pages-core'
import { categoryFromSearchParam } from '@/lib/explore'
import { SinaiTripsClient } from '@/components/SinaiTripsClient'
import { Eyebrow, PageHero, Section } from '@/components/brand'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getCollectionPageSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'
import { getPathname } from '@/i18n/navigation'
import { getTripRouteSlug } from '@/lib/trips'

export const revalidate = 60

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'explore' })
  return pageMetadata({ locale, path: '/sinai-trips', title: t('trips'), description: t('tripsLede') })
}

/**
 * `/sinai-trips` — category-led exploration, not a database listing. The
 * category taxonomy and matching always come from `src/lib/trip-categories.ts`
 * (never recreated as frontend constants); `?category=` is resolved to a
 * canonical id in `src/lib/explore.ts` so a deep link from Home or Community
 * works whether it carries a category id or its friendlier slug.
 */
export default async function SinaiTripsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const [trips, search, t, tDiscovery, sitePage] = await Promise.all([
    getSinaiTrips(),
    searchParams,
    getTranslations('explore'),
    getTranslations({ locale, namespace: 'discovery' }),
    getSitePage('sinai_trips'),
  ])
  const category = categoryFromSearchParam(search.category, trips)
  const ar = locale === 'ar'
  const pageUrl = `${SITE_URL}${getPathname({ href: '/sinai-trips', locale })}`
  const heroEyebrow = pickCopy(
    locale,
    { en: sitePage?.eyebrow_en, ar: sitePage?.eyebrow_ar },
    t('tripsEyebrow'),
  )
  const heroTitle = pickCopy(locale, { en: sitePage?.title_en, ar: sitePage?.title_ar }, t('tripsTitle'))
  const heroBody = pickCopy(locale, { en: sitePage?.body_en, ar: sitePage?.body_ar }, t('tripsLede'))

  // Real category names actually carried by the loaded trips (never
  // invented) — first three, in catalogue order, deduplicated by id.
  const seenCategoryIds = new Set<string>()
  const categoryNames: string[] = []
  for (const trip of trips) {
    if (!trip.category || seenCategoryIds.has(trip.category.id)) continue
    seenCategoryIds.add(trip.category.id)
    categoryNames.push(ar ? trip.category.name_ar || trip.category.name_en : trip.category.name_en || trip.category.name_ar)
    if (categoryNames.length >= 3) break
  }
  const geoIntro = tDiscovery('geoIntro.sinaiTrips', {
    count: trips.length,
    categories: categoryNames.join(ar ? '، ' : ', '),
  })

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: t('tripsTitle'), url: pageUrl },
  ])
  const collectionSchema = getCollectionPageSchema({
    name: t('tripsTitle'),
    description: t('tripsLede'),
    url: pageUrl,
    items: trips.map((trip) => ({
      name: ar ? trip.name_ar || trip.name_en : trip.name_en || trip.name_ar,
      url: `${SITE_URL}${getPathname({ href: `/sinai-trips/${getTripRouteSlug(trip)}`, locale })}`,
    })),
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
      <PageHero
        image={sitePage?.hero_image_url || '/media/heroposter.webp'}
        eyebrow={<Eyebrow tone="light">{heroEyebrow}</Eyebrow>}
        title={heroTitle}
        lede={heroBody}
      />
      {categoryNames.length > 0 && (
        <Section tone="paper" size="sm">
          <p className="max-w-2xl text-base leading-relaxed text-ink-muted">{geoIntro}</p>
        </Section>
      )}
      <Section tone="paper">
        <SinaiTripsClient trips={trips} initialCategory={category} />
      </Section>
    </>
  )
}
