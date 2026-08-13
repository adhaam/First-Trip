import { getAccommodationById, getAccommodations, getRelatedAccommodations, getSiteSettings, getTransferPricing } from '@/lib/data'
import { ProductDetailClient } from '@/components/ProductDetailClient'
import { RelatedPlaces } from '@/components/RelatedPlaces'
import { ButtonLink } from '@/components/ButtonLink'

export const revalidate = 60

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const accommodation = await getAccommodationById(id)

  if (!accommodation) {
    return (
      <div className="container-main py-24 text-center">
        <h2 className="font-display text-2xl font-bold text-sea-900 mb-4">
          {locale === 'ar' ? 'غير موجود' : 'Not Found'}
        </h2>
        <ButtonLink href="/book-dahab" variant="ink">
          {locale === 'ar' ? 'رجوع' : 'Go Back'}
        </ButtonLink>
      </div>
    )
  }

  const [all, pricing, settings] = await Promise.all([
    getAccommodations(),
    getTransferPricing(),
    getSiteSettings(),
  ])
  const related = getRelatedAccommodations(accommodation, all)

  return (
    <div>
      <ProductDetailClient
        accommodation={accommodation}
        pricing={pricing}
        whatsapp={settings?.whatsapp_number}
      />
      <RelatedPlaces related={related} />
    </div>
  )
}
