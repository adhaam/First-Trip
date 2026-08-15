import type { MetadataRoute } from 'next'

// Basic web app manifest — installable "Add to Home Screen" metadata for
// mobile visitors coming from Instagram/WhatsApp. Icons point at the current
// placeholder mark; swap once the real WEEMAP SVG lands (see
// WEEMAP_ASSET_CHECKLIST.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WEEMAP SINAI',
    short_name: 'WEEMAP',
    description: 'We map Sinai. You live it. Packages, stays, transfers, and Sinai trips.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a1220',
    theme_color: '#0a1220',
    icons: [
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
    ],
  }
}
