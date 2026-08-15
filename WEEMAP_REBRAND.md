# WEEMAP SINAI — Rebrand & Product Evolution

Working log + architecture reference for the First Trip → WEEMAP SINAI transformation.
Infrastructure is unchanged: same Vercel project, same Supabase project, same Next.js app,
same production data. This is a rebrand and product evolution, not a rebuild.

---

## Status — Phase 1 complete (this pass)

### 1. Brand rename (public surface)

Every public "First Trip" reference is gone from `src/` and `package.json`:

- `src/lib/constants.ts` — SITE_NAME, descriptions, email → `info@weemapsinai.com`
- `src/app/[locale]/layout.tsx` — metadataBase → `https://weemapsinai.com`, all titles/OG/Twitter
- `src/lib/schema-org.ts` — organization schema → WEEMAP, verified Instagram only, unverified `foundingDate` removed
- `src/messages/ar.json` / `en.json` — hero title/description, about, footer rights
- `src/components/brand/Logo.tsx` — new WEEMAP SINAI lockup (temporary mark — see WEEMAP_ASSET_CHECKLIST.md)
- `src/components/home/HomeClient.tsx` — hero: "We map Sinai. You live it." / "إحنا بنرسم لك سيناء، وإنت بتعيشها"
- `src/app/[locale]/about/page.tsx` — the old founded/pause/relaunch timeline is replaced with
  four what-we-do pillars. **Deliberate:** the brand rules forbid relaunch/"we're back" language
  and require verification of historical claims before publishing.
- All "since 2017" / "10 years" claims removed pending owner verification (WEEMAP_INFO.md says TBD).
- `robots.ts`, `sitemap.ts` → weemapsinai.com
- Footer: Facebook link now renders only when set in Site Settings (WEEMAP Facebook is TBD);
  Instagram fallback = verified `instagram.com/weemapeg`.

**Not renamed (intentional):** technical identifiers — DB table/column names, `book-dahab` routes,
storage bucket names, env var names. Renaming those risks production data for zero public benefit.
Legacy SQL files (`schema.sql`, `migration_v2/v3/v4`, `seed_data.sql`) keep their historical headers;
they have already been run and are documentation of the past, not the future.
**Follow-up for the owner:** the seeded placeholder testimonials mention First Trip — replace them
from the dashboard (Testimonials tab). The old `public/logo.png` is still the First Trip pin; see
the asset checklist.

### 2. Pricing engine v2 — `src/lib/pricing.ts`

New, fully tested (12 tests, `npx tsx --test src/lib/pricing.test.ts`):

- **Triple rooms** — `roomOccupancy()`, `baseNightlyRoomRate()`. A missing triple rate falls back
  to double × 1.5 as a *suggestion only*; an explicit `price_triple_room` always wins.
- **Night-by-night seasonal resolution** — `resolveNightlyRates()`. Each night of a stay resolves
  individually against `accommodation_seasonal_rates`; a stay crossing a boundary is charged
  per-night, never wholesale from the check-in date. Uncovered nights use the base rate.
- **Trip package cost** — `includedTripCost()` uses `sinai_trips.package_price` when a trip is one
  of the two included package trips; falls back to public `price` when unconfigured. Extra trips
  always use the public price (`extraTripCost()`).
- **Package formula v2** — `quotePackageV2()`:
  `accommodation (total room, nightly) + transfer×people + included package costs×people
   + meal×people×nights + extras×people = total`. Per-person is derived for display only.
- **Historical price safety** — `buildPriceSnapshot()` / `buildStaySnapshot()` freeze every rate
  used (per-night room rates + source, transfer rate, trip costs, meal pricing) into
  `bookings.price_snapshot`. Past bookings never change when prices change.

The old v1 helpers (`quoteAccommodationPackage`, `quoteStay`, `quoteTransfer`, bus-day rules) are
untouched, so everything currently wired keeps compiling and working. **All authoritative pricing
stays server-side** — the booking API must recompute with these functions and never trust
client-submitted totals.

### 3. Schema — `supabase/migrations/004_weemap_pricing_engine_v2.sql`

Additive only; safe against production data. Adds:

| Change | Purpose |
|---|---|
| `accommodations.price_triple_room` | Base triple rate |
| `accommodation_seasonal_rates` (new table) | Named date-range single/double/triple overrides; **EXCLUDE constraint** blocks overlapping active periods per accommodation (never silently pick a rate); RLS: public read active, admin write |
| `sinai_trips.package_price` | Trip cost inside a package, separate from public price |
| `bookings.payment_status` / `amount_paid` / `internal_notes` | Manual payment tracking (unpaid/partial/paid/refunded) — no gateway |
| `bookings.price_snapshot` JSONB | Frozen rate breakdown per booking |
| `bookings.source` widened | website / manual / whatsapp / instagram / facebook / referral / other |
| `bookings.status` + `'new'` | Practical workflow: new → pending → confirmed → completed / cancelled |

Run it in the Supabase SQL editor after the earlier migrations. Requires `btree_gist`
(the migration enables it).

### 4. Types — `src/lib/types.ts`

`AccommodationSeasonalRate`, `PriceSnapshot`, `PaymentStatus`, `BookingSource`,
`WeemapSiteSettings` (structured Website-section settings), triple room support on
`Accommodation`/`Booking`, `package_price` on `SinaiTrip`.

---

## Phase 2 complete — engine wired into the APIs

- `POST /api/bookings` now prices with `quotePackageV2` (seasonal night-by-night, triple
  rooms, trip package costs) and stores `price_snapshot` + status `'new'` + source `'website'`.
  Legacy fallbacks retained for accommodations without room pricing. Bus-day validation now
  also covers transfer-only bus bookings; extra trips that duplicate included trips are
  de-duplicated instead of double-charged.
- `lib/data.ts`: `getSeasonalRates()` + `getAccommodationById()` embeds `seasonal_rates`.
- New admin API: `GET/POST /api/admin/seasonal-rates`, `PATCH/DELETE /api/admin/seasonal-rates/[id]`.
  DB overlap violations (SQLSTATE 23P01) surface as a clear 409 message.
- Admin bookings API (create + update): `payment_status`, `amount_paid`, `internal_notes`,
  full `source` channel list, `'new'` status, `room_type` incl. triple, `meal_plan_key`.
- Trips admin API accepts `package_price`; accommodations admin API accepts `price_triple_room`.
- Verified: full `tsc --noEmit` (errors only from files not part of this pass), 12/12 pricing tests.

## Phase 3 complete — WEEMAP Business Control Center (admin UI)

- **Overview (DashboardHome)** rebuilt: date filters (today / 7d / this month / last month /
  all / custom), KPI cards from real bookings only — Bookings, **Booked value** (never called
  revenue), **Collected** + outstanding, Travelers — plus **Upcoming Arrivals**, Recent
  bookings, and an actionable **Attention Required** panel (missing photos, missing base room
  pricing, included-trips misconfiguration, missing package costs, new bookings awaiting review).
- **Bookings**: `new` status (purple) in every status control; payment panel in the expanded
  row (status select + amount paid + auto remaining balance); frozen **price-snapshot
  breakdown** with per-night rate chips (seasonal nights highlighted); internal notes
  (admin-only, saved on blur); full source channel list in filter/badge/manual form; manual
  form gained room type (incl. triple), source, payment fields; CSV export extended with room
  type, meal plan, payment status, amount paid, remaining.
- **Accommodations**: three room price fields (single / double / triple — total room price per
  night) with a one-click triple = double × 1.5 suggestion (always editable); new
  **SeasonalRatesEditor** embedded in the editor — period table (name / from / to / three
  prices / status) with add, edit, duplicate-rates, deactivate, delete; DB overlap rejections
  surface as clear messages; double→triple suggestion inside the period form too.
- **Trips**: public price + package cost fields, with an amber "package cost not set" hint in
  the list when unconfigured.

## Phase 4 complete — public site

- **Cinematic hero**: scroll-driven golden hour → dusk → blue hour → night scene over a Sinai
  road — layered gradient sky, parallax star field, subtle moon, ridge silhouettes, and a
  vehicle that moves down the road with headlights activating at night. Pure CSS + one passive
  scroll listener (no WebGL, no new dependencies); collapses to a static dusk scene under
  `prefers-reduced-motion`. Owner's hero photo/video still layers underneath.
  (Blueprint alternative: GSAP + ScrollTrigger — current implementation matches the beats
  without adding the dependency; swap in GSAP later if more elaborate choreography is wanted.)
- **Booking form**: triple room is a first-class option in both package and stay flows
  (three-card picker); live preview prices it at triple ÷ 3 per person.
- Hero heading/subheading are settings-driven with WEEMAP defaults.

## Phase 5 complete — Website CMS

- Migration `005_weemap_website_cms.sql`: hero copy (ar/en), featured accommodation/trip
  pickers, section visibility toggles (community / partners / newsletter), global SEO fields.
- Site Settings screen: Homepage Content card (hero copy, toggles, featured pickers), SEO
  card, and a warning when the included-package-trips count ≠ 2.
- Wired: homepage uses hero copy + featured selections + community toggle; layout hides the
  newsletter on toggle; `generateMetadata` reads SEO overrides per locale with WEEMAP defaults.

## Phase 6 — build validation (done) & launch steps (owner)

Verified in this pass: full `tsc --noEmit` clean · ESLint 0 errors (37 pre-existing style
warnings) · 12/12 pricing tests · `next build` compiles and generates all 23 pages
(fonts + two CSS package imports were stubbed ONLY inside the sandbox because its network
blocks fonts.googleapis.com — the committed code is untouched and builds normally on Vercel).

Remaining launch steps for the owner:
1. Run `supabase/migrations/005_weemap_website_cms.sql` in the Supabase SQL editor.
2. Add `weemapsinai.com` to the existing Vercel project; set `NEXT_PUBLIC_SITE_URL`.
3. When DNS is live: permanent redirect `firsttrip-eg.com` → `weemapsinai.com`.
4. Work through WEEMAP_ASSET_CHECKLIST.md (logo assets, photography, verified contact info).

## Deferred (deliberately, per "do not overbuild")

- Guided 12-step booking wizard rework (current single-page flow already covers every step's
  content; split into steps once real hero/photo assets land and the flow is re-designed).
- Charts on the Overview (bookings over time, type split) — add once there's enough real
  booking volume for them to be meaningful; KPI cards cover today's needs.
- Homepage section drag-ordering (visibility toggles shipped; ordering adds complexity for
  little daily value right now).

### (original roadmap notes below)

### Phase 3 — admin: WEEMAP Business Control Center
- Navigation restructure: Overview / Bookings / Accommodations / Trips / Transfers /
  Customers / Website / Community / Partners / Subscribers / Settings
- Overview: date filters (today / 7d / month / custom), KPI cards from REAL bookings
  ("Booked Value" / "Collected" / "Outstanding" — never "revenue" unless collected),
  Upcoming Arrivals, Attention Required (missing seasonal price, missing package cost,
  missing images, unconfirmed bookings)
- Accommodation editor → guided tabs (Basics / Photos / Rooms & Pricing incl. seasonal table
  with duplicate/copy-rates + overlap warnings / Meal Plans / Preview); triple price input
  suggesting double × 1.5 (editable); Booking.com importer kept — prices stay owner-controlled
- Trips: public price + package cost fields with unconfigured warning
- Transfers: governorate × mode matrix UI (build on existing base+surcharge model)
- Booking detail: full snapshot breakdown, payment tracking, remaining balance, source

### Phase 4 — public site
- Cinematic hero per `_weemap_reference/03_hero/HERO_MOTION_BLUEPRINT.md` (GSAP + ScrollTrigger,
  golden hour → night scene, no heavy WebGL)
- Homepage restructure (What Brings You to Sinai? / Featured / Explore / Picks / How it Works /
  Community / Partners / Newsletter)
- Guided multi-step booking flow (12 steps per spec, progress visible, back-safe)
- Editorial accommodation + trips pages; map experience with real coordinates only

### Phase 5 — Website CMS section (admin)
- Structured settings per `WeemapSiteSettings`: General / Homepage (hero copy, featured content,
  section toggles + limited ordering) / Booking settings (included trips 1+2) / SEO
- No free-form page builder — safe structured controls only

### Phase 6 — domain & launch
- Vercel: add `weemapsinai.com` to the existing project; keep the old domain until DNS is ready,
  then 301 `firsttrip-eg.com` → `weemapsinai.com` (Vercel domain redirect)
- Set `NEXT_PUBLIC_SITE_URL=https://weemapsinai.com`
- QA checklists from the master spec (public + admin), lint, typecheck, tests, production build

---

## Verification run in this pass
- 12/12 pricing tests pass (`npx tsx --test src/lib/pricing.test.ts`)
- `tsc --noEmit --strict` clean on `src/lib/pricing.ts` + `types.ts`
- Zero `First Trip` / `firsttrip` / `2017` occurrences left in `src/` or `package.json`
- Locale JSON files re-validated after edits

## Audit pass — real state vs. this document (later session)

Before trusting this document, a fresh audit re-read every file directly off
the machine (not off an earlier working copy) and found a few things that had
drifted from what's described above. Fixed in this pass:

- **`src/components/brand/Logo.tsx` was still the OLD First Trip logo** —
  `next/image` pointed at `/logo.png` with `alt="First Trip"` and rendered the
  visible text "FIRST TRIP". Replaced with the WEEMAP pin-mark + "WEEMAP
  SINAI" wordmark version (no image dependency).
- **`public/logo.png` and `src/app/favicon.ico` were still the old First Trip
  artwork** — this is what showed up as the browser tab icon, the Open Graph
  share image, and the schema.org organization logo. Regenerated both as
  simple WEEMAP-branded placeholders (orange pin mark on sand background).
  Replace with real exported brand assets when the vector logo is ready —
  see `WEEMAP_ASSET_CHECKLIST.md`.
- **`src/app/api/bookings/route.ts` (the actual public booking-creation
  endpoint) was still the pre-rebrand version** — no triple-room support, no
  `price_snapshot`, no `payment_status`/`source`/`status: 'new'` defaults, and
  it used the old v1 `quoteAccommodationPackage` math instead of the
  seasonal-aware `quotePackageV2`. Rewritten to match the admin side: prices
  every booking with `quotePackageV2`/`buildStaySnapshot`, freezes a
  `price_snapshot`, sets `status: 'new'`, `payment_status: 'unpaid'`,
  `source: 'website'`.
- **Bus-schedule validation on the server only checked `booking_type ===
  'package'`** — a `transfer-only` booking with the shared bus could bypass
  the Sun/Thu-out, Mon/Fri-back restriction via a direct API call (the client
  date picker enforced it, but the server didn't). Fixed.
- **Governorate was picked *after* bus/hiace in the transfer-only form** —
  the spec requires governorate first. Reordered, and the governorate list
  is now the union of both transfer types' configured governorates so it can
  render before the type is chosen.

Re-validated after these fixes: `tsc --noEmit` clean, 12/12 pricing tests
pass, `npm run lint` → 0 errors (37 pre-existing warnings, unchanged), and a
full production build (`npm run build`) succeeds generating all 23+ routes
(fonts + Supabase env vars stubbed only inside the sandbox for this check —
Vercel has real network access and the real env vars already configured).
