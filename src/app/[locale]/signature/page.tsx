import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link, getPathname } from '@/i18n/navigation'
import { getExperienceCategories, getExperiences } from '@/lib/experiences'
import { SignatureClient } from '@/components/SignatureClient'
import { Eyebrow, Section, SectionHeading } from '@/components/brand'
import { Reveal } from '@/components/motion/Reveal'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getCollectionPageSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signatureV2' })
  return pageMetadata({ locale, path: '/signature', title: t('title'), description: t('subtitle') })
}

export default async function SignaturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signatureV2' })
  const [categories, experiences] = await Promise.all([getExperienceCategories(), getExperiences()])
  const heroImage = experiences.find((e) => e.hero_image)?.hero_image || experiences[0]?.gallery?.[0]
  const ar = locale === 'ar'
  const pageUrl = `${SITE_URL}${getPathname({ href: '/signature', locale })}`
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: t('title'), url: pageUrl },
  ])
  const collectionSchema = getCollectionPageSchema({
    name: t('title'),
    description: t('subtitle'),
    url: pageUrl,
    items: experiences.map((exp) => ({
      name: ar ? exp.title_ar || exp.title_en : exp.title_en || exp.title_ar,
      url: `${SITE_URL}${getPathname({ href: `/signature/${exp.slug}`, locale })}`,
    })),
  })

  return (
    <div className="bg-sand-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
      {/*
        Hand-rolled instead of the shared <PageHero> primitive: PageHero's
        default scrim (from-sea-900/92 via-sea-900/40) leaves the mid/upper
        area too bright against a light photo (tent/forest-type shots) for
        the headline to clear 4.5:1 reliably. PageHero is a shared primitive
        (src/components/brand/PageHero.tsx, not owned by this surface), so
        rather than fork it, this hero is built directly with a much
        stronger, guaranteed-opaque bottom scrim where the text actually
        sits (align="start" / items-end) while still showing the photo
        higher up, where there's no text over it — still cinematic, but
        contrast no longer depends on how bright the source photo is.
      */}
      <section className="relative isolate flex min-h-[72vh] items-end overflow-hidden bg-sea-900 text-sand-50 sm:min-h-[78vh]">
        {heroImage && (
          <Image src={heroImage} alt="" fill priority sizes="100vw" className="absolute inset-0 object-cover" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-sea-900 from-15% via-sea-900/75 via-55% to-sea-900/25"
        />
        <div aria-hidden className="topo-bg absolute inset-0 opacity-25 mix-blend-overlay" />

        <div className="container-main relative py-12 sm:py-16 md:py-20">
          <Reveal always className="max-w-2xl">
            <Eyebrow tone="light">{t('eyebrow')}</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">{t('subtitle')}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">{t('body')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#experiences"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-sun-500 px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600"
              >
                {t('primaryCta')}
                <ArrowForward className="h-4 w-4" />
              </Link>
              <Link
                href="/signature/build"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t('secondaryCta')}
                <ArrowForward className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Section tone="paper" size="lg" id="experiences">
        <SectionHeading eyebrow={t('categoriesLabel')} title={t('primaryCta')} />
        <SignatureClient categories={categories} experiences={experiences} />
      </Section>

      <Section tone="night" size="md">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="light">{t('invitationEyebrow')}</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
            <span className="brush-underline">{t('invitationTitle')}</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-sea-100/80 sm:text-lg">{t('invitationBody')}</p>
          <Link
            href="/signature/build"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-sun-500 px-7 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600"
          >
            {t('invitationCta')}
            <ArrowForward className="h-4 w-4" />
          </Link>
        </div>
      </Section>
    </div>
  )
}
