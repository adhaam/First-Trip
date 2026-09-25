import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getAccommodations, getSiteSettings } from '@/lib/data'
import { BookDahabClient } from '@/components/BookDahabClient'
import { PageHero } from '@/components/brand/PageHero'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { Section, SectionHeading } from '@/components/brand/Section'
import { ButtonLink } from '@/components/ButtonLink'
import { pageMetadata } from '@/lib/seo'
import { WHATSAPP_NUMBER } from '@/lib/constants'

export const revalidate = 60

// Real, fixed coordinates for Dahab, South Sinai — used as the hero's map-motif
// kicker (see "Map motif" in docs/m2/BRIEF.md: coordinates must be real, never invented).
const DAHAB_COORDS = '28.49°N · 34.51°E'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'stays' })
  return pageMetadata({
    locale,
    path: '/book-dahab',
    title: t('meta.title'),
    description: t('meta.description'),
  })
}

export default async function BookDahabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'stays' })
  const [accommodations, settings] = await Promise.all([
    getAccommodations(),
    getSiteSettings(),
  ])
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const heroImage = accommodations[0]?.image_url || accommodations[0]?.images?.[0] || '/media/heroposter.webp'

  return (
    <div className="bg-sand-50">
      <PageHero
        image={heroImage}
        eyebrow={<Eyebrow coords={DAHAB_COORDS}>{t('hero.eyebrow')}</Eyebrow>}
        title={t('hero.title')}
        lede={t('hero.lede')}
        actions={
          <>
            <ButtonLink href="/plan" variant="sun" size="lg">
              {t('intro.cta')}
            </ButtonLink>
            <ButtonLink href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" variant="outline-light" size="lg">
              {t('list.curatingAction')}
            </ButtonLink>
          </>
        }
      />

      <Section tone="paper" size="sm">
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">{t('intro.body')}</p>
      </Section>

      <Section tone="sand">
        <SectionHeading eyebrow={t('hero.eyebrow')} title={t('list.title')} />
        <BookDahabClient accommodations={accommodations} whatsapp={settings?.whatsapp_number} />
      </Section>

      <section className="relative overflow-hidden bg-sun-400 py-16 text-center text-on-accent">
        <div className="container-main relative">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{t('list.finalCtaTitle')}</h2>
          <p className="mx-auto mt-2 max-w-lg text-on-accent/85">{t('list.finalCtaBody')}</p>
          <ButtonLink href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" variant="ink" size="lg" className="mt-6">
            {t('list.finalCtaAction')}
          </ButtonLink>
        </div>
      </section>
    </div>
  )
}
