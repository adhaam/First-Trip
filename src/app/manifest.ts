import type { MetadataRoute } from 'next'

// Basic web app manifest — installable "Add to Home Screen" metadata for
// mobile visitors coming from Instagram/WhatsApp. Icons use the official
// WEEMAP SINAI brand pack (icon-only mark).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WEEMAP SINAI',
    short_name: 'WEEMAP',
    description: 'We map Sinai. You live it. Packages, stays, transfers, and Sinai trips.',
    start_url: '/',
    display: 'standalone',
    background_color: '#141310',
    theme_color: '#141310',
    icons: [
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    ],
  }
}
