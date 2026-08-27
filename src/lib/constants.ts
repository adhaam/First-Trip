import { NavItem, ServiceItem } from './types'

export const SITE_NAME = 'WEEMAP SINAI'
export const SITE_DESCRIPTION_AR = 'WEEMAP SINAI – رحلات منظمة لدهب وسيناء | باقات سياحية شاملة | حجز فنادق وشاليهات وكمبات في دهب، جنوب سيناء'
export const SITE_DESCRIPTION_EN = 'WEEMAP SINAI – Organized trips to Dahab & Sinai | All-inclusive packages | Hotels, chalets & camps in Dahab, South Sinai'
export const WHATSAPP_NUMBER = '+201005744083'
export const PHONE_NUMBER = '+201005744083'
export const EMAIL = 'info@weemapsinai.com'

export const NAV_ITEMS: NavItem[] = [
  { label_ar: 'الرئيسية', label_en: 'Home', href: '/', icon: '🏠' },
  { label_ar: 'احجز دهب', label_en: 'Book Dahab', href: '/book-dahab', icon: '📅' },
  { label_ar: 'رحلات سيناء', label_en: 'Sinai Trips', href: '/sinai-trips', icon: '🏜️' },
  { label_ar: 'Signature Experiences', label_en: 'Signature Experiences', href: '/signature', icon: '✨' },
  { label_ar: 'المتجر', label_en: 'Merch', href: '/merch', icon: '🛍️' },
  { label_ar: 'الإيجارات', label_en: 'Rental', href: '/rent', icon: '🚲' },
  { label_ar: 'المجتمع', label_en: 'Community', href: '/community', icon: '👥' },
  { label_ar: 'كن شريكاً', label_en: 'Partner With Us', href: '/partner', icon: '🤝' },
  { label_ar: 'عن الشركة', label_en: 'About Us', href: '/about', icon: '📖' },
  { label_ar: 'السياسة والاسترداد', label_en: 'Policy & Refund', href: '/policy', icon: '📋' },
]

export const NAV_LABEL_KEYS: Record<string, string> = {
  '/': 'home',
  '/book-dahab': 'book',
  '/sinai-trips': 'trips',
  '/signature': 'signature',
  '/community': 'community',
  '/partner': 'partner',
  '/about': 'about',
  '/merch': 'merch',
  '/rent': 'rent',
  '/policy': 'policy',
}

export const SERVICES: ServiceItem[] = [
  {
    title_ar: 'الباقة الكاملة',
    title_en: 'The Full Trip',
    description_ar: 'انتقالات، إقامة، ورحلتين داخل سيناء — إنت بس تنزل من العربية.',
    description_en: 'Transportation, accommodation, and two day trips in Sinai - all you have to do is show up.',
    icon: '🎯',
    href: '/book-dahab',
  },
  {
    title_ar: 'الإقامة بس',
    title_en: 'Accommodation Only',
    description_ar: 'كامب على البحر، شاليه هادي، أو فندق فخم — على مزاجك.',
    description_en: 'A camp on the sea, a quiet chalet, or a proper hotel — your call.',
    icon: '🏨',
    href: '/book-dahab',
  },
  {
    title_ar: 'الانتقالات بس',
    title_en: 'Transportation Only',
    description_ar: 'هايس خاص من محافظتك لدهب — مواعيدك إنت.',
    description_en: 'A private Hiace from your city to Dahab — on your schedule.',
    icon: '🚐',
    href: '/book-dahab',
  },
  {
    title_ar: 'رحلات سيناء',
    title_en: 'Sinai Adventures',
    description_ar: 'بلو هول، الوادي الملون، جبل موسى، سفاري — الأماكن اللي بتكسر روتين المدينة.',
    description_en: 'Blue Hole, Colored Canyon, Mt. Sinai, safari — places that break your routine.',
    icon: '🏜️',
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
