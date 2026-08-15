# WEEMAP SINAI — Completion Checklist

Snapshot of what's done, what's verified, and what's left before launch.
See `WEEMAP_REBRAND.md` for the full working log (Phases 1–8) and
`WEEMAP_ASSET_CHECKLIST.md` for outstanding assets/facts.

## Product — done

- [x] Public branding: zero "First Trip" references in `src/` or `package.json`
      (only intentional code comments and historical, already-run SQL files keep
      the old name — documented in WEEMAP_REBRAND.md).
- [x] Pricing engine v2 — triple rooms, night-by-night seasonal pricing,
      trip public vs. package price, historical price snapshots, server-side
      only (`src/lib/pricing.ts`, wired into both the public and admin booking APIs).
      Migrations 004 + 005 confirmed applied in production.
- [x] Video-first hero — `public/media/herovideo.mp4` + `heroposter.png`,
      autoplay/muted/loop/playsInline, poster fallback, reduced-motion support,
      transparent-over-hero header. Re-verified this pass across desktop/mobile
      sizing, EN/AR (RTL-safe overlay + logical spacing), and reduced-motion.
- [x] WEEMAP Business Control Center admin — Overview (real KPIs, date
      filters, Upcoming Arrivals, Attention Required), Bookings (status,
      payment tracking, price-snapshot breakdown, source, CSV export),
      Accommodations (rooms & seasonal pricing editor, Booking.com importer),
      Trips (public/package price), Transfers (governorate × mode matrix,
      bus schedule), Website CMS (hero copy, featured content, section
      toggles, SEO fields).
- [x] Localization — English/Arabic key parity (177/177 keys, 0 gaps), RTL
      layout, no leftover First Trip strings in either locale file.
- [x] SEO, finalized this pass:
      - **Canonical + hreflang** on every public route (home, book-dahab list +
        detail, sinai-trips, community, about, partner, policy, merch, rent) via
        `src/lib/seo.ts` (`buildAlternates`), built on next-intl's own
        `getPathname` so `localePrefix: 'as-needed'` (Arabic has no `/ar`
        prefix, English is under `/en`) is handled correctly rather than
        hand-rolled.
      - **`sitemap.ts` bug fix**: every URL was being built as
        `/${locale}${page}`, which produces `/ar/...` for the default locale —
        URLs that don't actually resolve under `as-needed` routing. Now uses
        the same `getPathname` helper; also added the missing `/merch` and
        `/rent` entries and kept the real-accommodation-id fix from last pass.
      - **`robots.ts`**: now blocks both locale forms of `/admin/`
        (`/admin/` and `/en/admin/` — previously only the prefix-less one was
        listed) and reads the sitemap URL from the same `SITE_URL` constant.
      - **`manifest.ts`** (added last pass) still generates cleanly.
      - **OpenGraph**: added `alternateLocale` (og:locale:alternate).
      - **Product schema**: `getProductSchema()` existed but was never called;
        now wired into `/book-dahab/[id]` with a real per-accommodation
        name/description/image/starting price.
      - **`schema-org.ts` bug fix**: the organization JSON-LD had a hardcoded
        fake placeholder phone number (`+20-100-000-0000`, obviously not a
        real number). `getSchemaOrg()` now takes Site Settings and uses the
        same real-operating-number fallback pattern as the footer/WhatsApp
        button — nothing invented, nothing fake shipped in structured data.
      - **Contact fields audit**: found and fixed one more hardcoded WhatsApp
        link (`book-dahab/page.tsx` had a literal `wa.me/201005744083` instead
        of reading Site Settings like everywhere else). No other hardcoded
        contact values found — `mock-data.ts` is confirmed unused/unimported
        anywhere in the app.

## Verified this pass

- [x] `npx tsx --test src/lib/pricing.test.ts` — 12/12 passing.
- [x] `npx tsc --noEmit` — clean, no errors.
- [x] `npm run lint` — 0 errors (37 pre-existing style warnings, unchanged;
      none introduced by this session's changes).
- [x] `npm run build` — succeeds, all ~39 routes compile including the newly
      split `about`/`partner`/`policy`/`merch`/`rent` server-wrapper pages
      (Google Fonts calls are stubbed **only** inside this sandbox's build
      check because its network blocks `fonts.googleapis.com`; the committed
      code is untouched and Vercel's build has normal internet access).
- [x] Repo-wide grep for `First Trip`/`FirstTrip`/`firsttrip` — same 14
      pre-existing, intentional matches as last pass (docs, one code comment,
      already-run legacy SQL headers), nothing new.

## Still open — needs the owner or external access

1. **Domain** — add `weemapsinai.com` to the existing Vercel project, set
   `NEXT_PUBLIC_SITE_URL`, then redirect `firsttrip-eg.com` → `weemapsinai.com`
   once DNS is live. (No hosting/DNS access from this session.)
2. **Seeded placeholder testimonials** — `supabase/migration_v3.sql` seeded 3
   testimonials, 2 of which literally say "First Trip" in the review text
   (`testimonials.text_ar` / `text_en`). These are very likely still live on
   the homepage right now. This session has no database credentials to check
   or remove them — see the ready-to-run SQL below, or delete/replace them
   from the dashboard's Testimonials tab.
3. **Brand assets** — production logo SVG, `public/logo.png` + favicon
   regeneration (current placeholders confirmed to already be WEEMAP-branded,
   not First Trip — verified visually this pass), dedicated 1200×630 OG share
   image. See `WEEMAP_ASSET_CHECKLIST.md`.
4. **Verified business facts** — phone, WhatsApp, Facebook, founding-year
   claims are still TBD in `WEEMAP_INFO.md`; nothing unverified is published,
   everything falls back to the real currently-operating number/handle.
5. **Real content** — enter real triple-room and seasonal prices per
   accommodation; set `package_price` on the two trips used as included
   package trips.
6. **Payment gateway** — intentionally out of scope per spec (manual
   payment-status tracking only, no online gateway).

### Ready-to-run SQL — remove the "First Trip" placeholder testimonials

Non-destructive to anything else: matches only rows whose text contains the
literal string "First Trip". Review the `SELECT` output first; the `DELETE`
is commented out on purpose.

```sql
-- 1. Review what would be affected:
SELECT id, name, text_ar, text_en, created_at
FROM testimonials
WHERE text_ar ILIKE '%First Trip%' OR text_en ILIKE '%First Trip%';

-- 2. Once you've confirmed the rows above are the placeholders, uncomment
--    and run this to remove them:
-- DELETE FROM testimonials
-- WHERE text_ar ILIKE '%First Trip%' OR text_en ILIKE '%First Trip%';
```

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
