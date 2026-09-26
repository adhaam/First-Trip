import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { getPublicEditionBySlug } from '@/lib/editions-data'
import { ctaIntentFor, paymentSchedule, sortedProgram } from '@/lib/editions'
import { NEUTRAL_MEDIA } from '@/lib/media'
import { ArrowBack } from '@/components/brand/DirectionalIcon'
import { EditionStatusBadge } from '@/components/editions/EditionStatusBadge'
import { EditionPartnerLine } from '@/components/editions/EditionPartnerLine'
import { EditionProgram } from '@/components/editions/EditionProgram'
import { EditionPayment } from '@/components/editions/EditionPayment'
import { EditionRequestForm } from '@/components/editions/EditionRequestForm'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 60

type PageProps = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const edition = await getPublicEditionBySlug(slug)
  if (!edition) return {}
  const ar = locale === 'ar'
  const title = ar ? edition.title_ar : edition.title_en
  const description = (ar ? edition.short_description_ar : edition.short_description_en) || undefined
  return pageMetadata({
    locale, path: `/editions/${edition.slug}`, title, description: description || title,
    image: edition.hero_image_url,
  })
}

export default async function EditionDetailPage({ params }: PageProps) {
  const { locale, slug } = await params
  const edition = await getPublicEditionBySlug(slug)
  if (!edition) notFound()

  const isAr = locale === 'ar'
  const t = await getTranslations({ locale, namespace: 'editions' })
  const title = isAr ? edition.title_ar : edition.title_en
  const shortDescription = isAr ? edition.short_description_ar : edition.short_description_en
  const fullDescription = isAr ? edition.full_description_ar : edition.full_description_en
  const whoFor = isAr ? edition.who_for_ar : edition.who_for_en
  const level = isAr ? edition.level_ar : edition.level_en
  const stay = isAr ? edition.stay_ar : edition.stay_en
  const goodToKnow = isAr ? edition.good_to_know_ar : edition.good_to_know_en
  const program = sortedProgram(edition)
  const payment = paymentSchedule(edition)
  const intent = ctaIntentFor(edition.status)

  return (
    <article className="bg-sand-50">
      <header className="relative isolate min-h-[48svh] overflow-hidden bg-sea-900 text-white">
        <Image
          src={edition.hero_image_url || NEUTRAL_MEDIA}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-sea-900/92 via-sea-900/45 to-sea-900/15" />
        <div className="container-main flex min-h-[48svh] flex-col justify-end pb-10 pt-24">
          <Link
            href="/editions"
            className={[
              'mb-6 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold',
              'text-white/80 hover:text-white',
            ].join(' ')}
          >
            <ArrowBack className="h-4 w-4" />
            {t('landing.upcomingTitle')}
          </Link>
          <EditionStatusBadge status={edition.status} />
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {title}
          </h1>
          {shortDescription && <p className="mt-4 max-w-2xl text-lg leading-8 text-white/85">{shortDescription}</p>}
        </div>
      </header>

      <div className="container-main grid gap-10 py-12 lg:grid-cols-[1fr_20rem] lg:gap-16 md:py-16">
        <div className="space-y-10">
          {fullDescription && (
            <section aria-labelledby="edition-why-heading">
              <h2 id="edition-why-heading" className="font-display text-2xl font-bold text-sea-900">
                {t('detail.whyThisEdition')}
              </h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink-muted">{fullDescription}</p>
            </section>
          )}

          {program.length > 0 && (
            <section aria-labelledby="edition-program-heading">
              <h2 id="edition-program-heading" className="font-display text-2xl font-bold text-sea-900">
                {t('detail.theProgram')}
              </h2>
              <div className="mt-5">
                <EditionProgram program={program} locale={isAr ? 'ar' : 'en'} />
              </div>
            </section>
          )}

          {(edition.includes.length > 0 || edition.excludes.length > 0) && (
            <section aria-labelledby="edition-inclusions-heading" className="grid gap-8 sm:grid-cols-2">
              {edition.includes.length > 0 && (
                <div>
                  <h2 id="edition-inclusions-heading" className="font-display text-xl font-bold text-sea-900">
                    {t('detail.whatsIncluded')}
                  </h2>
                  <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
                    {edition.includes.map((item, index) => (
                      <li key={index}>{isAr ? item.ar : item.en}</li>
                    ))}
                  </ul>
                </div>
              )}
              {edition.excludes.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-bold text-sea-900">{t('detail.whatsNotIncluded')}</h2>
                  <ul className="mt-4 space-y-2.5 text-sm text-ink-muted">
                    {edition.excludes.map((item, index) => (
                      <li key={index}>{isAr ? item.ar : item.en}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {(whoFor || level || stay) && (
            <section aria-labelledby="edition-who-heading" className="grid gap-6 sm:grid-cols-3">
              {whoFor && (
                <div>
                  <h2 id="edition-who-heading" className="text-sm font-semibold text-sea-900">
                    {t('detail.whoItsFor')}
                  </h2>
                  <p className="mt-2 text-sm text-ink-muted">{whoFor}</p>
                </div>
              )}
              {level && (
                <div>
                  <h2 className="text-sm font-semibold text-sea-900">{t('detail.level')}</h2>
                  <p className="mt-2 text-sm text-ink-muted">{level}</p>
                </div>
              )}
              {stay && (
                <div>
                  <h2 className="text-sm font-semibold text-sea-900">{t('detail.stay')}</h2>
                  <p className="mt-2 text-sm text-ink-muted">{stay}</p>
                </div>
              )}
            </section>
          )}

          {payment && (
            <section aria-labelledby="edition-payment-heading">
              <h2 id="edition-payment-heading" className="font-display text-xl font-bold text-sea-900">
                {t('detail.priceAndPayment')}
              </h2>
              <div className="mt-4">
                <EditionPayment payment={payment} />
              </div>
            </section>
          )}

          {goodToKnow && (
            <section aria-labelledby="edition-good-to-know-heading">
              <h2 id="edition-good-to-know-heading" className="font-display text-xl font-bold text-sea-900">
                {t('detail.goodToKnow')}
              </h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{goodToKnow}</p>
            </section>
          )}

          <EditionPartnerLine edition={edition} locale={locale} />
        </div>

        {intent && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-sea-900">
                {intent === 'ASK' ? t('detail.askEdition') : t('detail.joinEdition')}
              </h2>
              <div className="mt-4">
                <EditionRequestForm editionId={edition.id} intent={intent} locale={isAr ? 'ar' : 'en'} />
              </div>
            </div>
          </aside>
        )}
      </div>
    </article>
  )
}
