import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Check, Clock, MapPin, X } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { ExperienceDates } from '@/components/experiences/ExperienceDates'
import { ExperienceGallery } from '@/components/experiences/ExperienceGallery'
import { ItineraryAccordion } from '@/components/experiences/ItineraryAccordion'
import { getExperienceBySlug, getExperienceCategories } from '@/lib/experiences-data'
import { getSiteSettings } from '@/lib/data'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import {
  categoryLabel,
  formatDuration,
  formatPrice,
  localized,
  localizedList,
  nextAvailableDate,
} from '@/lib/experiences'

export const revalidate = 60

type PageProps = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const experience = await getExperienceBySlug(slug)
  if (!experience) return {}

  const title = localized(experience, 'title', locale)
  const description = localized(experience, 'short_description', locale)
  const images = [experience.hero_image, ...experience.gallery].filter(Boolean)

  return {
    title,
    description: description || undefined,
    alternates: buildAlternates(`/experiences/${experience.slug}`, locale),
    openGraph: {
      title,
      description: description || undefined,
      type: 'website',
      images: images.length ? images.map((url) => ({ url, alt: title })) : undefined,
    },
  }
}

export default async function ExperienceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params
  const [experience, categories, settings, t] = await Promise.all([
    getExperienceBySlug(slug),
    getExperienceCategories(),
    getSiteSettings(),
    getTranslations({ locale, namespace: 'experiences' }),
  ])
  if (!experience) notFound()

  const title = localized(experience, 'title', locale)
  const shortDescription = localized(experience, 'short_description', locale)
  const fullDescription = localized(experience, 'full_description', locale)
  const partnerDescription = localized(experience, 'partner_description', locale)
  const included = localizedList(experience, 'included', locale)
  const notIncluded = localizedList(experience, 'not_included', locale)
  const next = nextAvailableDate(experience.dates)
  const duration = formatDuration(experience, next, locale)
  const hero = experience.hero_image || experience.gallery[0] || '/media/heroposter.png'
  const gallery = experience.gallery.filter(Boolean)
  const whatsapp = settings?.whatsapp_number || WHATSAPP_NUMBER
  const price = next?.price_override ?? experience.price

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: title,
    ...(shortDescription ? { description: shortDescription } : {}),
    ...(hero ? { image: [hero, ...gallery] } : {}),
    url: `${SITE_URL}${locale === 'en' ? '/en' : ''}/experiences/${experience.slug}`,
    offers: {
      '@type': 'Offer',
      price: experience.price,
      priceCurrency: experience.currency,
      availability: next?.is_bookable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
    },
    provider: {
      '@type': 'Organization',
      name: settings?.organization_name || 'WEEMAP SINAI',
      url: SITE_URL,
    },
  }

  return (
    <article className="bg-sand-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Hero */}
      <header className="relative min-h-[60vh] overflow-hidden bg-sea-900 text-white">
        <Image src={hero} alt={title} fill sizes="100vw" priority className="object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900 via-sea-900/60 to-sea-900/30" />
        <div className="container-main relative z-10 flex min-h-[60vh] flex-col justify-end pb-14 pt-24">
          <Link
            href="/experiences"
            className="mb-6 inline-flex w-fit items-center gap-2 text-sm text-sand-200/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            {t('backToAll')}
          </Link>
          <span className="mb-4 inline-flex w-fit rounded-full bg-sun-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
            {categoryLabel(experience.category, categories, locale)}
          </span>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>
          {shortDescription && (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sand-100/85">{shortDescription}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-sand-100/80">
            {duration && (
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-sun-300" aria-hidden="true" />
                {duration}
              </span>
            )}
            {experience.partner_name && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-sun-300" aria-hidden="true" />
                {t('withPartner', { partner: experience.partner_name })}
              </span>
            )}
            <span className="font-display text-lg font-bold text-white">
              {formatPrice(price, experience.currency, locale)}{' '}
              <span className="text-sm font-normal text-sand-100/70">{t('perPersonInline')}</span>
            </span>
          </div>
        </div>
      </header>

      <div className="container-main grid gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-14">
          {fullDescription && (
            <section>
              <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('aboutThis')}</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-sea-900/80">
                {fullDescription}
              </p>
            </section>
          )}

          {experience.partner_name && (
            <section className="rounded-2xl border border-sand-200 bg-white p-6">
              <p className="text-[11px] uppercase tracking-wider text-sun-600">{t('partner')}</p>
              <h2 className="mt-1 font-display text-xl font-bold text-sea-900">{experience.partner_name}</h2>
              {partnerDescription && (
                <p className="mt-3 text-sm leading-7 text-sea-900/75">{partnerDescription}</p>
              )}
            </section>
          )}

          {experience.itinerary.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('itinerary')}</h2>
              <div className="mt-5">
                <ItineraryAccordion days={experience.itinerary} />
              </div>
            </section>
          )}

          {(included.length > 0 || notIncluded.length > 0) && (
            <section>
              <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('whatsIncluded')}</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {included.length > 0 && (
                  <div className="rounded-2xl border border-sand-200 bg-white p-5">
                    <h3 className="mb-3 font-display text-base font-semibold text-sea-900">
                      {t('included')}
                    </h3>
                    <ul className="space-y-2.5">
                      {included.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-6 text-sea-900/80">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {notIncluded.length > 0 && (
                  <div className="rounded-2xl border border-sand-200 bg-white p-5">
                    <h3 className="mb-3 font-display text-base font-semibold text-sea-900">
                      {t('notIncluded')}
                    </h3>
                    <ul className="space-y-2.5">
                      {notIncluded.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-6 text-sea-900/70">
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('gallery')}</h2>
              <div className="mt-5">
                <ExperienceGallery images={gallery} title={title} />
              </div>
            </section>
          )}

          {/* Dates live in the sidebar on desktop; inline here on mobile. */}
          <section className="lg:hidden">
            <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('availableDates')}</h2>
            <div className="mt-5">
              <ExperienceDates
                dates={experience.dates}
                experienceTitle={title}
                price={experience.price}
                currency={experience.currency}
                whatsappNumber={whatsapp}
              />
            </div>
          </section>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <div className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-sea-900">{t('availableDates')}</h2>
            <p className="mt-1 text-xs text-sea-900/60">{t('datesHint')}</p>
            <div className="mt-5">
              <ExperienceDates
                dates={experience.dates}
                experienceTitle={title}
                price={experience.price}
                currency={experience.currency}
                whatsappNumber={whatsapp}
              />
            </div>
          </div>
        </aside>
      </div>
    </article>
  )
}
