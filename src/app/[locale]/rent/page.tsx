import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getCollectionPageSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'
import { getPathname } from '@/i18n/navigation'
import { RentClient } from '@/components/RentClient'
import { getCommerceCategories, getCommerceProducts, getSiteSettings } from '@/lib/data'
import { getSitePage } from '@/lib/site-pages'
import { pickCopy } from '@/lib/site-pages-core'

// Admin-activated inventory must appear with no redeploy: matches the
// revalidate window used by /book-dahab and /sinai-trips.
export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'shopV2' })
  const tMeta = await getTranslations({ locale, namespace: 'discovery' })
  return pageMetadata({ locale, path: '/rent', title: tMeta('metaTitles.rent'), description: t('rentLede') })
}

export default async function RentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [products, categories, settings, t, sitePage] = await Promise.all([
    getCommerceProducts('rental'),
    getCommerceCategories(),
    getSiteSettings(),
    getTranslations({ locale, namespace: 'shopV2' }),
    getSitePage('rent'),
  ])
  const ar = locale === 'ar'
  const heroEyebrow = pickCopy(
    locale,
    { en: sitePage?.eyebrow_en, ar: sitePage?.eyebrow_ar },
    t('rentEyebrow'),
  )
  const heroTitle = pickCopy(locale, { en: sitePage?.title_en, ar: sitePage?.title_ar }, t('rentTitle'))
  const heroBody = pickCopy(locale, { en: sitePage?.body_en, ar: sitePage?.body_ar }, t('rentLede'))
  const pageUrl = `${SITE_URL}${getPathname({ href: '/rent', locale })}`
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: t('rentTitle'), url: pageUrl },
  ])
  const collectionSchema = getCollectionPageSchema({
    name: t('rentTitle'),
    description: t('rentLede'),
    url: pageUrl,
    items: products.map((product) => ({
      name: ar ? product.name_ar || product.name_en : product.name_en || product.name_ar,
      url: `${SITE_URL}${getPathname({ href: `/rent/${product.slug}`, locale })}`,
    })),
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
      <RentClient
        products={products}
        categories={categories}
        whatsapp={settings?.whatsapp_number}
        heroImage={sitePage?.hero_image_url || undefined}
        heroEyebrow={heroEyebrow}
        heroTitle={heroTitle}
        heroBody={heroBody}
      />
    </>
  )
}
