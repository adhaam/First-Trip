'use client'

import { useTranslations } from 'next-intl'
import { Section, SectionHeading } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import type { Accommodation } from '@/lib/types'

export function RelatedPlaces({ related }: { related: Accommodation[] }) {
  const t = useTranslations('stays')

  if (related.length === 0) return null

  return (
    <Section tone="sand">
      <SectionHeading title={t('detail.relatedTitle')} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((rel, i) => (
          <Reveal key={rel.id} delay={i * 80} className="h-full">
            <AccommodationCard acc={rel} />
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
