import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getExperienceCategories, getExperiences } from '@/lib/experiences'
import { SignatureClient } from '@/components/SignatureClient'
import { Eyebrow, PageHero, Section, SectionHeading } from '@/components/brand'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signatureV2' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: buildAlternates('/signature', locale),
  }
}

export default async function SignaturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signatureV2' })
  const [categories, experiences] = await Promise.all([getExperienceCategories(), getExperiences()])
  const heroImage = experiences.find((e) => e.hero_image)?.hero_image || experiences[0]?.gallery?.[0]

  return (
    <div className="bg-sand-50">
      <PageHero
        image={heroImage}
        tone="night"
        size="lg"
        eyebrow={<Eyebrow tone="light">{t('eyebrow')}</Eyebrow>}
        title={t('title')}
        lede={
          <>
            {t('subtitle')}
            <span className="mt-2 block text-white/70">{t('body')}</span>
          </>
        }
        actions={
          <>
            <Link
              href="#experiences"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-sun-500 px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600"
            >
              {t('primaryCta')}
              <ArrowForward className="h-4 w-4" />
            </Link>
            <Link
              href="/signature/build"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t('secondaryCta')}
              <ArrowForward className="h-4 w-4" />
            </Link>
          </>
        }
      />

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
