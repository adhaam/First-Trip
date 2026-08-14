import { NavItem, ServiceItem, WhyUsPoint } from './types'

export const SITE_NAME = 'First Trip'
export const SITE_DESCRIPTION_AR = 'First Trip – رحلات منظمة لدهب | باقات سياحية شاملة | حجز فنادق وشاليهات وكمبات في دهب، جنوب سيناء'
export const SITE_DESCRIPTION_EN = 'First Trip – Organized trips to Dahab | All-inclusive packages | Hotels, chalets & camps in Dahab, South Sinai'
export const WHATSAPP_NUMBER = '+201005744083'
export const PHONE_NUMBER = '+201005744083'
export const EMAIL = 'info@firsttrip-eg.com'

export const NAV_ITEMS: NavItem[] = [
  { label_ar: 'الرئيسية', label_en: 'Home', href: '/', icon: '🏠' },
  { label_ar: 'احجز دهب', label_en: 'Book Dahab', href: '/book-dahab', icon: '📅' },
  { label_ar: 'رحلات سيناء', label_en: 'Sinai Trips', href: '/sinai-trips', icon: '🏜️' },
  { label_ar: 'المجتمع', label_en: 'Community', href: '/community', icon: '👥' },
  { label_ar: 'كن شريكاً', label_en: 'Partner With Us', href: '/partner', icon: '🤝' },
  { label_ar: 'عن الشركة', label_en: 'About Us', href: '/about', icon: '📖' },
  { label_ar: 'ميرش', label_en: 'Merch', href: '/merch', icon: '🛍️' },
  { label_ar: 'إيجار', label_en: 'Rent', href: '/rent', icon: '🔑' },
  { label_ar: 'السياسة والاسترداد', label_en: 'Policy & Refund', href: '/policy', icon: '📋' },
]

export const NAV_LABEL_KEYS: Record<string, string> = {
  '/': 'home',
  '/book-dahab': 'book',
  '/sinai-trips': 'trips',
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

export const WHY_US: WhyUsPoint[] = [
  {
    title_ar: 'مش شركة سياحة عادية',
    title_en: 'Not Your Average Agency',
    description_ar: 'إحنا كوميونيتي بننظم رحلات لدهب من 2017. عارفين كل نول، وكل صاحب كامب، وكل زاوية في البلد.',
    description_en: 'We\'re a community running trips to Dahab since 2017. We know every driver, every camp owner, every corner of the town.',
    icon: '🌊',
  },
  {
    title_ar: 'مواعيد ثابتة كل أسبوع',
    title_en: 'Fixed Weekly Rhythm',
    description_ar: 'كل أحد وخميس بنقوم — من غير شيلة رأس ولا مواعيد بتتلغي.',
    description_en: 'Every Sunday and Thursday, on the dot. No cancellations, no confusion.',
    icon: '🗓️',
  },
  {
    title_ar: 'أماكن اخترناها بنفسنا',
    title_en: 'Places We\'ve Stayed In',
    description_ar: 'كل كامب وكل فندق في القائمة إحنا مش بس زرناه — إحنا قعدنا فيه.',
    description_en: 'Every camp and hotel in our list — we didn\'t just visit, we\'ve stayed.',
    icon: '🏕️',
  },
  {
    title_ar: 'صحبة قبل أي حاجة',
    title_en: 'Vibes First, Always',
    description_ar: 'رحلاتنا مش برنامج — دي أيام هتفضل تحكي عنها. الناس بترجع منها بصحاب جداد.',
    description_en: 'Our trips aren\'t itineraries — they\'re days you\'ll keep talking about. People leave with new friends.',
    icon: '✨',
  },
]

// Testimonials now live in Supabase (`testimonials` table) and are managed from
// the dashboard — see getTestimonials() in lib/data.ts.

/**
 * The 4 promises that anchor the brand — shown as the home page trust bar and
 * used across other pages as a hover-badge row. Wording is intentional; each
 * one answers a specific first-time visitor doubt.
 */
export const TRUST_STATS = [
  {
    icon: '🎯',
    label_ar: '10 سنوات خبرة',
    label_en: '10 Years Experience',
    sub_ar: 'من 2017 وإحنا في السوق',
    sub_en: 'In the market since 2017',
  },
  {
    icon: '✨',
    label_ar: 'تنظيم رحلات احترافي',
    label_en: 'High Quality Tour Operation',
    sub_ar: 'كل تفصيلة مضبوطة — من الباب للباب',
    sub_en: 'Every detail is perfect — door to door',
  },
  {
    icon: '🤝',
    label_ar: 'استضافة زي الأصحاب',
    label_en: 'Hosted Like a Friend',
    sub_ar: 'مش عميل، إنت واحد مننا',
    sub_en: 'You\'re not a number but one of us',
  },
  {
    icon: '🌱',
    label_ar: 'بنرد للمجتمع المحلي',
    label_en: 'Giving Back to Local Communities',
    sub_ar: 'شغّالين مع أهل دهب مش عليهم',
    sub_en: 'Working with Dahab locals, not around them',
  },
]

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