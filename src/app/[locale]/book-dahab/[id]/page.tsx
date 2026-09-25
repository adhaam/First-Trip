import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getAccommodationById,
  getAccommodations,
  getCommunityPosts,
  getRelatedAccommodations,
  getSinaiTrips,
  getSiteSettings,
} from '@/lib/data'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { startingRoomRate } from '@/lib/stays'
import { ProductDetailClient } from '@/components/ProductDetailClient'
import { RelatedPlaces } from '@/components/RelatedPlaces'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getProductSchema } from '@/lib/schema-org'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ id: string; locale: string }>
}): Promise<Metadata> {
  const { id, locale } = await params
  const acc = await getAccommodationById(id).catch(() => null)
  const alternates = buildAlternates(`/book-dahab/${id}`, locale)
  if (!acc) return { alternates }
  const name = locale === 'ar' ? acc.name_ar || acc.name_en : acc.name_en || acc.name_ar
  return {
    title: name,
    description: locale === 'ar' ? acc.description_ar : acc.description_en,
    alternates,
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const accommodation = await getAccommodationById(id)

  if (!accommodation) {
    notFound()
  }

  const [all, settings, sinaiTrips, communityPosts, paymentRules] = await Promise.all([
    getAccommodations(),
    getSiteSettings(),
    getSinaiTrips(),
    getCommunityPosts(),
    getPaymentRules(),
  ])
  const related = getRelatedAccommodations(accommodation, all)

  const productSchema = getProductSchema({
    name: locale === 'ar' ? accommodation.name_ar || accommodation.name_en : accommodation.name_en || accommodation.name_ar,
    description: locale === 'ar' ? accommodation.description_ar : accommodation.description_en,
    image: accommodation.image_url || accommodation.images?.[0] || `${SITE_URL}/brand/logo.png`,
    price: startingRoomRate(accommodation),
  })

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
      />
      <ProductDetailClient
        accommodation={accommodation}
        whatsapp={settings?.whatsapp_number}
        sinaiTrips={sinaiTrips}
        communityPosts={communityPosts}
        policies={paymentRules.policies}
      />
      <RelatedPlaces related={related} />
    </div>
  )
}
