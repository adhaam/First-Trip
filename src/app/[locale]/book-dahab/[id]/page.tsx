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
import { NEUTRAL_MEDIA } from '@/lib/media'
import { ProductDetailClient } from '@/components/ProductDetailClient'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getBreadcrumbSchema, getLodgingBusinessSchema } from '@/lib/schema-org'
import { jsonLdScript } from '@/lib/safe-html'
import { getCommunityPostsLinkingTarget } from '@/lib/community-links'
import { LocalGuides } from '@/components/community/LocalGuides'
import { getTranslations } from 'next-intl/server'
import { getPathname } from '@/i18n/navigation'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ id: string; locale: string }>
}): Promise<Metadata> {
  const { id, locale } = await params
  const acc = await getAccommodationById(id).catch(() => null)
  const alternates = buildAlternates(`/book-dahab/${id}`, locale)
  // Inactive/missing accommodations 404 in the page body below; metadata for
  // that state stays generic (no invented title/description).
  if (!acc) return { alternates, robots: { index: false, follow: true } }
  const ar = locale === 'ar'
  const name = ar ? acc.name_ar || acc.name_en : acc.name_en || acc.name_ar
  const description = ar ? acc.description_ar : acc.description_en
  // Only the accommodation's own real photo — never stock/other-place
  // imagery. NEUTRAL_MEDIA when it has none of its own.
  const image = acc.image_url || acc.images?.[0] || `${SITE_URL}${NEUTRAL_MEDIA}`
  const pageUrl = `${SITE_URL}${getPathname({ href: `/book-dahab/${id}`, locale })}`
  return {
    title: name,
    description,
    alternates,
    openGraph: {
      title: name,
      description,
      url: pageUrl,
      images: [{ url: image }],
      type: 'website',
      locale: ar ? 'ar_EG' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: [image],
    },
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const accommodation = await getAccommodationById(id)

  if (!accommodation) {
    notFound()
  }

  const [all, settings, sinaiTrips, communityPosts, paymentRules, localGuides] = await Promise.all([
    getAccommodations(),
    getSiteSettings(),
    getSinaiTrips(),
    getCommunityPosts(),
    getPaymentRules(),
    getCommunityPostsLinkingTarget('stay', id),
  ])
  const related = getRelatedAccommodations(accommodation, all)
  const t = await getTranslations({ locale, namespace: 'discovery' })

  const name = locale === 'ar' ? accommodation.name_ar || accommodation.name_en : accommodation.name_en || accommodation.name_ar
  const description = locale === 'ar' ? accommodation.description_ar : accommodation.description_en
  const pageUrl = `${SITE_URL}${getPathname({ href: `/book-dahab/${id}`, locale })}`

  const lodgingSchema = getLodgingBusinessSchema({
    name,
    description,
    url: pageUrl,
    image: accommodation.image_url || accommodation.images?.[0] || null,
    // The only real address field this row carries — never a fabricated
    // street address. Rating is out of scope: `rating` is an editorial
    // 1-5 star value set by the owner, not an AggregateRating from real
    // reviews, so it is deliberately NOT mapped to aggregateRating here.
    address: accommodation.location ? { locality: accommodation.location, country: 'EG' } : null,
  })
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: locale === 'ar' ? 'الرئيسية' : 'Home', url: `${SITE_URL}${getPathname({ href: '/', locale })}` },
    { name: locale === 'ar' ? 'الإقامة في دهب' : 'Stay in Dahab', url: `${SITE_URL}${getPathname({ href: '/book-dahab', locale })}` },
    { name, url: pageUrl },
  ])

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(lodgingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }}
      />
      <ProductDetailClient
        accommodation={accommodation}
        whatsapp={settings?.whatsapp_number}
        sinaiTrips={sinaiTrips}
        communityPosts={communityPosts}
        related={related}
        policies={paymentRules.policies}
      />
      {localGuides.length > 0 && (
        <div className="container-main pb-14">
          <LocalGuides posts={localGuides} locale={locale} heading={t('localGuides.heading')} />
        </div>
      )}
    </div>
  )
}
