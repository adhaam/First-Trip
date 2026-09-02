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
    // Optimisation is ON. It was previously disabled site-wide, which meant a
    // 2 MB hero PNG and a 304 KB logo were shipped to every visitor at full
    // size with no srcset and no modern format.
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
