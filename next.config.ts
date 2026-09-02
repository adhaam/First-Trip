import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.weemapsinai.com' }],
        destination: 'https://weemapsinai.com/:path*',
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
