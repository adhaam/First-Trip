import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Route } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { TripPackageBookingForm } from '@/components/sinai-trips/TripPackageBookingForm'
import { PackageTripsGrid } from '@/components/explore/PackageTripsGrid'
import { PackageValueCard } from '@/components/explore/PackageValueCard'
import { PickupNote } from '@/components/explore/PickupNote'
import { Eyebrow, PageHero, Section, SectionHeading, StickyActionBar } from '@/components/brand'
import { getTripPackageBySlugForDetail } from '@/lib/trip-packages'
import { getSiteSettings } from '@/lib/data'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { WHATSAPP_NUMBER } from '@/lib/constants'

export const revalidate = 60

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const pkg = await getTripPackageBySlugForDetail(slug)
  if (!pkg) return {}

  const ar = locale === 'ar'
  const name = ar ? pkg.name_ar : pkg.name_en
  return {
    title: name,
    description: (ar ? pkg.short_description_ar : pkg.short_description_en) || undefined,
    alternates: buildAlternates(`/sinai-trips/packages/${pkg.slug}`, locale),
  }
}

export default async function PackageDetail({ params }: Props) {
  const { locale, slug } = await params
  const [pkg, settings, rules, t, common, ui] = await Promise.all([
    getTripPackageBySlugForDetail(slug),
    getSiteSettings(),
    getPaymentRules(),
    getTranslations({ locale, namespace: 'explore' }),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'ui' }),
  ])
  if (!pkg) notFound()

  const ar = locale === 'ar'
  const name = ar ? pkg.name_ar : pkg.name_en
  const description = (ar ? pkg.description_ar : pkg.description_en) || ''
  const short = (ar ? pkg.short_description_ar : pkg.short_description_en) || ''
  const trips = pkg.trips || []
  const cover = pkg.image || trips[0]?.image || '/media/heroposter.webp'
  // Every trip_package is one public product, a Sinai trip package, paid
  // 100% after confirmation — never derived from the package's own
  // `payment_kind` here (see docs/m2/BRIEF.md "Package semantics").
  const kind = 'experience_package' as const
  const totals = pkg.totals!

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
    ...(short ? { description: short } : {}),
    image: [cover],
    url: `${SITE_URL}${locale === 'en' ? '/en' : ''}/sinai-trips/packages/${pkg.slug}`,
  }

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />

      <PageHero
        image={cover}
        eyebrow={
          <Eyebrow tone="light">
            <Route className="h-4 w-4" /> {t('packageBadge')}
          </Eyebrow>
        }
        title={name}
        lede={short}
        actions={
          <Link
            href="/sinai-trips/packages"
            className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-5 font-semibold text-white"
          >
            {t('backToPackages')}
          </Link>
        }
      />

      <Section tone="sand">
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-12">
            {description && (
              <section>
                <SectionHeading title={t('overview')} />
                <p className="whitespace-pre-line leading-8 text-ink-muted">{description}</p>
              </section>
            )}

            <section>
              <SectionHeading title={t('includedTrips')} />
              <PackageTripsGrid trips={trips} locale={locale} />
            </section>

            <div className="rounded-xl border border-sand-300 bg-card p-4">
              <PickupNote label={t('pickup')} />
            </div>
          </div>

          <aside className="h-fit space-y-5 lg:sticky lg:top-24">
            <PackageValueCard
              totals={totals}
              kind={kind}
              policies={rules.policies}
              locale={locale}
              labels={{
                packageValue: t('packageValue'),
                bookedSeparately: t('bookedSeparately'),
                packagePrice: t('packagePrice'),
                youSave: t('youSave'),
                perPerson: ui('unitPerson'),
                egp: common('egp'),
              }}
            />

            <div id="request" className="rounded-2xl border border-sand-300 bg-card p-5">
              <TripPackageBookingForm
                packageId={pkg.id}
                packageNameAr={pkg.name_ar}
                packageNameEn={pkg.name_en}
                whatsappNumber={settings?.whatsapp_number || WHATSAPP_NUMBER}
              />
            </div>

            <Link
              href={`/plan?package=${encodeURIComponent(pkg.id)}`}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-sea-900 px-5 font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50"
            >
              {t('addToTrip')}
            </Link>
          </aside>
        </div>
      </Section>

      <StickyActionBar
        summary={<span>{t('packageBadge')}</span>}
        action={
          <a href="#request" className="inline-flex min-h-11 items-center rounded-full bg-sun-500 px-5 font-semibold text-on-accent">
            {t('request')}
          </a>
        }
      />
    </article>
  )
}
