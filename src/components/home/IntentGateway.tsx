'use client'

import { useTranslations } from 'next-intl'
import { Building2, Compass, Mountain, Package, Sparkles, Bike } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading, TopoBackdrop } from '@/components/brand/Section'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { Reveal, GlowCard } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

const INTENTS = [
  { key: 'plan', href: '/plan', icon: Compass, emphasis: true },
  { key: 'stay', href: '/book-dahab', icon: Building2, emphasis: false },
  { key: 'trips', href: '/sinai-trips', icon: Mountain, emphasis: false },
  { key: 'packages', href: '/sinai-trips/packages', icon: Package, emphasis: false },
  { key: 'signature', href: '/signature', icon: Sparkles, emphasis: false },
  { key: 'rent', href: '/rent', icon: Bike, emphasis: false },
] as const

/**
 * "What do you want to do in Sinai?" — the six routes a visitor can be
 * heading for, each one tap from the homepage. `plan` gets the emphasis
 * treatment (dark tile, spans two columns) since it's the one path that
 * covers everyone else — the rest are equal-weight entry points, not a
 * ranked list.
 */
export function IntentGateway() {
  const t = useTranslations('homeV2.gateway')

  return (
    <Section tone="paper" className="relative">
      <TopoBackdrop />
      <div className="relative">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />

        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-6">
          {INTENTS.map((intent, i) => (
            <Reveal
              key={intent.key}
              delay={i * 60}
              className={cn('h-full', intent.emphasis && 'col-span-2 lg:col-span-2')}
            >
              <GlowCard className="h-full">
                <Link
                  href={intent.href}
                  className={cn(
                    'hover-lift group flex h-full min-h-40 flex-col border-[1.5px] p-5 pin-card transition-colors sm:min-h-48 sm:p-6',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-2',
                    intent.emphasis
                      ? 'border-sea-800 bg-sea-900 text-white hover:border-sun-400/60'
                      : 'border-sand-300 bg-card hover:border-sea-900/25',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]',
                      intent.emphasis ? 'bg-white/10 text-sun-300' : 'bg-sand-100 text-sea-900',
                    )}
                  >
                    <intent.icon className="h-5 w-5" />
                  </span>
                  <h3 className={cn('font-display text-base font-semibold sm:text-lg', intent.emphasis ? 'text-white' : 'text-sea-900')}>
                    {t(`${intent.key}.title`)}
                  </h3>
                  <p className={cn('mt-2 text-sm leading-relaxed', intent.emphasis ? 'text-white/70' : 'text-ink-muted')}>
                    {t(`${intent.key}.body`)}
                  </p>
                  <span
                    className={cn(
                      'mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold transition-colors group-hover:text-sun-700',
                      intent.emphasis ? 'text-sun-300' : 'text-sea-600',
                    )}
                  >
                    <ArrowForward className="h-4 w-4" />
                  </span>
                </Link>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  )
}
