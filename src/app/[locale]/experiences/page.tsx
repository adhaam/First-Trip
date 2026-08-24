import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { ExperiencesGrid } from '@/components/experiences/ExperiencesGrid'
import { WaveDivider } from '@/components/brand/Section'
import { getExperienceCategories, getPublishedExperiences } from '@/lib/experiences-data'
import { getSiteSettings } from '@/lib/data'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'experiences' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: buildAlternates('/experiences', locale),
  }
}

export default async function ExperiencesPage({ params }: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, experiences, categories, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'experiences' }),
    getPublishedExperiences(),
    getExperienceCategories(),
    getSiteSettings(),
  ])
  const whatsapp = settings?.whatsapp_number || WHATSAPP_NUMBER

  // Only offer filters that actually have something behind them.
  const usedCategories = new Set(experiences.map((e) => e.category))
  const activeCategories = categories.filter((c) => usedCategories.has(c.slug))
  const heroImage = experiences.find((e) => e.hero_image)?.hero_image || '/media/heroposter.png'

  return (
    <div className="bg-sand-50">
      {/* Editorial hero — deliberately quieter and wider than the tour hero */}
      <section className="relative overflow-hidden bg-sea-900 py-24 text-white md:py-32 grain">
        <div className="absolute inset-0 opacity-30">
          <Image src={heroImage} alt="" fill sizes="100vw" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/70 via-sea-900/80 to-sea-900" />
        </div>
        <div className="container-main relative z-10 max-w-3xl">
          <span className="eyebrow mb-6 text-sun-300">
            <span aria-hidden className="h-px w-8 bg-current" />
            {t('eyebrow')}
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-sand-100/85">
            {t('subtitle')}
          </p>
          <p className="mt-3 max-w-2xl text-sm text-sand-200/60">{t('heroNote')}</p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <ExperiencesGrid
            experiences={experiences}
            categories={activeCategories}
            whatsappNumber={whatsapp}
          />
        </div>
      </section>
    </div>
  )
}
