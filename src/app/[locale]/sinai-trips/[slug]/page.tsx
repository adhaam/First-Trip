import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { TripBookingForm } from '@/components/sinai-trips/TripBookingForm'
import { TripCard } from '@/components/cards/TripCard'
import { TripPackageRail } from '@/components/TripPackageRail'
import { TripDetailGallery } from '@/components/explore/TripDetailGallery'
import { TripDetailIncluded } from '@/components/explore/TripDetailIncluded'
import { TripDetailInfoCard } from '@/components/explore/TripDetailInfoCard'
import { Eyebrow, PageHero, Section, SectionHeading, StickyActionBar } from '@/components/brand'
import { getSinaiTripById, getSinaiTrips, getSiteSettings } from '@/lib/data'
import { getTripPackages } from '@/lib/trip-packages'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { packagesIncludingTrip } from '@/lib/explore'
import { getTripIdFromRouteSlug, getTripRouteSlug } from '@/lib/trips'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getPathname } from '@/i18n/navigation'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { effectiveTripPrice } from '@/lib/pricing'
import { getBreadcrumbSchema, getTouristTripSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'
import { getCommunityPostsLinkingTarget } from '@/lib/community-links'
import { LocalGuides } from '@/components/community/LocalGuides'

export const revalidate = 60

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const id = getTripIdFromRouteSlug(slug)
  const trip = id ? await getSinaiTripById(id) : null
  if (!trip) return {}

  const ar = locale === 'ar'
  const name = (ar ? trip.name_ar : trip.name_en) || trip.name_en
  const description = (ar ? trip.description_ar : trip.description_en) || undefined
  const alternates = buildAlternates(`/sinai-trips/${getTripRouteSlug(trip)}`, locale)
  const image = trip.images?.[0]
  return {
    title: name,
    description,
    alternates,
    openGraph: {
      title: name,
      description,
      url: `${SITE_URL}${getPathname({ href: `/sinai-trips/${getTripRouteSlug(trip)}`, locale })}`,
      ...(image ? { images: [{ url: image }] } : {}),
      type: 'website',
      locale: ar ? 'ar_EG' : 'en_US',
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function TripDetail({ params }: Props) {
  const { locale, slug } = await params
  const id = getTripIdFromRouteSlug(slug)
  if (!id) notFound()

  const [trip, trips, packages, settings, rules, t, localGuides] = await Promise.all([
    getSinaiTripById(id),
    getSinaiTrips(),
    getTripPackages(),
    getSiteSettings(),
    getPaymentRules(),
    getTranslations({ locale, namespace: 'explore' }),
    getCommunityPostsLinkingTarget('trip', id),
  ])
  if (!trip) notFound()
  const td = await getTranslations({ locale, namespace: 'discovery' })

  const ar = locale === 'ar'
  const name = (ar ? trip.name_ar : trip.name_en) || trip.name_en
  const description = (ar ? trip.description_ar : trip.description_en) || ''
  const duration = (ar ? trip.duration : trip.duration_en) || trip.duration
  const includes = (ar ? trip.includes_ar : trip.includes_en) || []
  const tags = trip.category_tags || (trip.category ? [trip.category] : [])
  const images = trip.images?.filter(Boolean) || []
  const related = trips
    .filter((item) => item.id !== trip.id && tags.some((tag) => item.category_tags?.some((candidate) => candidate.id === tag.id)))
    .slice(0, 3)
  const crossSellPackages = packagesIncludingTrip(packages, trip.id)
  const pageUrl = `${SITE_URL}${getPathname({ href: `/sinai-trips/${getTripRouteSlug(trip)}`, locale })}`
  const price = effectiveTripPrice(trip).final

  const schema = getTouristTripSchema({
    name,
    description,
    url: pageUrl,
    image: images[0] || null,
    // Only when the trip is bookable as a standalone product at this
    // price on this page — a trip's package_price (its price INSIDE a
    // bundle) is never shown here, so it is never put in offers either.
    offers: price ? { price } : null,
  })
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: ar ? 'رحلات سيناء' : 'Sinai Trips', url: `${SITE_URL}${getPathname({ href: '/sinai-trips', locale })}` },
    { name, url: pageUrl },
  ])

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />

      <PageHero
        image={images[0]}
        eyebrow={<Eyebrow tone="light">{tags.map((tag) => (ar ? tag.name_ar : tag.name_en)).filter(Boolean).join(' · ')}</Eyebrow>}
        title={name}
        actions={
          <Link href="/sinai-trips" className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-5 font-semibold text-white">
            {t('backToTrips')}
          </Link>
        }
      />

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-12">
            <section>
              <SectionHeading title={t('overview')} />
              <p className="max-w-3xl whitespace-pre-line leading-8 text-ink-muted">{description}</p>
            </section>

            {images.length > 1 && (
              <section>
                <SectionHeading title={t('gallery')} />
                <TripDetailGallery images={images.slice(1, 7)} name={name} />
              </section>
            )}

            {includes.length > 0 && (
              <section>
                <SectionHeading title={t('included')} />
                <TripDetailIncluded items={includes} />
              </section>
            )}
          </div>

          <aside className="h-fit space-y-5 lg:sticky lg:top-24">
            <TripDetailInfoCard
              duration={duration}
              dateConfirmedLabel={t('dateConfirmed')}
              durationLabel={t('duration')}
              pickupLabel={t('pickup')}
              policies={rules.policies}
            />

            <div id="request" className="rounded-2xl border border-sand-300 bg-card p-5">
              <TripBookingForm
                tripId={trip.id}
                tripNameAr={trip.name_ar}
                tripNameEn={trip.name_en}
                whatsappNumber={settings?.whatsapp_number || WHATSAPP_NUMBER}
              />
            </div>

            <Link
              href={`/plan?trip=${encodeURIComponent(trip.id)}`}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-sea-900 px-5 font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50"
            >
              {t('addToTrip')}
            </Link>
          </aside>
        </div>
      </Section>

      {crossSellPackages.length > 0 && (
        <Section tone="paper" size="sm">
          <TripPackageRail packages={crossSellPackages} title={t('crossSellTitle')} lede={t('crossSellLede')} />
        </Section>
      )}

      {related.length > 0 && (
        <Section tone="sand">
          <SectionHeading title={t('related')} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <TripCard key={item.id} trip={item} />
            ))}
          </div>
        </Section>
      )}

      {localGuides.length > 0 && (
        <Section tone="paper" size="sm">
          <LocalGuides posts={localGuides} locale={locale} heading={td('localGuides.heading')} />
        </Section>
      )}

      <StickyActionBar
        summary={<span>{t('pickup')}</span>}
        action={
          <a href="#request" className="inline-flex min-h-11 items-center rounded-full bg-sun-500 px-5 font-semibold text-on-accent">
            {t('request')}
          </a>
        }
      />
    </article>
  )
}
