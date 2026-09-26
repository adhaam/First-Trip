// Human labels for the admin-only EDITION_CATEGORIES / EDITION_STATUSES enums.
// Stored values (EditionCategory / EditionStatus) never change — these are
// display-only, reusing the same wording as src/messages/*/editions.json's
// public "filters"/"status" namespaces, plus the admin-only HIDDEN status
// which never appears on a public page.
import type { EditionCategory, EditionRequestIntent, EditionStatus } from '@/lib/editions'

export const EDITION_CATEGORY_LABELS: Record<EditionCategory, { en: string; ar: string }> = {
  LEARN: { en: 'Learn', ar: 'تعلّم' },
  RETREAT: { en: 'Retreat', ar: 'ريتريت' },
  ADVENTURE: { en: 'Adventure', ar: 'مغامرة' },
  MUSIC_EVENT: { en: 'Music & Events', ar: 'موسيقى وفعاليات' },
  SPECIAL: { en: 'Special experiences', ar: 'تجارب خاصة' },
}

export const EDITION_STATUS_LABELS: Record<EditionStatus, { en: string; ar: string }> = {
  COMING_SOON: { en: 'Coming Soon', ar: 'قريبًا' },
  OPEN: { en: 'Booking Open', ar: 'الحجز مفتوح' },
  GUARANTEED: { en: 'Departure Guaranteed', ar: 'الرحلة مؤكدة' },
  FEW_SPOTS: { en: 'Few Spots', ar: 'أماكن محدودة' },
  SOLD_OUT: { en: 'Sold Out', ar: 'اكتمل العدد' },
  WAITLIST: { en: 'Waitlist', ar: 'قائمة انتظار' },
  COMPLETED: { en: 'Completed', ar: 'انتهت' },
  HIDDEN: { en: 'Hidden', ar: 'مخفي' },
}

export const EDITION_REQUEST_INTENT_LABELS: Record<EditionRequestIntent, { en: string; ar: string }> = {
  JOIN: { en: 'Join', ar: 'احجز مكانك' },
  ASK: { en: 'Ask a question', ar: 'اسأل عن التجربة' },
  NOTIFY: { en: 'Notify me', ar: 'عرفني لما يفتح' },
}

export function editionCategoryLabel(category: EditionCategory, locale: string): string {
  return EDITION_CATEGORY_LABELS[category][locale === 'ar' ? 'ar' : 'en']
}

export function editionStatusLabel(status: EditionStatus, locale: string): string {
  return EDITION_STATUS_LABELS[status][locale === 'ar' ? 'ar' : 'en']
}

export function editionRequestIntentLabel(intent: EditionRequestIntent, locale: string): string {
  return EDITION_REQUEST_INTENT_LABELS[intent][locale === 'ar' ? 'ar' : 'en']
}
