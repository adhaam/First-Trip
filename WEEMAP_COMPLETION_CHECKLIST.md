# WEEMAP SINAI — Completion Checklist

Snapshot of what's done, what's verified, and what's left before launch.
See `WEEMAP_REBRAND.md` for the full working log (Phases 1–7) and
`WEEMAP_ASSET_CHECKLIST.md` for outstanding assets/facts.

## Product — done

- [x] Public branding: zero "First Trip" references in `src/` or `package.json`
      (only intentional code comments and historical, already-run SQL files keep
      the old name — documented in WEEMAP_REBRAND.md).
- [x] Pricing engine v2 — triple rooms, night-by-night seasonal pricing,
      trip public vs. package price, historical price snapshots, server-side
      only (`src/lib/pricing.ts`, wired into both the public and admin booking APIs).
- [x] Video-first hero — `public/media/herovideo.mp4` + `heroposter.png`,
      autoplay/muted/loop/playsInline, poster fallback, reduced-motion support,
      transparent-over-hero header.
- [x] WEEMAP Business Control Center admin — Overview (real KPIs, date
      filters, Upcoming Arrivals, Attention Required), Bookings (status,
      payment tracking, price-snapshot breakdown, source, CSV export),
      Accommodations (rooms & seasonal pricing editor, Booking.com importer),
      Trips (public/package price), Transfers (governorate × mode matrix,
      bus schedule), Website CMS (hero copy, featured content, section
      toggles, SEO fields).
- [x] Localization — English/Arabic key parity (177/177 keys, 0 gaps), RTL
      layout, no leftover First Trip strings in either locale file.
- [x] SEO — `weemapsinai.com` metadataBase/OG/Twitter/schema.org, `robots.ts`,
      real-data-driven `sitemap.ts` (previously hardcoded mock ids — fixed
      this pass), new `manifest.ts`.

## Verified this pass

- [x] `npx tsx --test src/lib/pricing.test.ts` — 12/12 passing, covering every
      case in the spec (double/triple/single, seasonal boundary crossing,
      package formula, governorate change, bus↔hiace change, bus invalid-date
      block, price snapshot immutability).
- [x] `npx tsc --noEmit` — clean, no errors.
- [x] `npm run lint` — 0 errors (37 pre-existing style warnings, unchanged from
      before this pass — all `window.location.href` navigation warnings and
      2 unused-import warnings, none introduced by this session).
- [x] `npm run build` — succeeds, all ~38 routes compile (Google Fonts calls
      are stubbed **only** inside this sandbox's build check because its
      network blocks `fonts.googleapis.com`; the committed code is untouched
      and Vercel's build has normal internet access).

## Still open — needs the owner or external access

1. **Domain** — add `weemapsinai.com` to the existing Vercel project, set
   `NEXT_PUBLIC_SITE_URL`, then redirect `firsttrip-eg.com` → `weemapsinai.com`
   once DNS is live. (No hosting/DNS access from this session.)
2. **Migrations** — confirm `supabase/migrations/004_weemap_pricing_engine_v2.sql`
   and `005_weemap_website_cms.sql` have both been run against the production
   database (this session has no direct DB credentials to verify).
3. **Brand assets** — production logo SVG, `public/logo.png` + favicon
   regeneration, dedicated 1200×630 OG share image. See `WEEMAP_ASSET_CHECKLIST.md`.
4. **Verified business facts** — phone, WhatsApp, Facebook, founding-year
   claims are still TBD in `WEEMAP_INFO.md`; nothing unverified is published.
5. **Real content** — replace seeded placeholder testimonials (they mention
   First Trip) from the dashboard's Testimonials tab; enter real triple-room
   and seasonal prices per accommodation; set `package_price` on the two
   trips used as included package trips.
6. **Canonical/hreflang tags** — deliberately not added this pass. The
   `as-needed` locale prefix (Arabic has no `/ar/` prefix, English does)
   makes this easy to get subtly wrong without per-route testing; worth a
   dedicated pass rather than a guess.
7. **Payment gateway** — intentionally out of scope per spec (manual
   payment-status tracking only, no online gateway).

## How to re-verify locally

```bash
npm install
npx tsx --test src/lib/pricing.test.ts   # pricing engine
npx tsc --noEmit                          # typecheck
npm run lint                              # lint
npm run build                             # production build
```

Note: if building on a machine with a Windows checkout, run
`git config core.autocrlf true` once — without it, `git status`/`diff` will
show nearly every tracked file as "modified" (CRLF vs. the LF stored in the
repo), which is noise, not real changes.
