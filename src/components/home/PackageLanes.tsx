'use client'

import { useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { PaymentTerms } from '@/components/brand/PaymentTerms'
import { Rail } from '@/components/brand/Rail'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import { Reveal } from '@/components/motion/Reveal'
import type { PaymentPolicy } from '@/lib/payment-rules'
import type { PackageLanes as PackageLanesData } from '@/lib/home-sections'

type Props = {
  lanes: PackageLanesData
  policies: PaymentPolicy[]
}

/**
 * Two visibly distinct lanes, per the M2 brief: a Dahab Stay Package
 * (payment_kind 'stay_package', 50/50) is never presented as the same
 * product as a Sinai Experience Package (100% after confirmation). A lane
 * with no published packages is hidden outright rather than shown empty.
 */
export function PackageLanes({ lanes, policies }: Props) {
  const t = useTranslations('homeV2.packages')

  if (lanes.stayPackages.length === 0 && lanes.experiencePackages.length === 0) return null

  return (
    <Section tone="paper">
      <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />

      <div className="space-y-10">
        {lanes.stayPackages.length > 0 && (
          <PackageLane
            titleKey="stayLane"
            packages={lanes.stayPackages}
            kind="stay_package"
            policies={policies}
          />
        )}
        {lanes.experiencePackages.length > 0 && (
          <PackageLane
            titleKey="experienceLane"
            packages={lanes.experiencePackages}
            kind="experience_package"
            policies={policies}
          />
        )}
      </div>
    </Section>
  )
}

function PackageLane({
  titleKey,
  packages,
  kind,
  policies,
}: {
  titleKey: 'stayLane' | 'experienceLane'
  packages: PackageLanesData['stayPackages']
  kind: 'stay_package' | 'experience_package'
  policies: PaymentPolicy[]
}) {
  const t = useTranslations('homeV2.packages')

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 border-t border-sand-300 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-sea-900">{t(`${titleKey}.title`)}</h3>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-ink-muted">{t(`${titleKey}.body`)}</p>
        </div>
        <PaymentTerms kind={kind} policies={policies} compact />
      </div>

      <Rail label={t(`${titleKey}.title`)}>
        {packages.map((pkg) => (
          <Reveal key={pkg.id} className="w-[78vw] shrink-0 sm:w-80">
            <TripPackageCard pkg={pkg} />
          </Reveal>
        ))}
      </Rail>

      <div className="mt-4">
        <ButtonLink href="/sinai-trips/packages" variant="outline-ink" size="sm">
          {t('cta')}
        </ButtonLink>
      </div>
    </div>
  )
}
