import 'server-only'

import { getAccommodationById, getTransferPricing } from '@/lib/data'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTripPackagesForPricing } from '@/lib/trip-packages'
import {
  computeExperiencesQuote as computeExperiencesQuoteWithSource,
  computeQuote as computeQuoteWithSource,
  type QuoteDataSource,
  type QuoteInput,
  type QuoteResult,
} from './quote-data'

export * from './quote-data'

/** Database-backed source used by route handlers. Kept out of the pure quote engine. */
export const supabaseQuoteDataSource: QuoteDataSource = {
  getTransferPricing,
  getAccommodationById,
  async getExtraTrips(ids) {
    const { data: trips } = await getSupabaseAdmin()
      .from('sinai_trips')
      .select('id, name_ar, name_en, price, discount_type, discount_value, discount_starts_at, discount_ends_at')
      .in('id', ids)
      .eq('is_active', true)

    return (trips || []).map((trip) => ({
      id: trip.id,
      name_en: trip.name_en,
      name_ar: trip.name_ar,
      price: Number(trip.price) || 0,
      discount_type: trip.discount_type,
      discount_value: trip.discount_value,
      discount_starts_at: trip.discount_starts_at,
      discount_ends_at: trip.discount_ends_at,
    }))
  },
  getTripPackages: getTripPackagesForPricing,
}

/** Route-handler convenience entrypoint using the authoritative DB rates. */
export function computeQuote(input: QuoteInput): Promise<QuoteResult> {
  return computeQuoteWithSource(input, { source: supabaseQuoteDataSource })
}

/** Trips-only journeys (no stay, no WEEMAP transport), priced from the same DB rates. */
export function computeExperiencesQuote(input: Parameters<typeof computeExperiencesQuoteWithSource>[0]): Promise<QuoteResult> {
  return computeExperiencesQuoteWithSource(input, { source: supabaseQuoteDataSource })
}
