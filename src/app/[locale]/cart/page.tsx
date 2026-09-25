import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import { CartCheckoutClient } from '@/components/commerce/CartCheckoutClient'
import { getDeliveryZones, getSiteSettings } from '@/lib/data'
import { getPaymentRules } from '@/lib/payment-rules-load'

// Delivery zones/whatsapp number change rarely; matches the window other
// public commerce pages use so admin edits reach /cart without a redeploy.
export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'shopV2' })
  return pageMetadata({
    locale,
    path: '/cart',
    title: t('cartTitle'),
    description: t('checkoutSubtitle'),
    robots: { index: false, follow: false },
  })
}

export default async function CartPage() {
  const [deliveryZones, settings, paymentRules] = await Promise.all([
    getDeliveryZones(),
    getSiteSettings(),
    getPaymentRules(),
  ])
  return <CartCheckoutClient deliveryZones={deliveryZones} whatsapp={settings?.whatsapp_number} paymentPolicies={paymentRules.policies} />
}
