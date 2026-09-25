import 'server-only'

import { getAccommodationById, getTransferPricing } from '@/lib/data'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTripPackagesForPricing } from '@/lib/trip-packages'
import {
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
