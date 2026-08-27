import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowUpRight, Check, Layers } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getTripPackageBySlug } from '@/lib/trip-packages'
import { buildAlternates, SITE_URL } from '@/lib/seo'

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const pkg = await getTripPackageBySlug(slug)
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
  const pkg = await getTripPackageBySlug(slug)
  if (!pkg) notFound()

  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: 'sinai' }),
    getTranslations({ locale, namespace: 'common' }),
  ])
  const nav = await getTranslations({ locale, namespace: 'nav' })

  const ar = locale === 'ar'
  const name = ar ? pkg.name_ar : pkg.name_en
  const badge = ar ? pkg.badge_ar : pkg.badge_en
  const shortDescription = (ar ? pkg.short_description_ar : pkg.short_description_en) || ''
  const description = (ar ? pkg.description_ar : pkg.description_en) || ''
  const trips = pkg.trips || []
  const cover = pkg.image || trips[0]?.image || '/media/heroposter.png'
  const total = pkg.totals?.packageTotal ?? 0
  const canonicalPath = `/sinai-trips/packages/${pkg.slug}`

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

      <main>
        <section className="container-main py-12 md:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
            <div className="space-y-12">
              {description && (
                <section aria-labelledby="package-overview-heading">
                  <h2 id="package-overview-heading" className="font-display text-2xl font-bold text-sea-900">
                    {ar ? 'عن الباكدج' : 'About this package'}
                  </h2>
                  <p className="mt-4 whitespace-pre-line text-base leading-8 text-sea-900/72">{description}</p>
                </section>
              )}

              <section aria-labelledby="package-trips-heading">
                <h2 id="package-trips-heading" className="flex items-center gap-2 font-display text-2xl font-bold text-sea-900">
                  <Layers className="h-5 w-5 text-sun-500" aria-hidden="true" />
                  {t('experiencesCount', { count: trips.length })}
                </h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {trips.map((trip) => (
                    <li key={trip.id} className="flex items-start gap-3 border-t border-sand-300 pt-3 text-sm leading-6 text-sea-900/72">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sun-500" aria-hidden="true" />
                      <span>{ar ? trip.name_ar : trip.name_en}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="h-fit border border-sand-300 bg-card p-6 lg:sticky lg:top-24">
              <h2 className="font-display text-xl font-bold text-sea-900">{ar ? 'إجمالي الباكدج' : 'Package total'}</h2>
              <p className="mt-3 font-display text-3xl font-extrabold text-sea-900">
                {total.toLocaleString(ar ? 'ar-EG' : 'en-US')} <span className="text-base font-semibold text-sea-900/70">{common('egp')}</span>
              </p>
              <p className="mt-2 text-xs text-sea-900/50">
                {ar ? `للـ ${trips.length} تجارب مع بعض` : `For all ${trips.length} experiences together`}
              </p>
              <div className="mt-6 border-t border-sand-200 pt-6">
                <Link
                  href="/book-dahab"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sun-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-sun-600"
                >
                  {nav('book')}
                  <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
                <p className="mt-3 text-xs text-sea-900/50">
                  {ar ? 'اختار إقامتك في دهب وضيف الباكدج ده في نموذج الحجز.' : 'Pick your Dahab stay, then add this package in the booking form.'}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </article>
  )
}
