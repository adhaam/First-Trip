'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Star, MapPin, MessageCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from '@/components/brand/Section'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { PaymentTerms } from '@/components/brand/PaymentTerms'
import { StickyActionBar } from '@/components/brand/StickyActionBar'
import { PriceTag } from '@/components/brand/PriceTag'
import { ButtonLink } from '@/components/ButtonLink'
import { ArrowBack } from '@/components/brand/DirectionalIcon'
import { Reveal } from '@/components/motion/Reveal'
import { StayGallery } from '@/components/stays/StayGallery'
import { StayPricingCard } from '@/components/stays/StayPricingCard'
import { StayRoomsSection } from '@/components/stays/StayRoomsSection'
import { StayAmenities } from '@/components/stays/StayAmenities'
import { StayTripsRail } from '@/components/stays/StayTripsRail'
import { StayLocalGuides } from '@/components/stays/StayLocalGuides'
import { MapPreview } from '@/components/MapPreview'
import { RelatedPlaces } from '@/components/RelatedPlaces'
import { ACCOMMODATION_TAGS, WHATSAPP_NUMBER } from '@/lib/constants'
import { formatCount } from '@/lib/format'
import { resolveTierKey, fromPricePerPersonPerNight } from '@/lib/stays'
import type { Accommodation, CommunityPost, SinaiTrip } from '@/lib/types'
import type { PaymentPolicy } from '@/lib/payment-rules'

const TIER_LABEL_KEY = {
  budget: 'tierBudget',
  standard: 'tierStandard',
  premium: 'tierPremium',
  lagoon: 'tierLagoon',
} as const

export function ProductDetailClient({
  accommodation,
  whatsapp,
  sinaiTrips = [],
  communityPosts = [],
  related = [],
  policies,
}: {
  accommodation: Accommodation
  whatsapp?: string | null
  sinaiTrips?: SinaiTrip[]
  communityPosts?: CommunityPost[]
  related?: Accommodation[]
  policies: PaymentPolicy[]
}) {
  const t = useTranslations('stays')
  const locale = useLocale()
  const ar = locale === 'ar'

  const tag = ACCOMMODATION_TAGS[accommodation.type]
  const tierKey = resolveTierKey(accommodation.tier)
  const images = accommodation.images?.length ? accommodation.images : [accommodation.image_url || '/media/heroposter.webp']
  const name = ar ? accommodation.name_ar : accommodation.name_en
  const amenities = (ar ? accommodation.amenities_ar : accommodation.amenities_en) ?? []
  const location = ar ? accommodation.location_ar || accommodation.location : accommodation.location_en || accommodation.location
  const description = ar ? accommodation.description_ar : accommodation.description_en

  const digits = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(
    ar ? `استفسار عن ${accommodation.name_ar}` : `Question about ${accommodation.name_en}`,
  )}`
  const planHref = `/plan?stay=${encodeURIComponent(accommodation.id)}`

  // A post with no slug has no public URL yet — never show a "local guides"
  // teaser that leads nowhere.
  const linkableGuides = communityPosts.filter((post) => post.slug)

  const fromPrice = fromPricePerPersonPerNight(accommodation)
  const hasSeasonalRates = Boolean(accommodation.seasonal_rates?.length)
  const coords =
    accommodation.latitude != null && accommodation.longitude != null
      ? `${accommodation.latitude.toFixed(2)}°N · ${accommodation.longitude.toFixed(2)}°E`
      : undefined

  return (
    <div>
      <StayGallery images={images} name={name} />

      <div className="bg-sea-900 px-4 pb-4 pt-2 sm:px-6 lg:px-8">
        <Link
          href="/book-dahab"
          className="inline-flex h-9 items-center gap-1.5 text-xs font-semibold text-white/80 transition-colors hover:text-white"
        >
          <ArrowBack className="h-3.5 w-3.5" />
          {t('detail.back')}
        </Link>
      </div>

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-12">
          <div className="space-y-12">
            <Reveal>
              {coords && <Eyebrow coords={coords}>{ar ? tag?.label_ar : tag?.label_en}</Eyebrow>}
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-sea-900 sm:text-4xl">{name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-sun-700" />
                    {location}
                  </span>
                )}
                {accommodation.type === 'hotel' && accommodation.rating > 0 && (
                  <span
                    className="inline-flex items-center gap-1"
                    aria-label={t('detail.ratingLabel', { rating: formatCount(accommodation.rating, locale) })}
                  >
                    {Array.from({ length: accommodation.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-sun-500 text-sun-500" aria-hidden />
                    ))}
                  </span>
                )}
                {tierKey && (
                  <span className="rounded-full border border-sand-300 bg-sand-100 px-3 py-1 text-xs font-semibold text-ink-muted">
                    {t(`detail.${TIER_LABEL_KEY[tierKey]}`)}
                  </span>
                )}
              </div>
            </Reveal>

            {description && (
              <Reveal>
                <h2 className="font-display text-xl font-bold text-sea-900">{t('detail.aboutTitle')}</h2>
                <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-loose text-ink-muted">{description}</p>
              </Reveal>
            )}
          </div>

          <div className="lg:row-span-2">
            <div className="lg:sticky lg:top-24">
              <StayPricingCard
                fromPrice={fromPrice}
                hasSeasonalRates={hasSeasonalRates}
                policies={policies}
                planHref={planHref}
                whatsappHref={waLink}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="sand">
        <Reveal>
          <StayRoomsSection accommodation={accommodation} />
        </Reveal>
      </Section>

      {amenities.length > 0 && (
        <Section tone="paper">
          <Reveal>
            <StayAmenities amenities={amenities} />
          </Reveal>
        </Section>
      )}

      <Section tone="sand">
        <div className="grid gap-10 md:grid-cols-2">
          <Reveal>
            <MapPreview latitude={accommodation.latitude} longitude={accommodation.longitude} label={location} />
          </Reveal>
          <Reveal delay={100}>
            <h2 className="font-display text-xl font-bold text-sea-900">{t('detail.paymentTitle')}</h2>
            <div className="mt-5 space-y-4">
              <div className="border-[1.5px] border-sand-300 bg-card px-5 py-4 pin-card">
                {/* `.eyebrow` (not manual uppercase/tracking) — that utility
                    already drops the Latin uppercase+tracking treatment in
                    RTL (see globals.css), which matters here since this is a
                    label inside otherwise-Arabic body copy, not a standalone
                    Latin kicker. */}
                <p className="eyebrow mb-2 text-ink-subtle">{t('detail.paymentStayNote')}</p>
                <PaymentTerms kind="stay" policies={policies} />
              </div>
              <div className="border-[1.5px] border-sun-300 bg-sun-50 px-5 py-4 pin-card">
                <p className="eyebrow mb-2 text-sun-700">{t('detail.paymentPackageNote')}</p>
                <PaymentTerms kind="stay_package" policies={policies} compact />
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {sinaiTrips.length > 0 && (
        <Section tone="sea">
          <SectionHeading tone="light" title={t('detail.tripsTitle')} />
          <StayTripsRail trips={sinaiTrips} />
        </Section>
      )}

      {linkableGuides.length > 0 && (
        <Section tone="paper">
          <SectionHeading title={t('detail.guidesTitle')} />
          <StayLocalGuides posts={linkableGuides} />
        </Section>
      )}

      <RelatedPlaces related={related} />

      {/*
        StickyActionBar must be the LAST thing rendered: it ships its own
        in-flow spacer immediately before the fixed bar (see
        brand/StickyActionBar.tsx), and that spacer only protects whatever
        content comes before it in the DOM. Rendering RelatedPlaces above
        (not as a sibling after this component, as the page used to do) is
        what keeps its cards from ending up under the fixed bar on mobile.
      */}
      <StickyActionBar
        summary={<PriceTag amount={fromPrice} from unit="personNight" size="sm" />}
        action={
          <div className="flex items-center gap-2.5">
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              aria-label={t('detail.whatsappCta')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#25D366] text-[#128C4A]"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
            <ButtonLink href={planHref} variant="sun" size="lg">
              {t('detail.buildStayCta')}
            </ButtonLink>
          </div>
        }
      />
    </div>
  )
}
