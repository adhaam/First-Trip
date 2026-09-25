'use client'

import { useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { PaymentTerms } from '@/components/brand/PaymentTerms'
import { Rail } from '@/components/brand/Rail'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import { Reveal } from '@/components/motion/Reveal'
import type { PaymentPolicy } from '@/lib/payment-rules'
import type { TripPackage } from '@/lib/types'

type Props = {
  packages: TripPackage[]
  policies: PaymentPolicy[]
}

/**
 * Home's one "Sinai trip packages" rail — real Sinai trips bundled at a
 * better total than booking each apart, picked up from the guest's stay in
 * Dahab. A `trip_package` is a single public product here, never split into
 * a "stay" vs "experience" lane: `stay_package` is only an internal Trip
 * Builder payment classification (see docs/m2/BRIEF.md "Package semantics").
 * The Build-your-trip teaser section, not this one, is where transport +
 * stay is explained. Hidden outright when nothing is published.
 */
export function SinaiPackages({ packages, policies }: Props) {
  const t = useTranslations('homeV2.packages')

  if (packages.length === 0) return null

  return (
    <Section tone="paper">
      <SectionHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <ButtonLink href="/sinai-trips/packages" variant="outline-ink" size="lg">
            {t('cta')}
          </ButtonLink>
        }
      />

      <PaymentTerms kind="experience_package" policies={policies} compact className="mb-5" />

      <Rail label={t('title')}>
        {packages.map((pkg) => (
          <Reveal key={pkg.id} className="w-[78vw] shrink-0 sm:w-80">
            <TripPackageCard pkg={pkg} />
          </Reveal>
        ))}
      </Rail>
    </Section>
  )
}
