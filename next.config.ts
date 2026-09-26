import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Launch security headers (M4). Deliberately no script-src/style-src policy:
// GTM, the Meta Pixel, Vercel Analytics, JSON-LD and Next's inline bootstrap
// would all need nonces, which force dynamic rendering of every page. The
// directives below are the ones that cost nothing and block real attacks:
// clickjacking (frame-ancestors), <base> hijacking, plugin content and forms
// posting off-site.
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
]

// The Operations Center: never cached by a shared cache, never indexed.
const PRIVATE_HEADERS = [
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/api/admin/:path*', headers: PRIVATE_HEADERS },
      { source: '/admin/:path*', headers: PRIVATE_HEADERS },
      { source: '/admin', headers: PRIVATE_HEADERS },
      { source: '/:locale(en|ar)/admin/:path*', headers: PRIVATE_HEADERS },
      { source: '/:locale(en|ar)/admin', headers: PRIVATE_HEADERS },
    ]
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.weemapsinai.com' }],
        destination: 'https://weemapsinai.com/:path*',
        permanent: true,
      },
      // WEEMAP Editions replaces the public "Signature" landing/build entry
      // points. `/:locale(en|ar)` only matches a request that actually
      // carries a locale segment — Arabic (the default locale, localePrefix
      // 'as-needed', see src/i18n/routing.ts) is served with NO /ar prefix,
      // so the exact, unprefixed source below covers Arabic while the
      // locale-matcher source covers English (and a future non-default
      // locale) in one pass. `/signature/[slug]` (historical experience
      // links) is deliberately NOT redirected — these sources only match
      // the exact landing/build paths, never a slug suffix.
      {
        source: '/signature',
        destination: '/editions',
        permanent: true,
      },
      {
        source: '/:locale(en|ar)/signature',
        destination: '/:locale/editions',
        permanent: true,
      },
      {
        source: '/signature/build',
        destination: '/editions/custom',
        permanent: true,
      },
      {
        source: '/:locale(en|ar)/signature/build',
        destination: '/:locale/editions/custom',
        permanent: true,
      },
    ]
  },
  images: {
    // ─── The optimiser is OFF everywhere. EMERGENCY HOTFIX. ───
    // Vercel's Image Optimization quota for this account is exhausted, so
    // every `/_next/image` request on production answered:
    //   HTTP 402  OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
    // which broke 111 of the 114 images on the live homepage — the hero
    // poster and every accommodation, trip, community and Supabase image.
    // Only the brand logo survived, because it already bypassed the optimiser.
    //
    // With this flag every image is served straight from /public or from its
    // remote host, exactly as the site behaved before the ad-readiness pass.
    //
    // Almost none of the media win is lost: it came from re-encoding the
    // assets, not from the optimiser — heroposter 2,097 KB -> 74 KB WebP,
    // logo 304 KB -> 41 KB WebP, hero video 3,608 KB -> 236 KB WebM with the
    // audio track stripped, and the video is still desktop-gated. What is
    // given up is per-device srcset and AVIF negotiation.
    //
    // A protected Preview also cannot reach `/_next/image` (it answers 302 to
    // the Vercel SSO page), so this single flag covers that case too.
    //
    // To turn optimisation back on, raise the Vercel image quota first, then
    // set this to `process.env.VERCEL_ENV === 'preview'` so Previews stay
    // reviewable while production optimises.
    unoptimized: true,

    // Kept for the day optimisation is re-enabled. `formats` and
    // `remotePatterns` are inert while `unoptimized` is true, but a remote src
    // on an unlisted hostname would make next/image throw the moment it is
    // switched back on — so components rendering owner-entered images use
    // <SafeImage> (src/components/SafeImage.tsx). Keep OPTIMIZABLE_HOSTS in
    // that file in sync with this list.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default withNextIntl(nextConfig);
