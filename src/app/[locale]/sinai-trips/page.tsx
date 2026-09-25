import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSinaiTrips } from '@/lib/data'
import { categoryFromSearchParam } from '@/lib/explore'
import { SinaiTripsClient } from '@/components/SinaiTripsClient'
import { Eyebrow, PageHero, Section } from '@/components/brand'
import { pageMetadata } from '@/lib/seo'

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
export default async function SinaiTripsPage({ searchParams }: Props) {
  const [trips, search, t] = await Promise.all([getSinaiTrips(), searchParams, getTranslations('explore')])
  const category = categoryFromSearchParam(search.category, trips)

  return (
    <>
      <PageHero
        image={trips[0]?.images?.[0]}
        eyebrow={<Eyebrow tone="light">{t('tripsEyebrow')}</Eyebrow>}
        title={t('tripsTitle')}
        lede={t('tripsLede')}
      />
      <Section tone="paper">
        <SinaiTripsClient trips={trips} initialCategory={category} />
      </Section>
    </>
  )
}
