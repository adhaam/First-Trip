import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
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
  return {
    title: t('merchTitle'),
    description: t('merchLede'),
    alternates: buildAlternates('/merch', locale),
  }
}

export default async function MerchPage() {
  const [products, categories, settings] = await Promise.all([
    getCommerceProducts('sale'),
    getCommerceCategories(),
    getSiteSettings(),
  ])
  const productIds = new Set(products.map((p) => p.id))
  const collections = await getCommerceCollections(productIds)
  return <MerchClient products={products} categories={categories} collections={collections} whatsapp={settings?.whatsapp_number} />
}
