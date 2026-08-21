import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowUpRight, Check, Clock, Layers3, MessageCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { TripCard } from '@/components/cards/TripCard'
import { TripBookingForm } from '@/components/sinai-trips/TripBookingForm'
import { getSinaiTripById, getSinaiTrips, getSiteSettings } from '@/lib/data'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getTripIdFromRouteSlug, getTripRouteSlug } from '@/lib/trips'

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const id = getTripIdFromRouteSlug(slug)
  const trip = id ? await getSinaiTripById(id) : null

  if (!trip) return {}

  const ar = locale === 'ar'
  const name = (ar ? trip.name_ar : trip.name_en) || trip.name_en || trip.name_ar
  const description = ((ar ? trip.description_ar : trip.description_en) || '').trim()
  const canonicalPath = `/sinai-trips/${getTripRouteSlug(trip)}`
  const images = (trip.images || []).filter(Boolean)

  return {
    title: name,
    description: description || undefined,
    alternates: buildAlternates(canonicalPath, locale),
    openGraph: {
      title: name,
      description: description || undefined,
      type: 'website',
      images: images.length ? images.map((url) => ({ url, alt: name })) : undefined,
    },
  }
}

export default async function SinaiTripDetailPage({ params }: PageProps) {
  const { locale, slug } = await params
  const id = getTripIdFromRouteSlug(slug)
  if (!id) notFound()

  const [trip, trips, settings, t, common] = await Promise.all([
    getSinaiTripById(id),
    getSinaiTrips(),
    getSiteSettings(),
    getTranslations({ locale, namespace: 'tripDetail' }),
    getTranslations({ locale, namespace: 'common' }),
  ])
  if (!trip) notFound()

  const ar = locale === 'ar'
  const name = (ar ? trip.name_ar : trip.name_en) || trip.name_en || trip.name_ar
  const description = ((ar ? trip.description_ar : trip.description_en) || '').trim()
  const duration = ((ar ? trip.duration : trip.duration_en) || '').trim()
  const category = ((ar ? trip.category_ar : trip.category_en) || '').trim()
  const includes = ((ar ? trip.includes_ar : trip.includes_en) || []).filter(Boolean)
  const images = (trip.images || []).filter(Boolean)
  const cover = images[0] || '/media/heroposter.png'
  const otherTrips = trips.filter((item) => item.id !== trip.id)
  const related = [
    ...otherTrips.filter((item) => trip.category_en && item.category_en === trip.category_en),
    ...otherTrips.filter((item) => !trip.category_en || item.category_en !== trip.category_en),
  ].slice(0, 3)
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const message = encodeURIComponent(
    ar ? `أريد معرفة تفاصيل رحلة ${name}` : `I'd like to know more about ${name}`,
  )
  const canonicalPath = `/sinai-trips/${getTripRouteSlug(trip)}`
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    url: `${SITE_URL}${locale === 'en' ? '/en' : ''}${canonicalPath}`,
    provider: {
      '@type': 'Organization',
      name: settings?.organization_name || 'WEEMAP SINAI',
      url: SITE_URL,
    },
  }

  return (
    <article className="bg-sand-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />

      <header className="relative isolate min-h-[64svh] overflow-hidden bg-sea-900 text-white">
        <Image src={cover} alt={name} fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
        <div className="container-main flex min-h-[64svh] flex-col justify-end pb-12 pt-28 md:pb-16">
          <Link href="/sinai-trips" className="mb-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            {t('backToTrips')}
          </Link>
          {category && <p className="eyebrow text-sun-300">{category}</p>}
          <h1 className="mt-4 max-w-5xl font-display text-4xl font-extrabold leading-tight sm:text-5xl md:text-7xl">{name}</h1>
          {description && <p className="mt-5 line-clamp-3 max-w-2xl text-lg leading-8 text-white/78">{description}</p>}
        </div>
      </header>

      <main>
        <section className="container-main py-12 md:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
            <div className="space-y-12">
              {images.length > 1 && (
                <section aria-labelledby="trip-gallery-heading">
                  <h2 id="trip-gallery-heading" className="font-display text-2xl font-bold text-sea-900">{t('gallery')}</h2>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.slice(1, 7).map((image, index) => (
                      <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden bg-sand-200 pin-card">
                        <Image src={image} alt={`${name} ${index + 2}`} fill sizes="(max-width: 640px) 50vw, 30vw" className="object-cover" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {description && (
                <section aria-labelledby="trip-overview-heading">
                  <h2 id="trip-overview-heading" className="font-display text-2xl font-bold text-sea-900">{t('overview')}</h2>
                  <p className="mt-4 whitespace-pre-line text-base leading-8 text-sea-900/72">{description}</p>
                </section>
              )}

              {includes.length > 0 && (
                <section aria-labelledby="trip-includes-heading">
                  <h2 id="trip-includes-heading" className="font-display text-2xl font-bold text-sea-900">{t('included')}</h2>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {includes.map((item) => (
                      <li key={item} className="flex items-start gap-3 border-t border-sand-300 pt-3 text-sm leading-6 text-sea-900/72">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-sun-500" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="h-fit border border-sand-300 bg-card p-6 lg:sticky lg:top-24">
              <h2 className="font-display text-xl font-bold text-sea-900">{t('tripInfo')}</h2>
              {(duration || category) && (
                <dl className="mt-5 divide-y divide-sand-300 border-y border-sand-300">
                  {duration && (
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-sea-900/60"><Clock className="h-4 w-4" aria-hidden="true" />{t('duration')}</dt>
                      <dd className="text-sm font-semibold text-sea-900">{duration}</dd>
                    </div>
                  )}
                  {category && (
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-sea-900/60"><Layers3 className="h-4 w-4" aria-hidden="true" />{t('category')}</dt>
                      <dd className="text-sm font-semibold text-sea-900">{category}</dd>
                    </div>
                  )}
                </dl>
              )}
              {Number.isFinite(Number(trip.price)) && Number(trip.price) > 0 && (
                <p className="mt-4 text-sm font-semibold text-sea-900">
                  {ar ? 'من' : 'From'} {Number(trip.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')} {common('egp')} / {ar ? 'شخص' : 'person'}
                </p>
              )}
              <div className="mt-6 border-t border-sand-200 pt-6">
                <TripBookingForm
                  tripId={trip.id}
                  tripNameAr={trip.name_ar || ''}
                  tripNameEn={trip.name_en || ''}
                  whatsappNumber={settings?.whatsapp_number || WHATSAPP_NUMBER}
                />
              </div>
              <div className="mt-4 border-t border-sand-200 pt-4">
                <p className="mb-3 text-xs text-sea-900/50">{ar ? 'أو تواصل معنا مباشرة:' : 'Or reach us directly:'}</p>
                <a
                  href={`https://wa.me/${whatsapp}?text=${message}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-sand-300 px-4 text-sm font-medium text-sea-900 transition-colors hover:bg-sand-100"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {t('askWhatsApp')}
                  <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                </a>
              </div>
            </aside>
          </div>
        </section>

        {related.length > 0 && (
          <section className="border-t border-sand-300 bg-sand-100 py-14 md:py-20" aria-labelledby="related-trips-heading">
            <div className="container-main">
              <h2 id="related-trips-heading" className="font-display text-3xl font-bold text-sea-900">{t('related')}</h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => <TripCard key={item.id} trip={item} />)}
              </div>
            </div>
          </section>
        )}
      </main>
    </article>
  )
}
