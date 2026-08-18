import type { Metadata } from 'next'
import { HomeClient } from '@/components/home/HomeClient'
import { buildAlternates } from '@/lib/seo'
import {
  getAccommodations,
  getSinaiTrips,
  getCommunityPosts,
  getSiteSettings,
} from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/', locale) }
}

// Server Component: everything the home page shows comes from Supabase and is
// editable from the dashboard. The client half only handles interaction.
export default async function HomePage() {
  const [accommodations, trips, posts, settings] = await Promise.all([
    getAccommodations(),
    getSinaiTrips(),
    getCommunityPosts(),
    getSiteSettings(),
  ])

  return (
    <HomeClient
      accommodations={accommodations}
      trips={trips}
      posts={posts}
      settings={settings}
    />
  )
}
