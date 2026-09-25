'use client'

import { useTranslations } from 'next-intl'
import { ShoppingBag, Bike } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from '@/components/brand/Section'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { Reveal } from '@/components/motion/Reveal'
import type { ShopRentVisibility } from '@/lib/home-sections'

/**
 * Only shows a lane with real, active inventory (`selectShopRentVisibility`
 * counts live `getCommerceProducts` rows) — never an empty grid pretending to
 * be a shop. When there's nothing to show at all, a single quiet line takes
 * the section's place instead of disappearing without explanation.
 */
export function ShopRent({ visibility }: { visibility: ShopRentVisibility }) {
  const t = useTranslations('homeV2.shop')

  if (!visibility.showShop && !visibility.showRent) {
    return (
      <Section tone="sand" size="sm">
        <p className="text-center text-sm text-ink-subtle">{t('emptyLine')}</p>
      </Section>
    )
  }

  return (
    <Section tone="sand">
      <SectionHeading eyebrow={t('eyebrow')} title={t('title')} />

      <div className="grid gap-5 md:grid-cols-2">
        {visibility.showShop && (
          <Reveal className="h-full">
            <Link
              href="/merch"
              className="hover-lift group flex h-full flex-col justify-between border-[1.5px] border-sand-300 bg-card p-8 pin-card transition-colors hover:border-sea-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-2"
            >
              <div>
                <span aria-hidden className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-50 text-sea-900">
                  <ShoppingBag className="h-6 w-6" />
                </span>
                <h3 className="font-display text-xl font-semibold text-sea-900">{t('merch.title')}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t('merch.body')}</p>
              </div>
              <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 transition-colors group-hover:text-sun-700">
                {t('merch.cta')}
                <ArrowForward className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>
        )}

        {visibility.showRent && (
          <Reveal delay={80} className="h-full">
            <Link
              href="/rent"
              className="hover-lift group flex h-full flex-col justify-between border-[1.5px] border-sand-300 bg-sea-900 p-8 pin-card text-white transition-colors hover:border-sun-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-2"
            >
              <div>
                <span aria-hidden className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sun-300">
                  <Bike className="h-6 w-6" />
                </span>
                <h3 className="font-display text-xl font-semibold text-white">{t('rent.title')}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{t('rent.body')}</p>
              </div>
              <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-sun-300 transition-colors group-hover:text-sun-200">
                {t('rent.cta')}
                <ArrowForward className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>
        )}
      </div>
    </Section>
  )
}
