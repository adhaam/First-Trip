import 'server-only'

import { findOrCreateCustomerByPhone } from '@/lib/customer'
import { paymentPlan, type PaymentPlan } from '@/lib/payment-rules'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { computeQuote } from '@/lib/quote-service'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransportSchedule } from '@/lib/transport/load'
import { applyQuotedExperienceSelections, buildTripRequestRow, resolveJourneyDates, toQuoteRequest } from './build'
import { tripRequestSchema, type TripRequestQuoteInput } from './schema'

export type CreateTripRequestResult =
  | { ok: true; id: string; reference: string; quoted_total: number; payment_plan: PaymentPlan }
  | { ok: false; status: number; code: string; error: string; details?: unknown }

export type PriceTripRequestResult =
  | { ok: true; input: TripRequestQuoteInput; dates: import('./build').JourneyDates; quote: Extract<import('@/lib/quote-data').QuoteResult, { ok: true }>; paymentPlan: PaymentPlan }
  | { ok: false; status: number; code: string; error: string }

/** Prices an already validated journey without creating a customer or database row. */
export async function priceTripRequest(input: TripRequestQuoteInput): Promise<PriceTripRequestResult> {
  const schedule = await getTransportSchedule()
  const datesResult = resolveJourneyDates(input, schedule)
  if (!datesResult.ok) return { ok: false, status: 400, code: datesResult.code, error: datesResult.error }
  const quote = await computeQuote(toQuoteRequest(input, datesResult.dates))
  if (!quote.ok) return { ok: false, status: quote.status, code: quote.code ?? 'PRICING_ERROR', error: quote.error }
  const normalizedInput = applyQuotedExperienceSelections(input, quote.normalizedSelections)
  const rules = await getPaymentRules()
  return { ok: true, input: normalizedInput, dates: datesResult.dates, quote, paymentPlan: paymentPlan('journey', quote.total, rules.policies) }
}

/**
 * Creates a trip_requests row for the M2 Trip Builder: validates the input,
 * resolves the journey dates against the transport schedule, prices it with
 * the server quote engine, derives the payment plan from the 'journey'
 * payment kind (migration 030) on the whole quoted total, resolves the
 * customer, and inserts.
 *
 * Domain events / history are written by the DB trigger on insert — never
 * inserted manually here (see migration 031).
 */
export async function createTripRequest(rawInput: unknown): Promise<CreateTripRequestResult> {
  const parsed = tripRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'Invalid trip request.', details: parsed.error.flatten() }
  }
  const input = parsed.data

  const priced = await priceTripRequest(input)
  if (!priced.ok) return priced

  const customer = await findOrCreateCustomerByPhone({
    phone: input.contact.phone,
    name: input.contact.name,
    email: input.contact.email || null,
  })

  const row = buildTripRequestRow({ ...input, experiences: priced.input.experiences }, priced.dates, priced.quote, priced.paymentPlan, customer.id)

  const { data, error } = await getSupabaseAdmin()
    .from('trip_requests')
    .insert(row)
    .select('id, reference')
    .single()

  if (error || !data) {
    console.error('createTripRequest insert error:', error)
    return { ok: false, status: 500, code: 'INSERT_FAILED', error: 'Failed to create trip request.' }
  }

  return { ok: true, id: data.id, reference: data.reference, quoted_total: priced.quote.total, payment_plan: priced.paymentPlan }
}
