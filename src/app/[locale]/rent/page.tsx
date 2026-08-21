import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { RentClient } from '@/components/RentClient'
import { getCommerceCategories, getCommerceProducts } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'commerce' })
  return {
    title: t('rentHeroTitle'),
    description: t('rentHeroSubtitle'),
    alternates: buildAlternates('/rent', locale),
  }
}

export default async function RentPage() {
  const [products, categories] = await Promise.all([getCommerceProducts('rental'), getCommerceCategories()])
  return <RentClient products={products} categories={categories} />
}
