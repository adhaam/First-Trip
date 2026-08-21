import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { CartCheckoutClient } from '@/components/commerce/CartCheckoutClient'
import { getDeliveryZones, getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'commerce' })
  return {
    title: t('cartTitle'),
    robots: { index: false, follow: false },
    alternates: buildAlternates('/cart', locale),
  }
}

export default async function CartPage() {
  const [deliveryZones, settings] = await Promise.all([getDeliveryZones(), getSiteSettings()])
  return <CartCheckoutClient deliveryZones={deliveryZones} whatsapp={settings?.whatsapp_number} />
}
