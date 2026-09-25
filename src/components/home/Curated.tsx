'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { PriceTag } from '@/components/brand/PriceTag'
import { Rail } from '@/components/brand/Rail'
import { Reveal } from '@/components/motion/Reveal'
import { effectiveTripPrice } from '@/lib/pricing'
import { discountedExperiencePrice } from '@/lib/experience-pricing'
import { getTripRouteSlug } from '@/lib/trips'
import { formatDateShort } from '@/lib/format'
import { isFallbackCurated, type CuratedPick, type CuratedReason } from '@/lib/home-sections'

const REASON_BADGE_KEY: Record<CuratedReason, string> = {
  featured: 'badgeFeatured',
  discount: 'badgeDiscount',
  'signature-date': 'badgeSignatureDate',
  curated: '',
}

function pickHref(pick: CuratedPick): string {
  if (pick.kind === 'trip') return `/sinai-trips/${getTripRouteSlug(pick.trip)}`
  if (pick.kind === 'package') return `/sinai-trips/packages/${pick.pkg.slug}`
  return `/signature/${pick.experience.slug}`
}

function pickImage(pick: CuratedPick): string {
  if (pick.kind === 'trip') return pick.trip.images?.[0] || '/media/heroposter.webp'
  if (pick.kind === 'package') return pick.pkg.image || pick.pkg.trips?.[0]?.image || '/media/heroposter.webp'
  return pick.experience.hero_image || '/media/heroposter.webp'
}

function pickTitle(pick: CuratedPick, ar: boolean): string {
  if (pick.kind === 'trip') return ar ? pick.trip.name_ar : pick.trip.name_en
  if (pick.kind === 'package') return ar ? pick.pkg.name_ar : pick.pkg.name_en
  return ar ? pick.experience.title_ar : pick.experience.title_en
}

function PickMeta({ pick, locale }: { pick: CuratedPick; locale: string }) {
  if (pick.kind === 'trip') {
    return <PriceTag amount={effectiveTripPrice(pick.trip).final} from unit="person" size="sm" tone="light" />
  }
  if (pick.kind === 'package') {
    // totals.packageTotal is SUM(package_price) of the bundled trips, each of
    // which is itself a per-person price — so the aggregate is per person too,
    // never a flat "per trip" total.
    return <PriceTag amount={pick.pkg.totals?.packageTotal ?? 0} unit="person" size="sm" tone="light" />
  }
  return (
    <>
      <span>{formatDateShort(pick.date.start_date, locale)}</span>
      <PriceTag
        amount={discountedExperiencePrice(pick.experience)}
        from={pick.experience.starting_from_price}
        unit="person"
        size="sm"
        tone="light"
      />
    </>
  )
}

/**
 * "Curated / happening now" — honest by construction. Every card carries a
 * real reason (owner-featured, an active discount window, or a real upcoming
 * Signature date) and says so on its badge. When nothing qualifies,
 * `selectCuratedPicks` falls back to a sort_order pick and this component
 * relabels the whole rail "Curated by WEEMAP" instead of pretending it's a
 * live deal — never fake urgency.
 */
export function Curated({ picks }: { picks: CuratedPick[] }) {
  const t = useTranslations('homeV2.curated')
  const locale = useLocale()
  const ar = locale === 'ar'

  if (picks.length === 0) return null

  const fallback = isFallbackCurated(picks)
  const [hero, ...rest] = picks

  return (
    <Section tone="sand">
      <SectionHeading
        eyebrow={fallback ? t('eyebrowFallback') : t('eyebrow')}
        title={fallback ? t('titleFallback') : t('title')}
        subtitle={fallback ? undefined : t('subtitle')}
        action={
          <ButtonLink href="/explore" variant="outline-ink" size="lg">
            {t('cta')}
          </ButtonLink>
        }
      />

      {/* items-start: cards size to their own content instead of stretching
          to match whichever column is taller (see the same fix in Stays.tsx). */}
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <EditorialCard
            href={pickHref(hero)}
            image={pickImage(hero)}
            title={pickTitle(hero, ar)}
            size="lg"
            badge={!fallback && REASON_BADGE_KEY[hero.reason] ? t(REASON_BADGE_KEY[hero.reason]) : undefined}
            meta={<PickMeta pick={hero} locale={locale} />}
          />
        </Reveal>

        <div className="lg:col-span-5">
          <Rail label={fallback ? t('eyebrowFallback') : t('eyebrow')}>
            {rest.map((pick) => (
              <div key={`${pick.kind}:${pick.id}`} className="w-[78vw] shrink-0 sm:w-72">
                <EditorialCard
                  href={pickHref(pick)}
                  image={pickImage(pick)}
                  title={pickTitle(pick, ar)}
                  size="sm"
                  badge={!fallback && REASON_BADGE_KEY[pick.reason] ? t(REASON_BADGE_KEY[pick.reason]) : undefined}
                  meta={<PickMeta pick={pick} locale={locale} />}
                />
              </div>
            ))}
          </Rail>
        </div>
      </div>
    </Section>
  )
}
