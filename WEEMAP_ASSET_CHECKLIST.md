# WEEMAP SINAI — Asset & Info Checklist

Final assets and verified facts still needed before launch. Nothing here blocks
development — placeholders are in place and clearly marked in code.

## Visual assets

- [ ] **Production logo (SVG)** — the approved direction is
  `_weemap_reference/01_brand/logo/weemap-sinai-logo-brand-board.png`
  (location-pin + hand + Sinai mountain, WEEMAP orange). No clean vector exists yet.
  Currently `src/components/brand/Logo.tsx` renders a styled orange pin + the
  "WEEMAP SINAI" wordmark in the site's display face. Replacing the mark only
  touches that one file.
- [ ] **`public/logo.png`** — still the old First Trip artwork; used for
  apple-touch-icon and OG share image. Export a square WEEMAP mark to replace it.
- [ ] **`src/app/favicon.ico`** — still First Trip; regenerate from the new mark.
- [ ] **Social share image (1200×630)** — dedicated OG image rather than the logo square.
- [x] **Hero video** — `public/media/herovideo.mp4` (3.6MB) + `public/media/heroposter.png`
  (2.1MB poster/reduced-motion fallback) are the approved final cinematic plate and are live
  on the homepage (Phase 7 — see WEEMAP_REBRAND.md). Optional polish: the poster PNG could be
  re-exported as a compressed JPEG/WebP to shave its 2.1MB down, not blocking.
- [ ] **Photography library** — all `04_photography/*` folders are empty (.gitkeep only):
  roads, mountains, desert, sea, people, stays, trips.

## Verified business facts (currently TBD in WEEMAP_INFO.md)

- [ ] WEEMAP phone number (site currently keeps the operating number `+201005744083`)
- [ ] WEEMAP WhatsApp number
- [ ] Public email — code now uses `info@weemapsinai.com`; confirm the mailbox exists
- [ ] Facebook page URL (footer hides the Facebook icon until set in Site Settings)
- [ ] TikTok, if any
- [ ] Founding year / historical claims — all "since 2017" / "10 years" copy was removed;
  restore real numbers only after the owner verifies them
- [ ] Legal/display company name for policies pages

## Content to refresh from the dashboard (no code needed)

- [ ] Testimonials — the seeded placeholders mention First Trip; replace with real reviews
- [ ] Site Settings → contact details, Instagram (`weemapeg`), Facebook when ready
- [ ] Set `package_price` on the trips used as included package trips
- [ ] Enter triple-room base prices and seasonal periods per accommodation (after migration 004)

## Domain

- [ ] Buy/point `weemapsinai.com`; add to the existing Vercel project
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://weemapsinai.com` in Vercel env
- [ ] When DNS is live, add permanent redirect `firsttrip-eg.com` → `weemapsinai.com`
