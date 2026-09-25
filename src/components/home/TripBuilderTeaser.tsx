'use client'

import { useTranslations } from 'next-intl'
import { Compass, ListChecks, Send, ShieldCheck, PalmtreeIcon, PlusCircle } from 'lucide-react'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'discover', icon: Compass },
  { key: 'shape', icon: ListChecks },
  { key: 'request', icon: Send },
  { key: 'confirm', icon: ShieldCheck },
  { key: 'experience', icon: PalmtreeIcon },
  { key: 'addMore', icon: PlusCircle },
] as const

/**
 * Introduces the Trip Builder as a route — a dashed line (the brand's map
 * motif) running through six stops, not a numbered form. The one thing this
 * section must get right is honesty about the flow: WEEMAP confirms real
 * availability before anything is booked, and nothing is paid online — see
 * `ui.paymentNothingOnline`, the same line every payment surface on the site
 * uses, rather than restating a percentage here.
 */
export function TripBuilderTeaser() {
  const t = useTranslations('homeV2.builder')

  return (
    <Section tone="night">
      <SectionHeading
        tone="light"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <ButtonLink href="/plan" variant="sun" size="lg">
            {t('cta')}
          </ButtonLink>
        }
      />

      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-6 hidden border-t-2 border-dashed border-white/20 lg:block"
        />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.key} delay={i * 70} as="li" className="relative">
              <div className="relative flex flex-col items-start">
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-sun-400/70 bg-sea-900 text-sun-300',
                  )}
                >
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-base font-bold text-white">{t(`steps.${step.key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{t(`steps.${step.key}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>

      <Reveal delay={STEPS.length * 70} className="mt-9">
        <p className="max-w-xl text-sm leading-relaxed text-white/70">{t('note')}</p>
      </Reveal>
    </Section>
  )
}
