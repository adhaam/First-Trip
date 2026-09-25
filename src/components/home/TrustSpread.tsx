'use client'

import { useLocale, useTranslations } from 'next-intl'
import { MapPinned, ShieldCheck, Route, MessageCircle, Star } from 'lucide-react'
import { Section, SectionHeading } from '@/components/brand/Section'
import { Rail } from '@/components/brand/Rail'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import type { Testimonial } from '@/lib/types'

const CLAIMS = [
  { key: 'local', icon: MapPinned },
  { key: 'payment', icon: ShieldCheck },
  { key: 'pickup', icon: Route },
  { key: 'human', icon: MessageCircle },
] as const

/**
 * "Why WEEMAP" — four claims, each one checkable rather than aspirational
 * marketing copy (a local Dahab team, payment only after confirmation, pickup
 * from the guest's own Dahab accommodation, a human on WhatsApp). Testimonials
 * only render when `getTestimonials()` actually returned published rows —
 * never a placeholder quote.
 */
export function TrustSpread({ testimonials }: { testimonials: Testimonial[] }) {
  const t = useTranslations('homeV2.trust')
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <Section tone="paper">
      <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {CLAIMS.map(({ key, icon: Icon }, i) => (
          <Reveal key={key} delay={i * 60}>
            <article className="border-t border-sand-300 pt-5">
              <Icon className="h-6 w-6 text-sun-700" aria-hidden />
              <h3 className="mt-4 font-display text-base font-bold text-sea-900">{t(`${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{t(`${key}.body`)}</p>
            </article>
          </Reveal>
        ))}
      </div>

      {testimonials.length > 0 && (
        <div className="mt-12">
          <Rail label={t('testimonialsTitle')}>
            {testimonials.map((item) => (
              <div key={item.id} className="w-[82vw] shrink-0 sm:w-96">
                <article className="h-full border-[1.5px] border-sand-300 bg-card p-6 pin-card">
                  {item.rating > 0 && (
                    <div className="mb-3 flex gap-0.5" aria-hidden>
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} className={cn('h-3.5 w-3.5 fill-sun-500 text-sun-500')} />
                      ))}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-ink">&ldquo;{ar ? item.text_ar : item.text_en}&rdquo;</p>
                  <p className="mt-4 text-xs font-semibold text-ink-subtle">
                    {item.name}
                    {(ar ? item.trip_ar : item.trip_en) && <> · {ar ? item.trip_ar : item.trip_en}</>}
                  </p>
                </article>
              </div>
            ))}
          </Rail>
        </div>
      )}
    </Section>
  )
}
