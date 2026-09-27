import type { DraftFields } from '@/lib/trip-requests/draft'
import type { MealPlan, TransferType } from '@/lib/types'
import type { PaymentPolicy } from '@/lib/payment-rules'
import type { TransportScheduleConfig } from '@/lib/transport'

export type BuilderState = DraftFields
export type CatalogAccommodation = { id: string; name_ar: string; name_en: string; type: string; tier?: string; image: string; images: string[]; rating: number; location_ar: string; location_en: string; latitude?: number; longitude?: number; from_price_per_person_per_night: number; meal_plans: MealPlan[]; room_upgrades: { id: string; name_ar: string; name_en: string; extra_price_per_night: number }[]; description_ar?: string; description_en?: string; amenities_ar?: string[]; amenities_en?: string[] }
export type CatalogTrip = { id: string; slug?: string; name_ar: string; name_en: string; image: string; duration_ar: string; duration_en: string; price: number; category_slugs: string[]; category_labels: { ar: string; en: string }[] }
export type CatalogPackage = { id: string; slug: string; name_ar: string; name_en: string; image: string; payment_kind: 'experience_package'; public_total?: number; package_total?: number; trip_count: number; trip_ids: string[] }
export type CatalogGovernorate = { code: string; name_ar: string; name_en: string; transfer_types: TransferType[] }
export type CatalogTransferService = { type: TransferType; name_ar: string; name_en: string; vehicle_ar: string; vehicle_en: string; is_active: boolean }
export type BuilderCatalog = { schedule: TransportScheduleConfig; today: string; governorates: CatalogGovernorate[]; transferServices: CatalogTransferService[]; accommodations: CatalogAccommodation[]; trips: CatalogTrip[]; packages: CatalogPackage[]; paymentPolicies: PaymentPolicy[]; whatsappNumber?: string }
