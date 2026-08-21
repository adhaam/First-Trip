import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { ProductDetailClient } from '@/components/commerce/ProductDetailClient'
import { getCommerceProductBySlug } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const product = await getCommerceProductBySlug(slug)
  if (!product || product.product_type !== 'sale') return {}
  const title = product.seo_title || (locale === 'ar' ? product.name_ar : product.name_en)
  const description =
    (locale === 'ar' ? product.seo_description_ar : product.seo_description_en) ||
    (locale === 'ar' ? product.description_ar : product.description_en) ||
    title
  return {
    title,
    description,
    alternates: buildAlternates(`/merch/${slug}`, locale),
    openGraph: { title, description, images: product.images?.[0] ? [{ url: product.images[0] }] : undefined },
  }
}

export default async function MerchProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const product = await getCommerceProductBySlug(slug)
  if (!product || product.product_type !== 'sale') notFound()

  const variants = product.commerce_product_variants || []
  const inStock = !product.track_inventory || variants.length === 0 || variants.some((v) => v.inventory_quantity > 0)
  const price = variants.length
    ? Math.min(...variants.map((v) => (v.price_override != null ? Number(v.price_override) : Number(product.base_price))))
    : Number(product.base_price)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: locale === 'ar' ? product.name_ar : product.name_en,
    description: (locale === 'ar' ? product.description_ar : product.description_en) || undefined,
    image: product.images?.length ? product.images : undefined,
    sku: product.sku || undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/merch/${slug}`,
      priceCurrency: 'EGP',
      price,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailClient product={product} />
    </>
  )
}
