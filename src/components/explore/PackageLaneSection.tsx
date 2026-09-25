import type { ReactNode } from 'react'
import { Eyebrow, PaymentTerms, Section, SectionHeading } from '@/components/brand'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import type { PaymentPolicy } from '@/lib/payment-rules'
import type { PackageLane } from '@/lib/explore'
import type { TripPackage } from '@/lib/types'

const LANE_TONE = { stay: 'sand', experience: 'night' } as const
const LANE_PAYMENT_KIND = { stay: 'stay_package', experience: 'experience_package' } as const

/**
 * One lane of `/sinai-trips/packages` — stay packages get the paper/warm
 * treatment, experience packages the night/sea one (BRIEF.md: "different
 * visual treatment... different explanatory copy"). A lane with nothing
 * published is hidden entirely rather than rendered empty; the caller
 * decides that by simply not rendering this component for it.
 */
export function PackageLaneSection({
  lane,
  packages,
  policies,
  mark,
  title,
  subtitle,
}: {
  lane: PackageLane
  packages: TripPackage[]
  policies: PaymentPolicy[]
  mark: ReactNode
  title: ReactNode
  subtitle: ReactNode
}) {
  if (!packages.length) return null
  const stay = lane === 'stay'

  return (
    <Section tone={LANE_TONE[lane]}>
      <SectionHeading
        tone={stay ? 'ink' : 'light'}
        eyebrow={<Eyebrow tone={stay ? 'ink' : 'light'}>{mark}</Eyebrow>}
        title={title}
        subtitle={
          <>
            {subtitle}
            <PaymentTerms
              kind={LANE_PAYMENT_KIND[lane]}
              policies={policies}
              compact
              className={stay ? 'mt-2' : 'mt-2 text-sand-100'}
            />
          </>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <TripPackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </Section>
  )
}
