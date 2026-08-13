import { getAccommodationById, getAccommodations, getRelatedAccommodations } from '@/lib/data'
import { ProductDetailClient } from '@/components/ProductDetailClient'
import { RelatedPlaces } from '@/components/RelatedPlaces'
import { ButtonLink } from '@/components/ButtonLink'

export const revalidate = 60

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const accommodation = await getAccommodationById(id)

  if (!accommodation) {
    return (
      <div className="container-main py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">
          {locale === 'ar' ? 'غير موجود' : 'Not Found'}
        </h2>
        <ButtonLink href="/book-dahab">{locale === 'ar' ? 'رجوع' : 'Go Back'}</ButtonLink>
      </div>
    )
  }

  const all = await getAccommodations()
  const related = getRelatedAccommodations(accommodation, all)

  return (
    <div>
      <ProductDetailClient accommodation={accommodation} />
      <RelatedPlaces related={related} />
    </div>
  )
}
