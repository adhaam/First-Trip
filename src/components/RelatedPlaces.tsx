'use client'

import { useTranslations } from 'next-intl'
import { SectionHeading } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import type { Accommodation } from '@/lib/types'

export function RelatedPlaces({ related }: { related: Accommodation[] }) {
  const t = useTranslations('book')

  if (related.length === 0) return null

  return (
    <section className="section-padding bg-sand-100">
      <div className="container-main">
        <SectionHeading title={t('relatedTitle')} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((rel, i) => (
            <Reveal key={rel.id} delay={i * 80} className="h-full">
              <AccommodationCard acc={rel} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
