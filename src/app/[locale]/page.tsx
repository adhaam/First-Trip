import type { Metadata } from 'next'
import { HomeClient } from '@/components/home/HomeClient'
import { pageMetadata, siteSeo } from '@/lib/seo'
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
import { listPublicEditions } from '@/lib/editions-data'
import { getPaymentRules } from '@/lib/payment-rules-load'
import {
  selectCategoryTiles,
  selectCuratedPicks,
  selectFeaturedEdition,
  selectHomePackages,
  selectShopRentVisibility,
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
  // The home page carries the owner-editable sitewide SEO (Site Settings → SEO).
  const settings = await getSiteSettings().catch(() => null)
  const { title, description } = siteSeo(settings, locale)
  return {
    ...pageMetadata({ locale, path: '/', title, description }),
    title: { absolute: title },
  }
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
    editions,
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
    listPublicEditions(),
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
  const featuredEdition = selectFeaturedEdition(editions)

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
      featuredEdition={featuredEdition}
    />
  )
}
