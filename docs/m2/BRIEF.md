# WEEMAP M2 — Public V2 working brief

Shared contract for everyone building M2. M1 (commit `5c5c638`) is closed: consume its
foundations, never rewrite them casually. If M2 exposes a real M1 defect, fix the
smallest underlying cause with a regression test.

## Non-negotiables
- No push, no deploy, no production Supabase, no production migrations. Local data only
  (`scripts/local-stack/`, Docker). Workers do not commit — the lead reviews and commits.
- Server stays authoritative for price, payment classification, transport schedule and
  request workflow. The client **displays** server results; it never computes a charged
  total or decides a payment kind.
- Never hard-code bus weekdays or stay lengths in V2 logic. Read `TransportScheduleConfig`
  (`src/lib/transport`, loaded server-side by `getTransportSchedule()`) and its `stayPatterns`.
  Schedule availability ≠ sellable pattern. Hiace is on-demand. Stay-only accepts any valid
  dates; recommended check-in weekdays are hints, not rules.
- Never invent trip schedules/itinerary days. Show an experience as "date arranged with you"
  unless real data (e.g. experience dates) supports a day.
- Payment truth (from `payment_policies`, defaults in `src/lib/payment-rules.ts`):
  stay 50% after availability confirmation / 50% on arrival · stay_package 50/50 ·
  trip 100% after confirmation · experience_package 100% · transfer 100%. Nothing is paid
  online in M2 (`payableNow: false`).
- Keep `images.unoptimized: true` in `next.config.ts`.
- Arabic and English are equal acceptance targets. Arabic must be designed, not mirrored.

## Information architecture
Primary nav: **Stay · Explore · Signature · Shop · Rent** + primary CTA **Build your trip**.

| Surface | Route (keep existing SEO URLs) |
|---|---|
| Stay | `/book-dahab`, `/book-dahab/[id]` |
| Explore hub | `/explore` (new) → Trips / Packages / Community |
| Trips | `/sinai-trips`, `/sinai-trips/[slug]` |
| Packages | `/sinai-trips/packages` (new index), `/sinai-trips/packages/[slug]` |
| Community | `/community`, `/community/[slug]` |
| Signature | `/signature`, `/signature/build`, `/signature/[slug]` |
| Shop | `/merch`, `/merch/[slug]`, `/cart` |
| Rent | `/rent`, `/rent/[slug]` |
| Trip Builder | `/plan` (new). Prefill via query: `?stay=<accommodation uuid>&mode=package_bus|hiace|stay_only&from=<governorate code>&trip=<uuid>&package=<uuid>` (trip/package repeatable) |
| Secondary | `/about`, `/partner`, `/policy` (footer + mobile drawer) |

Package semantics: `trip_packages` are ONLY **Sinai trip packages** — bundles of real
Sinai trips/experiences at a better total than booking separately, picked up from the
guest's Dahab stay, paid 100% after confirmation (`payment_kind: 'experience_package'`).
`stay_package` is NOT a public package type — it is the Trip Builder's internal payment
classification for "WEEMAP transport + a stay" (50/50), produced only inside `/plan`.
Never show it as a public "Dahab Stay Package" product, badge or lane.

## Visual direction — "Field notes for Sinai"
Sinai × adventure × local knowledge × freedom × trust × premium curation. Cinematic,
editorial, local, alive. Not SaaS, not Booking.com density, not beige-luxury agency.
- **Contrast of surfaces**: alternate *night* (`bg-sea-900` charcoal, text sand-50) and
  *paper* (`bg-sand-50`) sections; use deep sea (`sea-700`) sparingly for water moments.
  Sun (`sun-400` fill / `sun-700` text) is the single accent — CTAs and key marks only.
- **Type**: display = Bricolage Grotesque (Latin) / Alexandria (Arabic, Egyptian-designed);
  body = Plus Jakarta Sans / Almarai. Use `font-display` for headings. Latin display may
  use tight tracking and uppercase kickers; Arabic never gets letter-spacing or uppercase,
  gets more line-height (≥1.35 on headings), and slightly larger body size.
- **Map motif**: coordinates as kickers (e.g. `28.49°N · 34.51°E`, only real coordinates),
  dashed route lines, contour texture (`topo-bg`) — used as seasoning, not wallpaper.
- **Hierarchy over uniformity**: mix one hero-scale editorial card with smaller ones; rails
  on mobile; never a long wall of identical cards.
- **Motion**: orientation + atmosphere (reveal on scroll, image slow-zoom on hover, sheet
  transitions). Always respect `prefers-reduced-motion`.
- **Mobile first**: one dominant action per screen; filters/secondary config in bottom
  sheets; sticky contextual CTA that never covers content (add bottom spacer).

## Shared primitives (owned by the foundation batch — consume, don't fork)
All in `src/components/brand/` unless noted. Server-safe unless marked client.
- `Section` `{ tone?: 'paper'|'sand'|'night'|'sea', size?: 'sm'|'md'|'lg', id?, className?, children }`
  plus existing `SectionHeading` (now with `tone='light'` for night/sea), `WaveDivider`, `TopoBackdrop`.
- `Eyebrow` `{ children, coords?: string, tone?: 'ink'|'light' }`
- `Chip` (client) `{ selected?, onClick?, href?, icon?, count?, children }`; `ChipRail` scroll row.
- `Rail` (client) `{ label: string, children }` — horizontal snap rail, RTL-aware prev/next.
- `FilterSheet` (client) `{ title, triggerLabel, activeCount?, onReset?, children }` — bottom
  sheet < md, inline panel ≥ md.
- `StickyActionBar` (client) `{ summary?: ReactNode, action: ReactNode, className? }` — fixed
  bottom < md with safe-area padding and an in-flow spacer; hidden ≥ md.
- `PriceTag` `{ amount: number, from?: boolean, unit?: 'person'|'night'|'room'|'trip', size?: 'sm'|'md'|'lg', tone? }`
- `PaymentTerms` `{ kind: PaymentKind, policies: PaymentPolicy[], compact? }` — renders the
  policy for a kind ("50% after confirmation · 50% on arrival") + "nothing is charged online".
- `EditorialCard` `{ href, image, title, kicker?, meta?, badge?, size?: 'lg'|'md'|'sm', priority? }`
- `DirectionalIcon` / `ArrowForward` / `ChevronForward` — flip in RTL.
- `src/components/EmptyState.tsx` refined: `variant: 'curating'|'no-results'|'error'`, with
  primary + secondary actions. Zero inventory uses `curating` (intentional, on-brand).
- Existing: `ButtonLink`, `SafeImage`, `Price`, `Reveal`, shadcn `ui/*` (sheet, dialog, tabs…).

## i18n
- New strings go in V2 namespace files `src/messages/<ar|en>/<ns>.json` (see
  `src/messages/namespaces.ts`). The file's object is the namespace:
  `useTranslations('builder')`. Each surface owns its namespace; don't edit
  `src/messages/ar.json` / `en.json` (legacy, lead-owned).
- `npm run check:translations` enforces key parity and flags Arabic == English copies.
- Arabic copy: natural Egyptian-friendly MSA, warm and direct — write it, don't translate
  word-for-word. Arabic numerals policy: follow existing `src/lib/format.ts`.
- Arabic terminology (one term per concept): package = باكدج / باكدجات (Sinai trip package =
  باكدج رحلة سيناء, Sinai trip packages = باكدجات رحلات سيناء); community = الكوميونيتي;
  Signature in running Arabic text = سيجنتشر (Latin "WEEMAP Signature" only as a brand mark);
  trip = رحلة, experience = تجربة. Every user-visible number goes through `src/lib/format.ts`.
- Use logical CSS only (`ms-/me-/ps-/pe-/start-/end-/text-start`), flip directional icons.

## Trip Builder contract (`/plan`)
Flow: Origin → Transport → Dates → Travelers → Stay → Room/Meal → Experiences → Overview →
Price/Payment → Contact/Request, delivered as progressive, editable cards — not a 10-page form.
- Pure logic: `src/lib/trip-builder/` (client-safe, unit-tested).
- Server: `priceTripRequest()` in `src/lib/trip-requests/service.ts`; preview endpoint
  `POST /api/trip-requests/quote` (no DB write, no contact) returns server lines, total,
  per-part payment plans and the combined plan. Submit = `POST /api/trip-requests`.
- Draft state lives in `localStorage` via `serializeDraft`/`parseDraft` until the visitor
  submits contact details. Nothing identifiable leaves the browser before submit.
- After submit: show reference, what WEEMAP confirms next, payment timing, WhatsApp hand-off
  carrying the reference + a summary.

## Worker rules
- Own only the files listed in your task. Need a change elsewhere? Say so in your report.
- Run `npx tsc --noEmit` and `npx eslint <your files>`; add `*.test.ts` for behaviour
  (node:test via `tsx`), not markup snapshots. Only fix errors in files you own.
- Don't add dependencies without saying why. No new global state libraries.
- Report: files changed, decisions, anything unverified, follow-ups.
