# M3 · Discovery track

What shipped in this pass, why, and what was deliberately left out. Scope: SEO,
structured data, public search, and community-as-discovery-engine, per the
Discovery brief. The Ops Center / staff-auth track is a different engineer's
work in the same tree and is not covered here.

## 1. Community discovery links (migration 037) — the core new feature

- **`supabase/migrations/037_community_discovery_links.sql`**: new table
  `community_post_links(post_id, target_type, target_id, sort_order)`,
  `target_type` closed to `stay | trip | trip_package | signature_experience`.
  No cross-table FK on `target_id` (Postgres can't do polymorphic FKs) —
  existence + public visibility is checked server-side instead. RLS: public
  read, service-role write (same pattern as migration 033). Applied to the
  local DB (`weemap-local-db`) and verified with a `SELECT` join.
  `supabase/migrations/README.md` has a new "M3 Discovery (037)" section.
- **`src/lib/community.ts`** stayed pure (types/constants only,
  `COMMUNITY_LINK_TARGET_TYPES`) because `src/lib/community-view.ts` imports
  from it and must stay import-safe outside the server runtime (flagged by
  the lead mid-task — fixed by moving every Supabase-touching function into
  a new **`src/lib/community-links.ts`**: `communityLinkTargetExists`,
  `getCommunityPostLinks`, `getLinkedTargetsForPost`,
  `getCommunityPostsLinkingTarget`). `communityLinkTargetExists` re-checks
  the target row is still active/published before an admin can save a link;
  `getLinkedTargetsForPost`/`getCommunityPostsLinkingTarget` silently drop a
  link whose target has since gone inactive — a stale row never renders a
  dead link on either side.
- **Admin API**: `src/app/api/admin/community-posts/[id]/links/route.ts`
  (GET list, POST create — 404s if the target isn't a real public row, 409
  on a duplicate link) and `.../[linkId]/route.ts` (DELETE). Both use
  `requireStaff(req)` + `getSupabaseAdmin(gate.staff)`, matching the staff
  identity migration the lead is rolling out across admin routes.
- **Admin UI**: `src/components/admin/CommunityPostLinksEditor.tsx` (new,
  small, single-purpose) wired into
  `src/components/admin/CommunityPostManager.tsx`'s edit form. Picks a
  target type, loads real options from the existing admin list endpoints
  (`/api/admin/accommodations`, `/sinai-trips`, `/trip-packages`,
  `/experiences` — read-only reuse, not modified), and lets the operator
  link/unlink by name. Only shown once a post is saved (needs a post id).
- **Public rendering**:
  - `src/components/community/LinkedTargets.tsx` — the community article's
    "Plan it with WEEMAP" block, extended with the post's curated links.
    Each card links to the target's own page and, for `stay`/`trip`/
    `trip_package` (the three kinds `src/lib/trip-builder/state.ts`
    `applyPrefill` actually supports), a `/plan?stay=`/`?trip=`/`?package=`
    prefill CTA — reusing the exact param names the Trip Builder already
    reads. `signature_experience` has no `/plan` prefill support today, so
    it only gets a "View details" link — not a fabricated builder
    integration.
  - `src/components/community/LocalGuides.tsx` — the reverse block, wired
    into `/book-dahab/[id]`, `/sinai-trips/[slug]` and
    `/sinai-trips/packages/[slug]`. Renders nothing when there are no
    curated links (no fallback to category/keyword matching).
  - **Dev fixture**: `supabase/dev/local-seed.sql` §10, a
    `DO $$ ... to_regclass ... $$` guarded, `ON CONFLICT DO NOTHING` block
    linking 3 real seed posts to 3 real seed stays/trips (e.g. "Ras Abu
    Galum: Sinai's Untouched Coastline" → the Ras Abu Galum trip). Applied
    directly to the local DB and verified with a join query.

## 2. Structured data (`src/lib/schema-org.ts`)

Added, all built so a missing field is omitted rather than invented:
`getWebSiteSchema` (SearchAction only once a real search results page
exists — see §4), `getBreadcrumbSchema`, `getLodgingBusinessSchema`,
`getTouristTripSchema`, `getCommerceProductSchema`. `getArticleSchema` now
takes a real `dateModified` instead of always echoing `datePublished`.

Wired in:

| Page | Schema | Notes |
|---|---|---|
| `layout.tsx` (sitewide) | Organization (existing) + **WebSite w/ SearchAction** | SearchAction target is the real `/search?q=` page |
| `/book-dahab/[id]` | **LodgingBusiness** + Breadcrumb | swapped from generic `Product`; address only from the row's real `location` field; no fabricated `priceRange` (only one price point, not a range) or `aggregateRating` (the `rating` column is an editorial star rating, not real review data) |
| `/sinai-trips/[slug]` | **TouristTrip** + Breadcrumb | `offers` only when the trip has a standalone price; package-internal `package_price` never surfaces here |
| `/sinai-trips/packages/[slug]` | **TouristTrip** + Breadcrumb | `offers.price` = the real aggregate package total shown on the page |
| `/signature/[slug]` | **TouristTrip** + Breadcrumb | was already emitting a raw inline schema; moved onto the shared helper + real breadcrumb |
| `/merch/[slug]` | Product + Offer (already existed, M2) | left as-is — already correct (real inventory-derived availability) |
| `/rent/[slug]` | **Product + Offer (new)** | had zero structured data before; added, availability derived from `track_inventory`/variant stock the same way `merch` does |
| `/community/[slug]` | Article (existing) + **Breadcrumb (new)** | `dateModified` now uses the real `updated_at`; canonical/OG url now via `getPathname` instead of a hand-built `${ar?'':'/en'}` string |

Every page that had `JSON.stringify(schema).replace(/</g, '\\u003c')` (weaker
than the M1 hardened escaper — doesn't escape `>`, `&`, or U+2028/U+2029) was
switched to `jsonLdScript()` from `src/lib/safe-html.ts`.

**Tests**: `src/lib/schema-org.test.ts` (10 tests) — asserts no fabricated
`address`/`priceRange`/`offers` when the input doesn't have them, correct
`</script>` and U+2028 escaping via `jsonLdScript`, and `SearchAction`
present/absent correctly.

## 3. SEO metadata pass

Added/fixed canonical + hreflang (via `buildAlternates`, never hand-built),
Open Graph (`og:url`, `og:locale` `ar_EG`/`en_US`, real image or
`NEUTRAL_MEDIA` — never a stock photo), and Twitter cards on:
`/book-dahab/[id]`, `/community/[slug]`, `/sinai-trips/[slug]`,
`/sinai-trips/packages/[slug]`, `/signature/[slug]`. `robots: {index:false,
follow:true}` added to: `/plan` (only when a `?stay=`/`?trip=`/`?package=`
prefill param is present — the bare `/plan` URL is real indexable content
and is in the sitemap), `/signature/build` (a custom-request wizard, not a
catalog entity), and the new `/search` results page. `/cart` already had
`noindex` from M2 — untouched.

`/book-dahab/[id]`, `/sinai-trips/[slug]`, `/sinai-trips/packages/[slug]`,
`/community/[slug]`, `/merch/[slug]`, `/rent/[slug]` already called
`notFound()` for a missing/inactive entity (M2) — verified, not re-done.

## 4. Public search (`/api/search`, `src/lib/discovery/`)

- **`src/lib/discovery/search.ts`**: the query logic was extracted out of
  the route handler into `runSearch(query)`, now shared by `/api/search`
  (used by the header's `GlobalSearch` overlay) and the new
  `/[locale]/search` results page — one code path, one set of
  active/published filters, everywhere search happens.
- **Coverage extended**: stays, Sinai trips, merch and rentals already
  existed; added **trip packages** (`is_active` only) and **community
  guides** (`is_published` only, and skipped if the row has no slug yet).
  Every query is still scoped to its public-visibility column — never a
  draft, inactive row, or admin/customer/booking data.
- **Arabic-aware normalisation**: `src/lib/discovery/search-normalize.ts`
  strips tashkeel/tatweel and canonicalises أ/إ/آ→ا, ى→ي, ة→ه on the
  *query*, then searches with both the original and normalised spelling
  OR'd together (`searchQueryVariants`, capped at 2 variants). **Documented
  limit** (in the file's own header comment): this is a query-side
  heuristic, not true DB-side normalisation — the DB columns hold whatever
  an operator typed, unnormalised, and this track's one migration (037) is
  scoped to community links, not a search-normalisation schema change. A
  query using an Arabic spelling variant not covered by the letter map can
  still miss.
- **New public results page**: `/[locale]/search?q=` (`noindex,follow`,
  bilingual, grouped by type, links to real localized detail URLs, reuses
  the same brand `Section`/`SectionHeading` primitives as the rest of the
  site). `GlobalSearch` (the header overlay) got a "View all results for…"
  link into it, plus the two new result types (`trip_package`,
  `community_post`) in its own grouped list.
- **Tests**: `src/lib/search.test.ts` extended (URL construction for the 2
  new result types; a source-inspection test asserting `trip_packages` and
  `community_posts` are never queried without their active/published
  filter — scoped the pre-existing `commerce_products` column-check test to
  its own query block, since a global regex match started picking up the
  new queries' unrelated columns and false-failing). `search-normalize.test.ts`
  (8 tests) covers diacritic stripping, letter normalisation, and the
  2-variant cap. All pass — see the exact run below.

## 5. Sitemap / robots

`src/app/sitemap.ts`: added `/explore`, `/sinai-trips/packages`, `/plan`
(bare path only — see §3) as static entries; added **trip packages**
(`getTripPackages()`, already `is_active`-scoped) and **Signature
experiences** (`getExperiences()`, already `status='published'`-scoped) as
dynamic entries with real `lastModified`. Fixed `lastModified` for
accommodations, which was hardcoded to `new Date()` — now uses the real
`updated_at`/`created_at`. `robots.ts` was left as-is: it already allows
`/` and disallows `/admin/`, `/en/admin/`, `/api/`; per-page `noindex` meta
tags (not `robots.txt` disallow) carry the `/cart`/`/plan`/`/signature/build`/
`/search` exclusions, so crawlers can still fetch and see the `noindex`
directive rather than being blocked from seeing it at all.

## 6. i18n

All new strings in `src/messages/{ar,en}/discovery.json` under
`linkedTargets`, `localGuides`, `search.*`. `npx tsx
scripts/check-translations.ts` passes (parity verified, no flagged
identical AR/EN values). No other message file was touched.

## What was deliberately NOT done, and why

- **Full route-by-route SEO audit of every page in the brief's route list**
  (Stay list, Shop list/detail beyond merch's existing schema, Rent list,
  `/about`, `/partner`, `/policy`, `/merch` and `/rent` list pages, home).
  Time-boxed: prioritised the pages with real entities and the biggest
  structured-data gaps (stay/trip/package/signature detail, which had
  either nothing or a weaker/inline schema). The list pages already had
  metadata + `buildAlternates` from M2 and were spot-checked, not
  rewritten.
- **`priceRange` on `LodgingBusiness`**: `fromPricePerPersonPerNight`
  returns one number, not a real min/max — formatting a single price as a
  "range" would be inventing a range, so the field is omitted rather than
  faked.
- **`aggregateRating` on stays**: `accommodations.rating` is an
  editorial 1–5 star value the owner sets, not an aggregate of real guest
  reviews — never mapped to `AggregateRating`.
- **FAQPage schema**: not added anywhere, because no page in this codebase
  visibly renders a Q&A block. Per the brief, FAQPage is only for a page
  that actually shows FAQ content.
- **GEO factual-intro copy on `/explore`, `/sinai-trips`, `/book-dahab`,
  `/sinai-trips/packages`**: already present from M2 (real counts via
  `formatCount`, `SectionHeading`, editorial lede copy) — verified in place
  rather than reimplemented, since redoing working, already-correct hub
  page copy was out of scope for this pass.
- **True DB-side Arabic search normalisation** (generated/normalised
  columns): would need its own migration; this track's one migration slot
  (037) went to community links per the brief. Documented as a heuristic
  limit in `search-normalize.ts` instead (see §4).
- **`/rent` and `/merch` list pages, `/about`, `/partner`, `/policy`**:
  untouched — no structured-data or metadata gap was found on a spot check
  that seemed worth the remaining time budget versus the higher-value
  detail-page gaps above.

## Business-truth ambiguities encountered (not guessed on)

- **`accommodations.location` as `LodgingBusiness.address.addressLocality`**:
  the row has no structured street/locality/region columns — only a single
  free-text `location` string (e.g. "Mashraba, Dahab"). Used the whole
  string as `addressLocality` rather than trying to parse out a
  neighbourhood vs. city, since splitting it would be guessing at a
  structure the DB doesn't actually have.
- **Signature experience `/plan` prefill**: `community_post_links` supports
  linking a `signature_experience`, but `trip-builder/state.ts`
  `applyPrefill` has no `experience` kind (only `trip`/`trip_package`). The
  community "Plan it with WEEMAP" block links straight to the experience's
  own page for that target type instead of fabricating builder support —
  flagging this in case the builder is meant to gain that prefill kind
  later.

## Verification run

```
$ npx tsx --test src/lib/schema-org.test.ts src/lib/discovery/search-normalize.test.ts src/lib/search.test.ts src/lib/community-view.test.ts
ℹ tests 42
ℹ pass 42
ℹ fail 0

$ npx tsx scripts/check-translations.ts
Translation parity verified: 1742 leaf keys in each locale.

$ npx tsc --noEmit
(clean, no output)

$ npx tsx scripts/check-migrations.ts
Migrations OK: 37 files, 001–037.
```
