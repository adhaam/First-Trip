import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getTripPackages } from '@/lib/trip-packages'
import { EmptyState } from '@/components/EmptyState'
import { Eyebrow, PageHero, PaymentTerms, Section, SectionHeading } from '@/components/brand'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import { PickupNote } from '@/components/explore/PickupNote'
import { Link, getPathname } from '@/i18n/navigation'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getCollectionPageSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'

export const revalidate = 60

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'explore' })
  const tMeta = await getTranslations({ locale, namespace: 'discovery' })
  return pageMetadata({ locale, path: '/sinai-trips/packages', title: tMeta('metaTitles.packages'), description: t('packagesLede') })
}

/**
 * `/sinai-trips/packages` — ONE coherent product: Sinai trip packages (real
 * Sinai trips bundled together at a better total than booking each apart,
 * picked up from the guest's stay in Dahab, paid 100% after confirmation —
 * `PaymentTerms kind="experience_package"`). This page never reads a
 * package's `payment_kind` to classify it into a lane — `stay_package` is an
 * internal Trip Builder payment classification, not a public package type
 * (see docs/m2/BRIEF.md "Package semantics"). Featured packages lead the
 * catalogue; the rest follow in a grid, never a wall of identical cards.
 * People who also want a stay are pointed at Build your trip, once, as a
 * single CTA block — never duplicated as catalogue cards here.
 */
export default async function PackagesPage({ params }: Props) {
  const { locale } = await params
  const [packages, rules, t, tDiscovery] = await Promise.all([
    getTripPackages(),
    getPaymentRules(),
    getTranslations({ locale, namespace: 'explore' }),
    getTranslations({ locale, namespace: 'discovery' }),
  ])
  const ar = locale === 'ar'
  const pageUrl = `${SITE_URL}${getPathname({ href: '/sinai-trips/packages', locale })}`
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: t('packagesTitle'), url: pageUrl },
  ])

  if (!packages.length) {
    const collectionSchema = getCollectionPageSchema({
      name: t('packagesTitle'),
      description: t('packagesLede'),
      url: pageUrl,
      items: [],
    })
    return (
      <Section tone="paper">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
        <EmptyState
          variant="curating"
          title={t('noPackages')}
          hint={t('noPackagesHint')}
          action={
            <Link href="/plan" className="inline-flex min-h-11 items-center rounded-full bg-sun-500 px-5 font-semibold text-on-accent">
              {t('buildTrip')}
            </Link>
          }
        />
      </Section>
    )
  }

  // Stable sort: featured packages lead, catalogue (sort_order) order is
  // otherwise untouched — the one piece of "which packages first" logic here,
  // simple enough not to need its own lib/ helper (unlike the home rail's
  // selectHomePackages, which several sections would otherwise duplicate).
  const ordered = [...packages].sort((a, b) => Number(b.featured) - Number(a.featured))
  const [hero, ...rest] = ordered

  // Real names of trips actually bundled into these packages (never
  // invented) — first three, deduplicated by id.
  const seenTripIds = new Set<string>()
  const categoryNames: string[] = []
  for (const pkg of ordered) {
    for (const trip of pkg.trips || []) {
      if (seenTripIds.has(trip.id)) continue
      seenTripIds.add(trip.id)
      categoryNames.push(ar ? trip.name_ar || trip.name_en : trip.name_en || trip.name_ar)
      if (categoryNames.length >= 3) break
    }
    if (categoryNames.length >= 3) break
  }
  const geoIntro = tDiscovery('geoIntro.sinaiTripsPackages', {
    count: packages.length,
    categories: categoryNames.join(ar ? '، ' : ', '),
  })

  const collectionSchema = getCollectionPageSchema({
    name: t('packagesTitle'),
    description: t('packagesLede'),
    url: pageUrl,
    items: ordered.map((pkg) => ({
      name: ar ? pkg.name_ar || pkg.name_en : pkg.name_en || pkg.name_ar,
      url: `${SITE_URL}${getPathname({ href: `/sinai-trips/packages/${pkg.slug}`, locale })}`,
    })),
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
      <PageHero
        image={hero.image || hero.trips?.[0]?.image || undefined}
        eyebrow={<Eyebrow tone="light">{t('packagesEyebrow')}</Eyebrow>}
        title={t('packagesTitle')}
        lede={t('packagesLede')}
      />

      {categoryNames.length > 0 && (
        <Section tone="paper" size="sm">
          <p className="max-w-2xl text-base leading-relaxed text-ink-muted">{geoIntro}</p>
        </Section>
      )}

      <Section tone="sand" size="sm">
        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('packagesWhatTitle')}</h2>
            <p className="mt-3 leading-relaxed text-ink-muted">{t('packagesWhatBody')}</p>
          </div>
          <div className="flex flex-col justify-center gap-3 border-t border-sand-300 pt-5 md:border-t-0 md:border-s md:ps-8 md:pt-0">
            <PickupNote label={t('pickup')} />
            <PaymentTerms kind="experience_package" policies={rules.policies} />
          </div>
        </div>
      </Section>

      <Section tone="paper">
        <SectionHeading eyebrow={t('packagesCatalogueMark')} title={t('packagesCatalogueTitle')} />

        <div className="space-y-6">
          <TripPackageCard pkg={hero} featured />

          {rest.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((pkg) => (
                <TripPackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section tone="night">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <Eyebrow tone="light">{t('buildTripEyebrow')}</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">{t('buildTripTitle')}</h2>
            <p className="mt-2 text-sand-100">{t('buildTripBody')}</p>
          </div>
          <Link
            href="/plan"
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-sun-500 px-6 font-semibold text-on-accent transition-colors hover:bg-sun-600"
          >
            {t('buildTrip')}
          </Link>
        </div>
      </Section>
    </>
  )
}
