import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAccommodationById, getAccommodations, getRelatedAccommodations, getSiteSettings, getTransferPricing, getSinaiTrips } from '@/lib/data'
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

  const [all, pricing, settings, sinaiTrips] = await Promise.all([
    getAccommodations(),
    getTransferPricing(),
    getSiteSettings(),
    getSinaiTrips(),
  ])
  const related = getRelatedAccommodations(accommodation, all)

  const roomRates = [accommodation.price_single_room, accommodation.price_double_room, accommodation.price_triple_room]
    .map(Number)
    .filter((price) => price > 0)
  const startingPrice = roomRates.length ? Math.min(...roomRates) : Number(accommodation.price_per_night) || 0
  const productSchema = getProductSchema({
    name: locale === 'ar' ? accommodation.name_ar || accommodation.name_en : accommodation.name_en || accommodation.name_ar,
    description: locale === 'ar' ? accommodation.description_ar : accommodation.description_en,
    image: accommodation.image_url || accommodation.images?.[0] || `${SITE_URL}/logo.png`,
    price: startingPrice,
  })

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
      />
      <ProductDetailClient
        accommodation={accommodation}
        pricing={pricing}
        whatsapp={settings?.whatsapp_number}
        sinaiTrips={sinaiTrips}
        includedTripIds={settings?.package_included_trip_ids || []}
      />
      <RelatedPlaces related={related} />
    </div>
  )
}
