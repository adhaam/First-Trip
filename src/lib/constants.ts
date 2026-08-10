import { NavItem, ServiceItem, Testimonial, WhyUsPoint } from './types'

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
  { label_ar: 'السياسة والاسترداد', label_en: 'Policy & Refund', href: '/policy', icon: '📋' },
]

export const NAV_LABEL_KEYS: Record<string, string> = {
  '/': 'home',
  '/book-dahab': 'book',
  '/sinai-trips': 'trips',
  '/community': 'community',
  '/partner': 'partner',
  '/about': 'about',
  '/policy': 'policy',
}

export const SERVICES: ServiceItem[] = [
  {
    title_ar: 'باقات كاملة',
    title_en: 'Full Packages',
    description_ar: 'انتقالات + إقامة + رحلتين داخليتين — 4 أو 5 أيام من محافظتك لدهب',
    description_en: 'Transfer + Accommodation + 2 Internal Trips — 4 or 5 days from your governorate to Dahab',
    icon: '🎯',
    href: '/book-dahab',
  },
  {
    title_ar: 'إقامة فقط',
    title_en: 'Accommodation Only',
    description_ar: 'حجز فنادق، شاليهات، وكمبات في دهب — اختر عدد الليالي اللي يناسبك',
    description_en: 'Book hotels, chalets & camps in Dahab — choose how many nights',
    icon: '🏨',
    href: '/book-dahab',
  },
  {
    title_ar: 'انتقالات فقط',
    title_en: 'Transfers Only',
    description_ar: 'انتقالات من المحافظات لدهب والعكس — مواعيد ثابتة أو VIP خاص',
    description_en: 'Transfers from governorates to Dahab & back — fixed schedule or VIP private',
    icon: '🚐',
    href: '/book-dahab',
  },
  {
    title_ar: 'رحلات داخلية',
    title_en: 'Sinai Day Trips',
    description_ar: 'سفاري، غوص، بلو هول، جبل كاترين، وادي وشواشي، والمزيد',
    description_en: 'Safari, diving, Blue Hole, Mount Sinai, Wadi Washwashi & more',
    icon: '🏜️',
    href: '/sinai-trips',
  },
]

export const WHY_US: WhyUsPoint[] = [
  {
    title_ar: 'خبرة 6 سنوات',
    title_en: '6 Years Experience',
    description_ar: 'من 2017 بننظم رحلات لدهب — نعرف كل تفاصيل الرحلة من الألف للياء',
    description_en: 'Organizing Dahab trips since 2017 — we know every detail inside out',
    icon: '⭐',
  },
  {
    title_ar: 'رحلات منتظمة',
    title_en: 'Regular Trips',
    description_ar: 'رحلات ثابتة كل يوم أحد وخميس — أسبوعياً على مدار السنة',
    description_en: 'Fixed trips every Sunday & Thursday — weekly, year-round',
    icon: '🗓️',
  },
  {
    title_ar: 'فنادق منتقاة',
    title_en: 'Handpicked Hotels',
    description_ar: 'نتعاقد مع أفضل الفنادق والشاليهات والكمبات في دهب',
    description_en: 'We partner with the best hotels, chalets & camps in Dahab',
    icon: '🏆',
  },
  {
    title_ar: 'سعر تنافسي',
    title_en: 'Competitive Pricing',
    description_ar: 'أفضل الأسعار مع أعلى جودة خدمة — احجز بمقدم 50% فقط',
    description_en: 'Best prices with highest service quality — book with only 50% down payment',
    icon: '💰',
  },
]

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'أحمد محمد',
    text_ar: 'من أفضل الرحلات اللي روحتها في حياتي. التنظيم كان ممتاز وكل حاجة كانت مظبوطة من الأول للآخر. شكراً First Trip!',
    text_en: 'One of the best trips of my life. Organization was excellent and everything was perfect from start to finish. Thank you First Trip!',
    rating: 5,
  },
  {
    name: 'منى السيد',
    text_ar: 'رحلة عائلية رائعة مع First Trip. الأطفال استمتعوا جداً والفندق كان تحفة. هنكرر التجربة أكيد!',
    text_en: 'An amazing family trip with First Trip. The kids had so much fun and the hotel was gorgeous. We\'ll definitely do it again!',
    rating: 5,
  },
  {
    name: 'كريم الشافعي',
    text_ar: 'أفضل شركة تنظم رحلات لدهب بدون منازع. سافرت معاهم 3 مرات وكل مرة أحسن من اللي قبلها.',
    text_en: 'Hands down the best company for Dahab trips. Traveled with them 3 times and each time is better than the last.',
    rating: 5,
  },
]

export const TRUST_STATS = [
  { label_ar: 'سنوات الخبرة', label_en: 'Years Experience', value: '6', suffix_ar: 'سنوات', suffix_en: 'years' },
  { label_ar: 'عميل سعيد', label_en: 'Happy Customers', value: '500+', suffix_ar: 'عميل', suffix_en: 'customers' },
  { label_ar: 'رحلات أسبوعية', label_en: 'Weekly Trips', value: '2', suffix_ar: 'رحلات/أسبوع', suffix_en: 'trips/week' },
  { label_ar: 'مكان إقامة', label_en: 'Accommodations', value: '30+', suffix_ar: 'مكان', suffix_en: 'places' },
]

export const GOVERNORATES = [
  { id: 'cairo', name_ar: 'القاهرة', name_en: 'Cairo', surcharge: 0 },
  { id: 'alexandria', name_ar: 'الإسكندرية', name_en: 'Alexandria', surcharge: 200 },
  { id: 'zagazig', name_ar: 'الزقازيق', name_en: 'Zagazig', surcharge: 150 },
  { id: 'mansoura', name_ar: 'المنصورة', name_en: 'Mansoura', surcharge: 150 },
] as const

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