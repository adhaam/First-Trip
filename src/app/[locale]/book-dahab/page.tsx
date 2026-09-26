import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getAccommodations, getSiteSettings } from '@/lib/data'
import { getSitePage } from '@/lib/site-pages'
import { pickCopy } from '@/lib/site-pages-core'
import { BookDahabClient } from '@/components/BookDahabClient'
import { PageHero } from '@/components/brand/PageHero'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { Section, SectionHeading } from '@/components/brand/Section'
import { ButtonLink } from '@/components/ButtonLink'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getCollectionPageSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'
import { getPathname } from '@/i18n/navigation'
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

// Real accommodation type labels (Accommodation['type']) in each locale — the
// same three types the booking form/admin use, never invented copy.
const TYPE_LABELS: Record<'hotel' | 'chalet' | 'camp', { ar: string; en: string }> = {
  hotel: { ar: 'فنادق', en: 'hotels' },
  chalet: { ar: 'شاليهات', en: 'chalets' },
  camp: { ar: 'كمبات', en: 'camps' },
}

export default async function BookDahabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, tDiscovery] = await Promise.all([
    getTranslations({ locale, namespace: 'stays' }),
    getTranslations({ locale, namespace: 'discovery' }),
  ])
  const [accommodations, settings, sitePage] = await Promise.all([
    getAccommodations(),
    getSiteSettings(),
    getSitePage('stay'),
  ])
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  // Owner-controlled hero (Website admin) — never a catalogue[0] cascade.
  const heroImage = sitePage?.hero_image_url || '/media/heroposter.webp'
  const heroEyebrow = pickCopy(
    locale,
    { en: sitePage?.eyebrow_en, ar: sitePage?.eyebrow_ar },
    t('hero.eyebrow'),
  )
  const heroTitle = pickCopy(locale, { en: sitePage?.title_en, ar: sitePage?.title_ar }, t('hero.title'))
  const heroBody = pickCopy(locale, { en: sitePage?.body_en, ar: sitePage?.body_ar }, t('hero.lede'))
  const ar = locale === 'ar'
  const pageUrl = `${SITE_URL}${getPathname({ href: '/book-dahab', locale })}`
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: t('hero.title'), url: pageUrl },
  ])
  const collectionSchema = getCollectionPageSchema({
    name: t('hero.title'),
    description: t('hero.lede'),
    url: pageUrl,
    items: accommodations.map((acc) => ({
      name: ar ? acc.name_ar || acc.name_en : acc.name_en || acc.name_ar,
      url: `${SITE_URL}${getPathname({ href: `/book-dahab/${acc.id}`, locale })}`,
    })),
  })

  // Real accommodation types actually present in the loaded catalogue.
  const presentTypes = [...new Set(accommodations.map((acc) => acc.type))]
  const typeNames = presentTypes.map((type) => TYPE_LABELS[type][ar ? 'ar' : 'en'])
  const geoIntro = tDiscovery('geoIntro.bookDahab', {
    count: accommodations.length,
    types: typeNames.join(ar ? '، ' : ', '),
  })

  return (
    <div className="bg-sand-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
      <PageHero
        image={heroImage}
        eyebrow={<Eyebrow coords={DAHAB_COORDS}>{heroEyebrow}</Eyebrow>}
        title={heroTitle}
        lede={heroBody}
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
        {typeNames.length > 0 && (
          <p className="max-w-2xl text-base leading-relaxed text-ink-muted">{geoIntro}</p>
        )}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-muted">{t('intro.body')}</p>
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
