# WEEMAP M2 — Public V2 report

Base: M1 `5c5c638`. Nothing pushed, deployed, or applied to production. All browser
acceptance ran against the local Docker stack (`scripts/local-stack/`).

## What shipped
- **IA:** Stay · Explore (Trips / Packages / Community) · Signature · Shop · Rent, plus a
  Build your trip CTA. Existing SEO URLs kept; new `/explore`, `/sinai-trips/packages`, `/plan`.
- **Trip Builder `/plan`:** transport → dates → travellers → stay → room/meal → experiences →
  overview → price/payment → contact. Dates come only from the configured schedule and stay
  patterns; Hiace is on demand; stay-only takes any valid range. Prices and payment timing are
  rendered from `POST /api/trip-requests/quote` and never computed on the client. The draft
  stays in localStorage until submit. Submitting goes to `POST /api/trip-requests`, and the
  WhatsApp hand-off carries the WR reference.
- **Operations:** a minimal admin inbox for `trip_requests`. Status changes go through the M1
  request workflow, and customer notes are read-only.
- **Surfaces:** editorial Home; Stays list/detail (Build your stay → `/plan?stay=`); Trips by
  structured category (`?category=`); one Sinai trip-packages catalogue; a Signature brief;
  Community long-reads; Shop/Rent/Cart that are data-driven and show an intentional curating
  state at zero inventory.
- **Design system:** brand primitives in `src/components/brand/` and per-surface i18n
  namespaces (`src/messages/<locale>/<ns>.json`). Arabic is written natively, and every
  number goes through `src/lib/format.ts`.

## Product correction applied during M2
`trip_packages` are Sinai trip packages only (100% after confirmation). `stay_package` is only
the internal classification of a transport + stay booking. The DB side is migration **034**,
which constrains `trip_packages.payment_kind`; the UI shows a single package catalogue. Items
without a photo use the neutral media (`src/lib/media.ts`) and never another place's imagery.

## Acceptance evidence (production build against the local stack)
- Gates: 437/437 tests, typecheck clean, ESLint 0 problems, 1,184 translation keys in parity
  (AR = EN), migrations 001–034 contiguous, bootstrap + DB invariants pass, `next build` OK.
- Journeys (scripted CDP, AR mobile + EN desktop):
  - Bus + stay + meal + trip, submitted: WR ref returned, server split 6,280 after confirmation
    / 4,480 on arrival.
  - Hiace transfer-only + package: 100% after confirmation.
  - Stay-only range, submitted: 50/50.
  - Package → "Add to my trip" prefill.
  - Stay → "Build your stay" prefill.
  - Merch variant → cart → checkout form.
  - Rental availability from data.
  - Admin inbox list and workflow-enforced status changes; DB domain events recorded.
- Layout: no clipped or overflowing content on any public route at 360/390/768/1280.
- Accessibility: axe WCAG 2 A/AA clean on 16 key pages in AR and EN. One exception: the sticky
  Home hero stay card title, an axe artefact of `position: sticky` (without it the finding
  becomes "incomplete"; the rendered text is white on a dark scrim). Also verified: skip link,
  visible focus, and Explore menu open and Escape with keyboard.

## Known debt (M3/M4)
- Production: apply migrations **029–034** (see `supabase/migrations/README.md` preflight)
  before deploying.
- Real WEEMAP photography for stays, trips, packages, products and signature (the neutral
  media stands in until then).
- Dev only: Turbopack sometimes serves stale V2 message JSON after edits; restart `next dev`.
- Server-built Arabic quote lines use Latin digits in the stored text (the display is
  localised client-side); the package line label still reads "باقات الرحلات".
- M3 scope as planned: Operations Center (full trip-request conversion into bookings, staff
  notes column), RBAC, the SEO/GEO program, AGENEON, and a consent banner.
- History note: checkpoint `877e89d` alone doesn't build (namespace stubs landed in the next
  commits); every later commit builds.
