import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import { RentClient } from '@/components/RentClient'
import { getCommerceCategories, getCommerceProducts, getSiteSettings } from '@/lib/data'

// Admin-activated inventory must appear with no redeploy: matches the
// revalidate window used by /book-dahab and /sinai-trips.
export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'shopV2' })
  return pageMetadata({ locale, path: '/rent', title: t('rentTitle'), description: t('rentLede') })
}

export default async function RentPage() {
  const [products, categories, settings] = await Promise.all([
    getCommerceProducts('rental'),
    getCommerceCategories(),
    getSiteSettings(),
  ])
  return <RentClient products={products} categories={categories} whatsapp={settings?.whatsapp_number} />
}
