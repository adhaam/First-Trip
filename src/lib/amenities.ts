import { Waves, Wifi, Utensils, Thermometer, TreePine, type LucideIcon } from 'lucide-react'

export interface AmenityDef {
  ar: string
  en: string
  icon: LucideIcon
}

// Single source of truth for the amenity pool — used by the admin picker
// (AccommodationManager) and the public product page (ProductDetailClient)
// so an amenity always renders with the same icon everywhere. Keep these
// exact ar/en strings stable: existing accommodations already store them
// verbatim in amenities_ar / amenities_en.
export const AMENITIES_LIBRARY: AmenityDef[] = [
  { ar: 'حمام سباحة', en: 'Swimming Pool', icon: Waves },
  { ar: 'واي فاي مجاني', en: 'Free WiFi', icon: Wifi },
  { ar: 'إفطار مجاني', en: 'Free Breakfast', icon: Utensils },
  { ar: 'إطلالة على البحر', en: 'Sea View', icon: Waves },
  { ar: 'تكييف', en: 'Air Conditioning', icon: Thermometer },
  { ar: 'مطبخ مجهز', en: 'Equipped Kitchen', icon: Utensils },
  { ar: 'حديقة خاصة', en: 'Private Garden', icon: TreePine },
  { ar: 'مباشرة على البحر', en: 'Beachfront', icon: Waves },
  { ar: 'شواية باربيكيو', en: 'BBQ Grill', icon: Utensils },
  { ar: 'جلسة بدوية', en: 'Bedouin Seating', icon: TreePine },
  { ar: 'شاي بدوي مجاني', en: 'Free Bedouin Tea', icon: TreePine },
  { ar: 'حمام سباحة دافء', en: 'Heated Pool', icon: Waves },
  { ar: 'مركز غوص خاص', en: 'Private Dive Center', icon: Waves },
  { ar: 'شاطئ خاص', en: 'Private Beach', icon: Waves },
  { ar: 'جيم وسبا', en: 'Gym & Spa', icon: Thermometer },
  { ar: 'بوفيه مفتوح', en: 'Open Buffet', icon: Utensils },
]

export function buildAmenityIconMap(): Record<string, LucideIcon> {
  const map: Record<string, LucideIcon> = {}
  for (const a of AMENITIES_LIBRARY) {
    map[a.ar] = a.icon
    map[a.en] = a.icon
  }
  return map
}
