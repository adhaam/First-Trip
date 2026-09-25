import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getPathname } from '@/i18n/navigation'
import { RentalDetailClient } from '@/components/commerce/RentalDetailClient'
import { getCommerceProductBySlug, getDeliveryZones } from '@/lib/data'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { getCommerceProductSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'

// Admin-activated inventory must appear with no redeploy: matches the
// revalidate window used by /book-dahab/[id] and /sinai-trips/[slug].
export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const product = await getCommerceProductBySlug(slug)
  if (!product || product.product_type !== 'rental') return {}
  const title = product.seo_title || (locale === 'ar' ? product.name_ar : product.name_en)
  const description =
    (locale === 'ar' ? product.seo_description_ar : product.seo_description_en) ||
    (locale === 'ar' ? product.description_ar : product.description_en) ||
    title
  return {
    title,
    description,
    alternates: buildAlternates(`/rent/${slug}`, locale),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${getPathname({ href: `/rent/${slug}`, locale })}`,
      images: product.images?.[0] ? [{ url: product.images[0] }] : undefined,
    },
  }
}

export default async function RentalProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const [product, deliveryZones, paymentRules] = await Promise.all([
    getCommerceProductBySlug(slug),
    getDeliveryZones(),
    getPaymentRules(),
  ])
  if (!product || product.product_type !== 'rental') notFound()

  const variants = product.commerce_product_variants || []
  // "In stock" for a rental means available for booking, not sold-out
  // inventory — matches the fixture logic RentalDetailClient already uses
  // ("unavailable for these dates" at zero remaining).
  const available = !product.track_inventory || variants.length === 0 || variants.some((v) => v.inventory_quantity > 0)
  const price = variants.length
    ? Math.min(...variants.map((v) => (v.price_override != null ? Number(v.price_override) : Number(product.base_price))))
    : Number(product.base_price)
  const name = locale === 'ar' ? product.name_ar : product.name_en
  const description = (locale === 'ar' ? product.description_ar : product.description_en) || undefined

  const schema = getCommerceProductSchema({
    name,
    description: description || name,
    url: `${SITE_URL}/rent/${slug}`,
    image: product.images?.[0] || null,
    sku: product.sku,
    price,
    availability: available ? 'InStock' : 'OutOfStock',
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
      <RentalDetailClient product={product} deliveryZones={deliveryZones} paymentPolicies={paymentRules.policies} />
    </>
  )
}
