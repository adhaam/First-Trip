// ─── Community view logic — pure, server- and client-safe ───
//
// Every non-trivial decision the Community surface makes (which post leads
// the index, which category pills to show, how long a read takes, whether a
// post can honestly offer a "Explore <category> trips" link) lives here so
// it can be unit-tested without Supabase or React. See
// src/lib/community-view.test.ts.
//
// docs/m2/BRIEF.md: "Never invent trip schedules/itinerary days... Never
// invent data, schedules, relationships" — matchingTripCategorySlug is the
// one place that rule is enforced for post → trip category linking: a match
// requires the two slugs to be byte-identical, never fuzzy or inferred.

import { POST_CATEGORIES } from './community'
import type { CommunityPost, PostCategory, TripCategory } from './types'

export interface CommunityCategoryFacet {
  category: PostCategory
  count: number
}

/**
 * Canonical Community post order: pinned first, then admin `sort_order`,
 * then newest — the same order `getCommunityPosts()` already asks Supabase
 * for. Kept here (rather than trusted purely to the query) so client-side
 * filtering and `selectFeaturedPost` can never silently disagree with it.
 */
export function sortCommunityPosts(posts: readonly CommunityPost[]): CommunityPost[] {
  return [...posts].sort(
    (a, b) =>
      Number(b.is_pinned) - Number(a.is_pinned) ||
      a.sort_order - b.sort_order ||
      b.created_at.localeCompare(a.created_at),
  )
}

/**
 * The single story the index leads with: the highest-priority post in
 * `sortCommunityPosts` order (a pinned post if one exists, otherwise the
 * admin's top `sort_order` post). Returns null for an empty list — the page
 * decides how to render "no content yet" (EmptyState `curating`), this
 * module never does.
 */
export function selectFeaturedPost(posts: readonly CommunityPost[]): CommunityPost | null {
  return sortCommunityPosts(posts)[0] ?? null
}

/**
 * Every other post, in the same canonical order, with the featured post
 * removed — what the index grid renders below the lead story.
 */
export function selectSecondaryPosts(posts: readonly CommunityPost[]): CommunityPost[] {
  const featured = selectFeaturedPost(posts)
  return sortCommunityPosts(posts).filter((post) => post.id !== featured?.id)
}

/**
 * Categories actually present in `posts`, in the fixed `POST_CATEGORIES`
 * taxonomy order, each with its post count. A category with zero posts is
 * never returned — the nav only ever offers a filter that has content
 * behind it.
 */
export function communityCategoryFacets(posts: readonly CommunityPost[]): CommunityCategoryFacet[] {
  const counts = new Map<PostCategory, number>()
  for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
  return POST_CATEGORIES.filter((category) => counts.has(category)).map((category) => ({
    category,
    count: counts.get(category) as number,
  }))
}

/**
 * ~200 words/minute, rounded up, minimum 1 — the estimate both the index
 * cards and the article page show. Extracted from the pre-existing
 * CommunityClient inline calculation so the two surfaces can never drift.
 */
export function estimateReadingMinutes(content: string): number {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

/**
 * The set of real, active, structured Sinai Trip category slugs — built
 * from whatever `getSinaiTrips()` (src/lib/data.ts) already returned, so
 * this never queries anything itself. Legacy free-text categories (their
 * synthetic slug is prefixed `legacy:` by `resolveTripCategory` in
 * src/lib/trip-categories.ts) are excluded: they are not a real taxonomy
 * entry, so a post can never "match" one.
 */
export function activeTripCategorySlugs(
  trips: readonly { category_tags?: readonly Pick<TripCategory, 'slug' | 'is_active'>[] }[],
): Set<string> {
  const slugs = new Set<string>()
  for (const trip of trips) {
    for (const tag of trip.category_tags ?? []) {
      if (tag.is_active && !tag.slug.startsWith('legacy:')) slugs.add(tag.slug)
    }
  }
  return slugs
}

/**
 * Whether a post may honestly offer "Explore <category> trips" — true only
 * when the post's own category slug is byte-identical to a real, active
 * structured trip category slug. Everything else (similar-sounding
 * categories, partial matches, category labels) must return false: the
 * brief allows this link ONLY on a literal slug match, never an inferred one.
 */
export function matchingTripCategorySlug(
  post: Pick<CommunityPost, 'category'>,
  tripCategorySlugs: ReadonlySet<string>,
): PostCategory | null {
  return tripCategorySlugs.has(post.category) ? post.category : null
}
