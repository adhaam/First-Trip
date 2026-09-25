import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { HomeClient } from '@/components/home/HomeClient'
import { pageMetadata } from '@/lib/seo'
import {
  getAccommodations,
  getSinaiTrips,
  getCommunityPosts,
  getSiteSettings,
  getTestimonials,
  getCommerceProducts,
} from '@/lib/data'
import { getTripPackages } from '@/lib/trip-packages'
import { getExperiences } from '@/lib/experiences'
import { getPaymentRules } from '@/lib/payment-rules-load'
import {
  selectCategoryTiles,
  selectCuratedPicks,
  selectHomePackages,
  selectShopRentVisibility,
  selectSignatureImage,
  selectStaysLineup,
} from '@/lib/home-sections'

// Dashboard edits (featured picks, discounts, new packages, new products) must
// show up without a redeploy — a minute-old page is an acceptable trade-off
// for that on a marketing homepage.
export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'discovery' })
  return pageMetadata({
    locale,
    path: '/',
    title: t('pages.home.title'),
    description: t('pages.home.description'),
  })
}

// Server Component: everything the home page shows comes from Supabase and is
// editable from the dashboard. Section-selection decisions (what's curated,
// which packages lead the rail, whether Shop/Rent has real inventory) are
// resolved here with the pure, unit-tested helpers in
// lib/home-sections.ts — the client half only renders what was decided.
export default async function HomePage() {
  const [
    accommodations,
    trips,
    posts,
    settings,
    packages,
    experiences,
    testimonials,
    merchProducts,
    rentalProducts,
    paymentRules,
  ] = await Promise.all([
    getAccommodations(),
    getSinaiTrips(),
    getCommunityPosts(),
    getSiteSettings(),
    getTripPackages(),
    getExperiences(),
    getTestimonials(),
    getCommerceProducts('sale'),
    getCommerceProducts('rental'),
    getPaymentRules(),
  ])

  const curatedPicks = selectCuratedPicks({
    trips,
    packages,
    experiences,
    featuredTripIds: settings?.featured_trip_ids || [],
  })
  const staysLineup = selectStaysLineup(accommodations, settings?.featured_accommodation_ids || [])
  const categoryTiles = selectCategoryTiles(trips)
  const homePackages = selectHomePackages(packages)
  const shopRentVisibility = selectShopRentVisibility(merchProducts.length, rentalProducts.length)
  // Never the homepage hero's own poster — a real Signature Experience photo
  // when one exists, otherwise a different existing brand asset.
  const signatureImage = selectSignatureImage(experiences, null)

  return (
    <HomeClient
      settings={settings}
      posts={posts}
      testimonials={testimonials}
      policies={paymentRules.policies}
      curatedPicks={curatedPicks}
      staysLineup={staysLineup}
      categoryTiles={categoryTiles}
      packages={homePackages}
      shopRentVisibility={shopRentVisibility}
      signatureImage={signatureImage}
    />
  )
}
