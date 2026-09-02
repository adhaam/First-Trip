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
    // ─── Preview deployments opt out of the optimiser ───
    // `/_next/image` is a Vercel function. On a deployment with Deployment
    // Protection enabled — which every Preview here has — it answers with a
    // 302 to the Vercel SSO page instead of an image. An <img> that follows
    // that redirect gets HTML back, cannot decode it, and renders the
    // browser's broken-image icon. Verified on the ad-readiness Preview:
    //   /brand/logo.webp                                    -> 200 image/webp
    //   /_next/image?url=%2Fbrand%2Flogo.webp&w=256&q=75     -> 302 -> SSO
    // So on Preview the images are served straight from the CDN, exactly as
    // they were before this pass, which keeps Previews reviewable. Production
    // is unprotected and keeps full AVIF/WebP optimisation — the 95% first-load
    // media reduction is unaffected. The production path is still exercised
    // locally by `next build && next start`.
    unoptimized: process.env.VERCEL_ENV === 'preview',

    // Optimisation is ON in production. It was previously disabled site-wide,
    // which meant a 2 MB hero PNG and a 304 KB logo were shipped to every
    // visitor at full size with no srcset and no modern format.
    //
    // The sharp edge: once the optimiser is active, a remote src on a hostname
    // that is not listed below makes next/image throw and takes the page down.
    // Accommodation, trip and product images are owner-entered, so components
    // that render them use <SafeImage> (src/components/SafeImage.tsx), which
    // falls back to serving an unknown host as-is instead of crashing.
    // Keep OPTIMIZABLE_HOSTS in that file in sync with this list.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default withNextIntl(nextConfig);
