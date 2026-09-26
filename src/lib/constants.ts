import { NavItem, ServiceItem } from './types'

export const SITE_NAME = 'WEEMAP SINAI'
export const SITE_DESCRIPTION_AR = 'WEEMAP SINAI – رحلات منظمة لدهب وسيناء | باقات سياحية شاملة | حجز فنادق وشاليهات وكمبات في دهب، جنوب سيناء'
export const SITE_DESCRIPTION_EN = 'WEEMAP SINAI – Organized trips to Dahab & Sinai | All-inclusive packages | Hotels, chalets & camps in Dahab, South Sinai'
export const WHATSAPP_NUMBER = '+201005744083'
export const PHONE_NUMBER = '+201005744083'
export const EMAIL = 'info@weemapsinai.com'

// `icon` is a Lucide key, resolved by NAV_ICONS in the Header. Emoji were used
// here before: they render differently on every platform, never take the brand
// colour, and are read out literally by screen readers.
//
// IA per docs/m2/BRIEF.md: primary nav is Stay · Explore · Editions · Shop ·
// Rent, plus the "Build your trip" CTA. `primary` marks the four plain links
// that sit directly in the desktop bar (Stay, Editions, Shop, Rent) — Explore
// is a popover the Header renders separately, and Build your trip is the
// distinctly-styled CTA button, so neither is `primary`. `popover` marks the
// three items listed inside that Explore popover. `group` drives the mobile
// drawer's section headings, which is why Editions appears there under
// "Explore" even though it also gets its own primary desktop link. Editions
// replaced the public Signature entry point (/signature now redirects, see
// next.config.ts) — historical /signature/[slug] experience links still work.
export const NAV_ITEMS: NavItem[] = [
  { href: '/plan', icon: 'compass', group: 'plan', cta: true },
  { href: '/book-dahab', icon: 'bed', primary: true, group: 'plan' },
  { href: '/sinai-trips', icon: 'mountain', group: 'explore', popover: true, descriptionKey: 'tripsDesc' },
  { href: '/sinai-trips/packages', icon: 'package', group: 'explore', popover: true, descriptionKey: 'packagesDesc' },
  { href: '/community', icon: 'users', group: 'explore', popover: true, descriptionKey: 'communityDesc' },
  { href: '/editions', icon: 'sparkles', primary: true, group: 'explore' },
  { href: '/merch', icon: 'bag', primary: true, group: 'shop' },
  { href: '/rent', icon: 'bike', primary: true, group: 'shop' },
  { href: '/about', icon: 'book', group: 'weemap' },
  { href: '/partner', icon: 'handshake', group: 'weemap' },
  { href: '/policy', icon: 'shield', group: 'weemap' },
]

/** href -> key in the `ia` message namespace. */
export const NAV_LABEL_KEYS: Record<string, string> = {
  '/plan': 'buildTrip',
  '/book-dahab': 'stay',
  '/sinai-trips': 'trips',
  '/sinai-trips/packages': 'packages',
  '/community': 'community',
  '/editions': 'editions',
  '/merch': 'shop',
  '/rent': 'rent',
  '/about': 'about',
  '/partner': 'partner',
  '/policy': 'policy',
}

export const SERVICES: ServiceItem[] = [
  {
    title_ar: 'الباقة الكاملة',
    title_en: 'The Full Trip',
    description_ar: 'انتقالات، إقامة، ورحلتين داخل سيناء — إنت بس تنزل من العربية.',
    description_en: 'Transportation, accommodation, and two day trips in Sinai - all you have to do is show up.',
    icon: 'target',
    href: '/book-dahab',
  },
  {
    title_ar: 'الإقامة بس',
    title_en: 'Accommodation Only',
    description_ar: 'كامب على البحر، شاليه هادي، أو فندق فخم — على مزاجك.',
    description_en: 'A camp on the sea, a quiet chalet, or a proper hotel — your call.',
    icon: 'hotel',
    href: '/book-dahab',
  },
  {
    title_ar: 'الانتقالات بس',
    title_en: 'Transportation Only',
    description_ar: 'هايس خاص من محافظتك لدهب — مواعيدك إنت.',
    description_en: 'A private Hiace from your city to Dahab — on your schedule.',
    icon: 'van',
    href: '/book-dahab',
  },
  {
    title_ar: 'رحلات سيناء',
    title_en: 'Sinai Adventures',
    description_ar: 'بلو هول، الوادي الملون، جبل موسى، سفاري — الأماكن اللي بتكسر روتين المدينة.',
    description_en: 'Blue Hole, Colored Canyon, Mt. Sinai, safari — places that break your routine.',
    icon: 'mountain',
    href: '/sinai-trips',
  },
]

// Testimonials now live in Supabase (`testimonials` table) and are managed from
// the dashboard — see getTestimonials() in lib/data.ts.

// Governorates + their transfer surcharges now live in Supabase
// (`transfer_governorate_pricing`), separately per transfer type, and are
// managed from the dashboard's "النقل" tab. Nothing here is hardcoded so that
// changing a price never requires a deploy.

export const ACCOMMODATION_TAGS: Record<string, { label_ar: string; label_en: string; emoji: string }> = {
  hotel: { label_ar: 'فندق', label_en: 'Hotel', emoji: '🏨' },
  chalet: { label_ar: 'شاليه', label_en: 'Chalet', emoji: '🏖️' },
  camp: { label_ar: 'كامب', label_en: 'Camp', emoji: '🏕️' },
}

// Temp placeholder images from Unsplash (Dahab, Red Sea, Egypt)
export const PLACEHOLDER_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80', // Dahab coast
  dahab1: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', // Tropical beach
  dahab2: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&q=80', // Blue Hole
  dahab3: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80', // Red Sea
  desert1: 'https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80', // Sinai desert
  desert2: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80', // Desert sunset
  diving: 'https://images.unsplash.com/photo-1544551763-92ab472dec22?w=800&q=80', // Diving
  camping: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', // Camping
  mountain: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', // Mountain
}
