import Image, { type ImageProps } from 'next/image'

/**
 * `next/image` with a guard for owner-supplied URLs.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * The project previously ran with `images: { unoptimized: true }`, which meant
 * every image — including a 2 MB hero PNG — was served to the browser at its
 * original size and format, with no `srcset` and no WebP/AVIF negotiation.
 *
 * Turning optimisation on is a very large win, but it comes with a sharp edge:
 * once the optimiser is active, a remote `src` whose hostname is not listed in
 * `images.remotePatterns` makes `next/image` throw, which takes the whole page
 * down. Accommodation, trip, product and community images are all owner-entered
 * from the dashboard. They normally live in Supabase storage, but nothing stops
 * an admin pasting a URL from somewhere else, and that must not be able to
 * break a live listing page.
 *
 * So: images on a known-good host are optimised, and anything else falls back
 * to being served as-is — exactly the behaviour the site had before. The page
 * always renders.
 */

/**
 * Hosts the optimiser is allowed to fetch from. Must stay in sync with
 * `images.remotePatterns` in next.config.ts.
 */
const OPTIMIZABLE_HOSTS: RegExp[] = [
  /(^|\.)supabase\.co$/,
  /^images\.unsplash\.com$/,
]

export function canOptimize(src: ImageProps['src']): boolean {
  // Static imports and blob/data sources are handled by the bundler.
  if (typeof src !== 'string') return true
  // Anything served from our own /public directory.
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:') return false
    return OPTIMIZABLE_HOSTS.some((pattern) => pattern.test(url.hostname))
  } catch {
    return false
  }
}

export function SafeImage({ unoptimized, ...props }: ImageProps) {
  // `alt` is required by ImageProps and arrives through the spread — the
  // jsx-a11y rule cannot see through a wrapper component, so it is silenced
  // here rather than weakened globally.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} unoptimized={unoptimized ?? !canOptimize(props.src)} />
}
