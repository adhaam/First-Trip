import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getCollectionPageSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'
import { getPathname } from '@/i18n/navigation'
import { MerchClient } from '@/components/MerchClient'
import { getCommerceCategories, getCommerceCollections, getCommerceProducts, getSiteSettings } from '@/lib/data'

// Admin-activated inventory must appear with no redeploy: matches the
// revalidate window used by /book-dahab and /sinai-trips.
export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'shopV2' })
  const tMeta = await getTranslations({ locale, namespace: 'discovery' })
  return pageMetadata({ locale, path: '/merch', title: tMeta('metaTitles.merch'), description: t('merchLede') })
}

export default async function MerchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [products, categories, settings, t] = await Promise.all([
    getCommerceProducts('sale'),
    getCommerceCategories(),
    getSiteSettings(),
    getTranslations({ locale, namespace: 'shopV2' }),
  ])
  const productIds = new Set(products.map((p) => p.id))
  const collections = await getCommerceCollections(productIds)
  const ar = locale === 'ar'
  const pageUrl = `${SITE_URL}${getPathname({ href: '/merch', locale })}`
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: ar ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: t('merchTitle'), url: pageUrl },
  ])
  const collectionSchema = getCollectionPageSchema({
    name: t('merchTitle'),
    description: t('merchLede'),
    url: pageUrl,
    items: products.map((product) => ({
      name: ar ? product.name_ar || product.name_en : product.name_en || product.name_ar,
      url: `${SITE_URL}${getPathname({ href: `/merch/${product.slug}`, locale })}`,
    })),
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
      <MerchClient products={products} categories={categories} collections={collections} whatsapp={settings?.whatsapp_number} />
    </>
  )
}
