import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { MerchClient } from '@/components/MerchClient'
import { getCommerceCategories, getCommerceCollections, getCommerceProducts } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'commerce' })
  return {
    title: t('merchHeroTitle'),
    description: t('merchHeroSubtitle'),
    alternates: buildAlternates('/merch', locale),
  }
}

export default async function MerchPage() {
  const [products, categories] = await Promise.all([getCommerceProducts('sale'), getCommerceCategories()])
  const productIds = new Set(products.map((p) => p.id))
  const collections = await getCommerceCollections(productIds)
  return <MerchClient products={products} categories={categories} collections={collections} />
}
