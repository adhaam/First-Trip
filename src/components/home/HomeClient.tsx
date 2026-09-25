'use client'

import { Hero } from './Hero'
import { IntentGateway } from './IntentGateway'
import { Curated } from './Curated'
import { TripBuilderTeaser } from './TripBuilderTeaser'
import { Stays } from './Stays'
import { ExploreCategories } from './ExploreCategories'
import { PackageLanes } from './PackageLanes'
import { SignatureMoment } from './SignatureMoment'
import { CommunitySpread } from './CommunitySpread'
import { ShopRent } from './ShopRent'
import { TrustSpread } from './TrustSpread'
import { FinalCta } from './FinalCta'
import type { PaymentPolicy } from '@/lib/payment-rules'
import type {
  CategoryTile,
  CuratedPick,
  PackageLanes as PackageLanesData,
  ShopRentVisibility,
  StaysLineup,
} from '@/lib/home-sections'
import type { CommunityPost, SiteSettings, Testimonial } from '@/lib/types'

interface Props {
  settings: SiteSettings | null
  posts: CommunityPost[]
  testimonials: Testimonial[]
  policies: PaymentPolicy[]
  curatedPicks: CuratedPick[]
  staysLineup: StaysLineup
  categoryTiles: CategoryTile[]
  packageLanes: PackageLanesData
  shopRentVisibility: ShopRentVisibility
  signatureImage: string
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
  posts,
  testimonials,
  policies,
  curatedPicks,
  staysLineup,
  categoryTiles,
  packageLanes,
  shopRentVisibility,
  signatureImage,
}: Props) {
  return (
    <div className="overflow-x-clip">
      <Hero settings={settings} />
      <IntentGateway />
      <Curated picks={curatedPicks} />
      <TripBuilderTeaser />
      <Stays lineup={staysLineup} />
      <ExploreCategories tiles={categoryTiles} />
      <PackageLanes lanes={packageLanes} policies={policies} />
      <SignatureMoment image={signatureImage} />
      <CommunitySpread posts={posts} />
      <ShopRent visibility={shopRentVisibility} />
      <TrustSpread testimonials={testimonials} />
      <FinalCta settings={settings} />
    </div>
  )
}
