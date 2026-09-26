'use client'

import { Hero } from './Hero'
import { IntentGateway } from './IntentGateway'
import { Curated } from './Curated'
import { TripBuilderTeaser } from './TripBuilderTeaser'
import { Stays } from './Stays'
import { ExploreCategories } from './ExploreCategories'
import { SinaiPackages } from './SinaiPackages'
import { EditionsTeaser } from './EditionsTeaser'
import { CommunitySpread } from './CommunitySpread'
import { ShopRent } from './ShopRent'
import { TrustSpread } from './TrustSpread'
import { FinalCta } from './FinalCta'
import type { PaymentPolicy } from '@/lib/payment-rules'
import type { CategoryTile, CuratedPick, ShopRentVisibility, StaysLineup } from '@/lib/home-sections'
import type { CommunityPost, SiteSettings, Testimonial, TripPackage } from '@/lib/types'
import type { PublicEdition } from '@/lib/editions'
import type { SitePage } from '@/lib/site-pages-core'

interface Props {
  settings: SiteSettings | null
  homeSitePage: SitePage | null
  posts: CommunityPost[]
  testimonials: Testimonial[]
  policies: PaymentPolicy[]
  curatedPicks: CuratedPick[]
  staysLineup: StaysLineup
  categoryTiles: CategoryTile[]
  packages: TripPackage[]
  shopRentVisibility: ShopRentVisibility
  featuredEdition: PublicEdition | null
}

/**
 * Home V2 — assembles the twelve sections from docs/m2/BRIEF.md /
 * scratchpad task-home.md in order. Every section already decided what it
 * has to show (see src/lib/home-sections.ts, run server-side in page.tsx);
 * this component's only job is drawing the alternating night/paper/sand/sea
 * rhythm and passing props through.
 */
export function HomeClient({
  settings,
  homeSitePage,
  posts,
  testimonials,
  policies,
  curatedPicks,
  staysLineup,
  categoryTiles,
  packages,
  shopRentVisibility,
  featuredEdition,
}: Props) {
  return (
    <div className="overflow-x-clip">
      <Hero settings={settings} sitePage={homeSitePage} />
      <IntentGateway />
      <Curated picks={curatedPicks} />
      <TripBuilderTeaser />
      <Stays lineup={staysLineup} />
      <ExploreCategories tiles={categoryTiles} />
      <SinaiPackages packages={packages} policies={policies} />
      <EditionsTeaser featuredEdition={featuredEdition} />
      <CommunitySpread posts={posts} />
      <ShopRent visibility={shopRentVisibility} />
      <TrustSpread testimonials={testimonials} />
      <FinalCta settings={settings} />
    </div>
  )
}
