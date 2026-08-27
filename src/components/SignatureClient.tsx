'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { SignatureExperienceCard } from '@/components/cards/SignatureExperienceCard'
import { cn } from '@/lib/utils'
import type { Experience, ExperienceCategory } from '@/lib/types'

export function SignatureClient({
  categories,
  experiences,
}: {
  categories: ExperienceCategory[]
  experiences: Experience[]
}) {
  const t = useTranslations('signature')
  const states = useTranslations('states')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? experiences : experiences.filter((e) => e.category === filter)

  return (
    <>
      {/* Category showcase — the "Build Your Signature" tile links out instead of filtering */}
      {categories.length > 0 && (
        <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const isBuild = cat.slug === 'build-your-signature'
            const label = ar ? cat.label_ar : cat.label_en
            const desc = ar ? cat.description_ar : cat.description_en
            const content = (
              <div
                className={cn(
                  'flex h-full flex-col justify-between rounded-2xl border-[1.5px] p-6 transition-colors',
                  isBuild
                    ? 'border-weemap-orange bg-weemap-charcoal text-white hover:bg-weemap-charcoal/90'
                    : filter === cat.slug
                      ? 'border-weemap-orange bg-sun-50'
                      : 'border-sand-300 bg-white hover:border-weemap-orange/60',
                )}
              >
                <div>
                  <h3 className={cn('font-display text-lg font-bold', isBuild ? 'text-weemap-orange' : 'text-sea-900')}>{label}</h3>
                  {desc && <p className={cn('mt-2 text-sm leading-relaxed', isBuild ? 'text-white/75' : 'text-sea-900/60')}>{desc}</p>}
                </div>
                {isBuild && (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-weemap-orange">
                    {t('buildCta')}
                    <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                  </span>
                )}
              </div>
            )
            return isBuild ? (
              <Link key={cat.slug} href="/signature/build" className="h-full">{content}</Link>
            ) : (
              <button key={cat.slug} type="button" onClick={() => setFilter(filter === cat.slug ? 'all' : cat.slug)} className="h-full text-start">
                {content}
              </button>
            )
          })}
        </div>
      )}

      {experiences.length === 0 ? (
        <div className="py-16 text-center text-sea-900/40">{t('noExperiences')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sea-900/40">{states('noTripMatches')}</div>
      ) : (
        <div id="experiences" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exp, i) => (
            <Reveal key={exp.id} delay={(i % 9) * 60}>
              <SignatureExperienceCard experience={exp} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}
