import type { Metadata } from 'next'
import { SafeImage as Image } from '@/components/SafeImage'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Clock, Layers } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTripPackageBySlugForDetail } from '@/lib/trip-packages'
import { getSiteSettings } from '@/lib/data'
import { TripPackageBookingForm } from '@/components/sinai-trips/TripPackageBookingForm'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { buildAlternates, SITE_URL } from '@/lib/seo'

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const pkg = await getTripPackageBySlugForDetail(slug)
  if (!pkg) return {}

  const ar = locale === 'ar'
  const name = ar ? pkg.name_ar : pkg.name_en
  const description = (ar ? pkg.short_description_ar : pkg.short_description_en) || undefined
  const canonicalPath = `/sinai-trips/packages/${pkg.slug}`

  return {
    title: name,
    description,
    alternates: buildAlternates(canonicalPath, locale),
    openGraph: {
      title: name,
      description,
      type: 'website',
      images: pkg.image ? [{ url: pkg.image, alt: name }] : undefined,
    },
  }
}

export default async function TripPackageDetailPage({ params }: PageProps) {
  const { locale, slug } = await params
  const [pkg, settings] = await Promise.all([
    getTripPackageBySlugForDetail(slug),
    getSiteSettings(),
  ])
  if (!pkg) notFound()

  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: 'sinai' }),
    getTranslations({ locale, namespace: 'common' }),
  ])

  const ar = locale === 'ar'
  const name = ar ? pkg.name_ar : pkg.name_en
  const badge = ar ? pkg.badge_ar : pkg.badge_en
  const shortDescription = (ar ? pkg.short_description_ar : pkg.short_description_en) || ''
  const description = (ar ? pkg.description_ar : pkg.description_en) || ''
  const trips = pkg.trips || []
  const cover = pkg.image || trips[0]?.image || '/media/heroposter.webp'
  const totals = pkg.totals ?? { publicTotal: 0, packageTotal: 0, savings: 0, isValid: false }
  const canonicalPath = `/sinai-trips/packages/${pkg.slug}`
  const whatsappNumber = settings?.whatsapp_number || WHATSAPP_NUMBER

  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
    ...(shortDescription ? { description: shortDescription } : {}),
    ...(pkg.image ? { image: [pkg.image] } : {}),
    url: `${SITE_URL}${locale === 'en' ? '/en' : ''}${canonicalPath}`,
  }

  return (
    <article className="bg-sand-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />

      <header className="relative isolate min-h-[50svh] overflow-hidden bg-sea-900 text-white">
        <Image src={cover} alt={name} fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
        <div className="container-main flex min-h-[50svh] flex-col justify-end pb-12 pt-28 md:pb-16">
          <Link href="/sinai-trips" className="mb-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            {t('title')}
          </Link>
          {badge && <p className="eyebrow text-sun-300">{badge}</p>}
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">{name}</h1>
          {shortDescription && <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">{shortDescription}</p>}
        </div>
      </header>

      <div>
        <section className="container-main py-12 md:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
            <div className="space-y-12">
              {description && (
                <section aria-labelledby="package-overview-heading">
                  <h2 id="package-overview-heading" className="font-display text-2xl font-bold text-sea-900">
                    {ar ? 'عن الباكدج' : 'About this package'}
                  </h2>
                  <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink-muted">{description}</p>
                </section>
              )}

              <section aria-labelledby="package-trips-heading">
                <h2 id="package-trips-heading" className="flex items-center gap-2 font-display text-2xl font-bold text-sea-900">
                  <Layers className="h-5 w-5 text-sun-700" aria-hidden="true" />
                  {t('experiencesCount', { count: trips.length })}
                </h2>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {trips.map((trip) => {
                    const tripName = ar ? trip.name_ar : trip.name_en
                    const tripDesc = ar
                      ? (trip as unknown as { description_ar?: string }).description_ar
                      : (trip as unknown as { description_en?: string }).description_en
                    const duration = ar
                      ? (trip as unknown as { duration?: string }).duration
                      : (trip as unknown as { duration_en?: string }).duration_en
                    return (
                      <div key={trip.id} className="flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <Image
                            src={trip.image || '/media/heroposter.webp'}
                            alt={tripName}
                            fill
                            sizes="(max-width: 640px) 100vw, 45vw"
                            className="object-cover"
                          />
                          {duration && (
                            <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-sea-900/70 px-2.5 py-1 text-[0.7rem] font-medium text-white backdrop-blur">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {duration}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="font-display text-base font-semibold text-sea-900">{tripName}</h3>
                          {tripDesc && (
                            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{tripDesc}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <aside className="h-fit space-y-6 lg:sticky lg:top-24">
              <div className="border border-sand-300 bg-card p-6">
                <h2 className="font-display text-lg font-bold text-sea-900">
                  {ar ? 'قيمة الباكدج' : 'Package value'}
                </h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-muted">{ar ? 'لو حجزتهم منفصلين' : 'Booked separately'}</dt>
                    <dd className="font-medium text-ink-subtle line-through">
                      {fmt(totals.publicTotal)} {common('egp')}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-muted font-medium">{ar ? 'سعر الباكدج' : 'Package price'}</dt>
                    <dd className="font-display text-xl font-extrabold text-sea-900">
                      {fmt(totals.packageTotal)} <span className="text-sm font-semibold text-ink-muted">{common('egp')}</span>
                    </dd>
                  </div>
                  {totals.savings > 0 && (
                    <div className="flex items-center justify-between rounded-md bg-sun-50 px-3 py-2">
                      <dt className="font-semibold text-sun-700">{ar ? 'وفّرت' : 'You save'}</dt>
                      <dd className="font-display text-base font-extrabold text-sun-700">
                        {fmt(totals.savings)} {common('egp')}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 text-xs text-ink-subtle">
                  {ar ? `للـ ${trips.length} تجارب مع بعض` : `For all ${trips.length} experiences together`}
                </p>
              </div>

              <div className="border border-sand-300 bg-card p-6">
                <TripPackageBookingForm
                  packageId={pkg.id}
                  packageNameAr={pkg.name_ar}
                  packageNameEn={pkg.name_en}
                  whatsappNumber={whatsappNumber}
                />
              </div>
            </aside>
          </div>
        </section>
      </div>
    </article>
  )
}
