import type { PostCategory } from './types'

export const POST_CATEGORIES = [
  'stories',
  'dahab-guide',
  'sinai-guide',
  'hidden-gems',
  'diving',
  'freediving',
  'climbing',
  'hiking',
  'watersports',
  'history',
  'culture',
  'itineraries',
  'advanced-adventure',
  'blog',
] as const satisfies readonly PostCategory[]

export const POST_CATEGORY_LABELS: Record<PostCategory, { ar: string; en: string }> = {
  stories: { ar: 'قصص', en: 'Stories' },
  'dahab-guide': { ar: 'دليل دهب', en: 'Dahab Guide' },
  'sinai-guide': { ar: 'دليل سينا', en: 'Sinai Guide' },
  'hidden-gems': { ar: 'أماكن مخفية', en: 'Hidden Gems' },
  diving: { ar: 'غوص', en: 'Diving' },
  freediving: { ar: 'غوص حر', en: 'Freediving' },
  climbing: { ar: 'تسلق', en: 'Climbing' },
  hiking: { ar: 'هايكينج', en: 'Hiking' },
  watersports: { ar: 'رياضات مائية', en: 'Watersports' },
  history: { ar: 'تاريخ', en: 'History' },
  culture: { ar: 'ثقافة', en: 'Culture' },
  itineraries: { ar: 'برامج رحلات', en: 'Itineraries' },
  'advanced-adventure': { ar: 'مغامرات متقدمة', en: 'Advanced Adventure' },
  blog: { ar: 'مقالات', en: 'Journal' },
}
