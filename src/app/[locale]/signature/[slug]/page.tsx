import type { Metadata } from 'next'
import { SafeImage as Image } from '@/components/SafeImage'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Check, Clock, Layers3, X } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { getExperienceBySlug } from '@/lib/experiences'
import { discountedExperiencePrice } from '@/lib/experience-pricing'
import { SignatureRequestForm } from '@/components/SignatureRequestForm'
import { buildAlternates, SITE_URL } from '@/lib/seo'

export const revalidate = 60

type PageProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const experience = await getExperienceBySlug(slug)
  if (!experience) return {}

  const ar = locale === 'ar'
  const name = ar ? experience.title_ar : experience.title_en
  const description = (ar ? experience.short_description_ar : experience.short_description_en) || undefined
  const canonicalPath = `/signature/${experience.slug}`

  return {
    title: name,
    description,
    alternates: buildAlternates(canonicalPath, locale),
    openGraph: {
      title: name,
      description,
      type: 'website',
      images: experience.hero_image ? [{ url: experience.hero_image, alt: name }] : undefined,
    },
  }
}

export default async function SignatureExperienceDetailPage({ params }: PageProps) {
  const { locale, slug } = await params
  const experience = await getExperienceBySlug(slug)
  if (!experience) notFound()

  const t = await getTranslations({ locale, namespace: 'signature' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const ar = locale === 'ar'
  const name = ar ? experience.title_ar : experience.title_en
  const shortDescription = (ar ? experience.short_description_ar : experience.short_description_en) || ''
  const fullDescription = (ar ? experience.full_description_ar : experience.full_description_en) || ''
  const duration = (ar ? experience.duration_ar : experience.duration_en) || ''
  const category = ar ? experience.category_info?.label_ar : experience.category_info?.label_en
  const included = (ar ? experience.included_ar : experience.included_en) || []
  const notIncluded = (ar ? experience.not_included_ar : experience.not_included_en) || []
  const itinerary = experience.itinerary || []
  const gallery = (experience.gallery || []).filter(Boolean)
  const cover = experience.hero_image || gallery[0] || '/media/heroposter.webp'
  const price = discountedExperiencePrice(experience)
  const canonicalPath = `/signature/${experience.slug}`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name,
    ...(shortDescription ? { description: shortDescription } : {}),
    ...(experience.hero_image ? { image: [experience.hero_image] } : {}),
    url: `${SITE_URL}${locale === 'en' ? '/en' : ''}${canonicalPath}`,
  }

  return (
    <article className="bg-sand-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />

      <header className="relative isolate min-h-[56svh] overflow-hidden bg-weemap-charcoal text-white">
        <Image src={cover} alt={name} fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
        <div className="container-main flex min-h-[56svh] flex-col justify-end pb-12 pt-28 md:pb-16">
          <Link href="/signature" className="mb-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            {t('backToSignature')}
          </Link>
          {(experience.badge_ar || experience.badge_en) && (
            <p className="eyebrow text-weemap-orange">{ar ? experience.badge_ar : experience.badge_en}</p>
          )}
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">{name}</h1>
          {shortDescription && <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">{shortDescription}</p>}
        </div>
      </header>

      <div>
        <section className="container-main py-12 md:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
            <div className="space-y-12">
              {gallery.length > 1 && (
                <section aria-labelledby="exp-gallery-heading">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {gallery.slice(1, 7).map((image, index) => (
                      <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden bg-sand-200 pin-card">
                        <Image src={image} alt={`${name} ${index + 2}`} fill sizes="(max-width: 640px) 50vw, 30vw" className="object-cover" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {fullDescription && (
                <section aria-labelledby="exp-overview-heading">
                  <h2 id="exp-overview-heading" className="font-display text-2xl font-bold text-sea-900">{t('overview')}</h2>
                  <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink-muted">{fullDescription}</p>
                </section>
              )}

              {itinerary.length > 0 && (
                <section aria-labelledby="exp-itinerary-heading">
                  <h2 id="exp-itinerary-heading" className="font-display text-2xl font-bold text-sea-900">{t('itinerary')}</h2>
                  <ol className="mt-5 space-y-4">
                    {itinerary.map((step, i) => (
                      <li key={i} className="border-s-2 border-weemap-orange ps-4">
                        <p className="font-semibold text-sea-900">{ar ? step.title_ar : step.title_en}</p>
                        {(ar ? step.description_ar : step.description_en) && (
                          <p className="mt-1 text-sm leading-6 text-ink-muted">{ar ? step.description_ar : step.description_en}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {(included.length > 0 || notIncluded.length > 0) && (
                <section aria-labelledby="exp-inclusions-heading" className="grid gap-8 sm:grid-cols-2">
                  {included.length > 0 && (
                    <div>
                      <h2 id="exp-inclusions-heading" className="font-display text-xl font-bold text-sea-900">{t('included')}</h2>
                      <ul className="mt-4 space-y-2.5">
                        {included.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-ink-muted">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {notIncluded.length > 0 && (
                    <div>
                      <h2 className="font-display text-xl font-bold text-sea-900">{t('notIncluded')}</h2>
                      <ul className="mt-4 space-y-2.5">
                        {notIncluded.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-ink-muted">
                            <X className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {experience.trips && experience.trips.length > 0 && (
                <section aria-labelledby="exp-trips-heading">
                  <h2 id="exp-trips-heading" className="font-display text-xl font-bold text-sea-900">{t('relatedTrips')}</h2>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {experience.trips.map((trip) => (
                      <li key={trip.id} className="rounded-full border border-sand-300 bg-white px-3 py-1.5 text-sm text-ink-muted">
                        {ar ? trip.name_ar : trip.name_en}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {experience.partners && experience.partners.length > 0 && (
                <section aria-labelledby="exp-partners-heading">
                  <h2 id="exp-partners-heading" className="font-display text-xl font-bold text-sea-900">
                    {ar ? 'بالتعاون مع' : 'In partnership with'}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {experience.partners.map((partner) => (
                      <div key={partner.id} className="rounded-xl border border-sand-300 bg-white p-4">
                        <p className="font-semibold text-sea-900">{partner.name}</p>
                        {(ar ? partner.public_description_ar : partner.public_description_en) && (
                          <p className="mt-1 text-sm text-ink-muted">{ar ? partner.public_description_ar : partner.public_description_en}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="h-fit border border-sand-300 bg-card p-6 lg:sticky lg:top-24">
              {(duration || category) && (
                <dl className="divide-y divide-sand-300 border-y border-sand-300">
                  {duration && (
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-ink-muted"><Clock className="h-4 w-4" aria-hidden="true" />{t('duration')}</dt>
                      <dd className="text-sm font-semibold text-sea-900">{duration}</dd>
                    </div>
                  )}
                  {category && (
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-ink-muted"><Layers3 className="h-4 w-4" aria-hidden="true" />{t('category')}</dt>
                      <dd className="text-sm font-semibold text-sea-900">{category}</dd>
                    </div>
                  )}
                </dl>
              )}
              {price > 0 && (
                <p className="mt-4 font-display text-2xl font-extrabold text-sea-900">
                  {experience.starting_from_price && <span className="me-1.5 text-sm font-semibold text-ink-muted">{t('startingFrom')}</span>}
                  {price.toLocaleString(ar ? 'ar-EG' : 'en-US')} <span className="text-base font-semibold text-ink-muted">{common('egp')}</span>
                </p>
              )}
              <div className="mt-6 border-t border-sand-200 pt-6">
                <SignatureRequestForm experienceId={experience.id} />
              </div>
            </aside>
          </div>
        </section>
      </div>
    </article>
  )
}
