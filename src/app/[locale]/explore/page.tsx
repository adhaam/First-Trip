import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { Compass, Map, Users } from 'lucide-react'
import { getCommunityPosts, getSinaiTrips } from '@/lib/data'
import { getTripPackages } from '@/lib/trip-packages'
import { EditorialCard, Eyebrow, PageHero, Section, SectionHeading } from '@/components/brand'
import { Link } from '@/i18n/navigation'
import { pageMetadata } from '@/lib/seo'
import { formatCount } from '@/lib/format'
import { NEUTRAL_MEDIA } from '@/lib/media'

export const revalidate = 60

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'explore' })
  return pageMetadata({ locale, path: '/explore', title: t('hubTitle'), description: t('hubLede') })
}

/**
 * The doorway into Explore: one editorial line per surface, real counts read
 * from the same server loaders every list page uses (never invented), and a
 * single strong featured card ahead of two smaller ones — BRIEF.md's
 * "hierarchy over uniformity" rather than three identical tiles.
 */
export default async function ExplorePage({ params }: Props) {
  const { locale } = await params
  const [trips, packages, posts, t] = await Promise.all([
    getSinaiTrips(),
    getTripPackages(),
    getCommunityPosts(),
    getTranslations({ locale, namespace: 'explore' }),
  ])

  const tripCount = t('tripCount', { count: trips.length, n: formatCount(trips.length, locale) })
  const packageCount = t('packageCount', { count: packages.length, n: formatCount(packages.length, locale) })
  const communityCount = t('communityCount', { count: posts.length, n: formatCount(posts.length, locale) })

  const surfaces: {
    href: '/sinai-trips' | '/sinai-trips/packages' | '/community'
    title: string
    kicker: string
    icon: ReactNode
    count: string
    image?: string
  }[] = [
    {
      href: '/sinai-trips',
      title: t('trips'),
      kicker: t('tripsLine'),
      icon: <Compass className="h-3.5 w-3.5" />,
      count: tripCount,
      image: trips[0]?.images?.[0],
    },
    {
      href: '/sinai-trips/packages',
      title: t('packages'),
      kicker: t('packagesLine'),
      icon: <Map className="h-3.5 w-3.5" />,
      count: packageCount,
      image: packages[0]?.image,
    },
    {
      href: '/community',
      title: t('community'),
      kicker: t('communityLine'),
      icon: <Users className="h-3.5 w-3.5" />,
      count: communityCount,
      image: posts[0]?.image_url ?? undefined,
    },
  ]

  const heroImage = trips[0]?.images?.[0] || packages[0]?.image || posts[0]?.image_url || undefined

  return (
    <>
      <PageHero
        image={heroImage}
        eyebrow={<Eyebrow tone="light">{t('hubEyebrow')}</Eyebrow>}
        title={t('hubTitle')}
        lede={t('hubLede')}
        actions={
          <Link
            href="/plan"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-sun-500 px-6 font-semibold text-on-accent transition-colors hover:bg-sun-600"
          >
            {t('buildTrip')}
          </Link>
        }
      />

      <Section tone="sand">
        <SectionHeading eyebrow={t('hubEyebrow')} title={t('hubGridTitle')} />
        <div className="grid gap-5 md:grid-cols-3">
          {surfaces.map((surface, index) => (
            <EditorialCard
              key={surface.href}
              href={surface.href}
              title={surface.title}
              kicker={surface.kicker}
              meta={<SurfaceMeta icon={surface.icon} label={surface.count} />}
              image={surface.image || NEUTRAL_MEDIA}
              size={index === 0 ? 'lg' : 'md'}
              priority={index === 0}
            />
          ))}
        </div>
      </Section>
    </>
  )
}

function SurfaceMeta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  )
}
