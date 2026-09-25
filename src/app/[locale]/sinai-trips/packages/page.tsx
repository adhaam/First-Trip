import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getTripPackages } from '@/lib/trip-packages'
import { groupPackagesByLane } from '@/lib/explore'
import { EmptyState } from '@/components/EmptyState'
import { Eyebrow, PageHero, Section } from '@/components/brand'
import { PackageLaneSection } from '@/components/explore/PackageLaneSection'
import { Link } from '@/i18n/navigation'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'explore' })
  return { title: t('packages'), description: t('packagesLede'), alternates: buildAlternates('/sinai-trips/packages', locale) }
}

/**
 * `/sinai-trips/packages` — two lanes that are never presented as the same
 * product: Dahab Stay Packages (`payment_kind: 'stay_package'`, 50/50) and
 * Sinai Experience Packages (`'experience_package'`, 100% after
 * confirmation). An empty lane is hidden outright; both empty is the
 * curating empty state, never a bare "no results".
 */
export default async function PackagesPage() {
  const [packages, rules, t] = await Promise.all([getTripPackages(), getPaymentRules(), getTranslations('explore')])
  const lanes = groupPackagesByLane(packages)

  if (!packages.length) {
    return (
      <Section tone="paper">
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

  return (
    <>
      <PageHero
        image={packages[0]?.image}
        eyebrow={<Eyebrow tone="light">{t('packagesEyebrow')}</Eyebrow>}
        title={t('packagesTitle')}
        lede={t('packagesLede')}
      />

      <PackageLaneSection
        lane="stay"
        packages={lanes.stay}
        policies={rules.policies}
        mark={t('stayMark')}
        title={t('stayPackages')}
        subtitle={t('stayPackagesLine')}
      />

      <PackageLaneSection
        lane="experience"
        packages={lanes.experience}
        policies={rules.policies}
        mark={t('routeMark')}
        title={t('experiencePackages')}
        subtitle={t('experiencePackagesLine')}
      />
    </>
  )
}
