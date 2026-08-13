import { HomeClient } from '@/components/home/HomeClient'
import {
  getAccommodations,
  getSinaiTrips,
  getCommunityPosts,
  getTestimonials,
  getSiteSettings,
} from '@/lib/data'

// Server Component: everything the home page shows comes from Supabase and is
// editable from the dashboard. The client half only handles interaction.
export default async function HomePage() {
  const [accommodations, trips, posts, testimonials, settings] = await Promise.all([
    getAccommodations(),
    getSinaiTrips(),
    getCommunityPosts(),
    getTestimonials(),
    getSiteSettings(),
  ])

  return (
    <HomeClient
      accommodations={accommodations}
      trips={trips}
      posts={posts}
      testimonials={testimonials}
      settings={settings}
    />
  )
}
