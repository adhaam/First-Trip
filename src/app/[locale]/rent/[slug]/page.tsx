import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildAlternates } from '@/lib/seo'
import { RentalDetailClient } from '@/components/commerce/RentalDetailClient'
import { getCommerceProductBySlug, getDeliveryZones } from '@/lib/data'

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
    openGraph: { title, description, images: product.images?.[0] ? [{ url: product.images[0] }] : undefined },
  }
}

export default async function RentalProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params
  const [product, deliveryZones] = await Promise.all([getCommerceProductBySlug(slug), getDeliveryZones()])
  if (!product || product.product_type !== 'rental') notFound()
  return <RentalDetailClient product={product} deliveryZones={deliveryZones} />
}
