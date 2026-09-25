import 'server-only'

import { findOrCreateCustomerByPhone } from '@/lib/customer'
import { paymentPlanForParts, type CombinedPaymentPlan, type PaymentKind } from '@/lib/payment-rules'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { computeQuote } from '@/lib/quote-service'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getTransportSchedule } from '@/lib/transport/load'
import { buildTripRequestRow, resolveJourneyDates, toQuoteRequest, tripRequestPaymentParts } from './build'
import { tripRequestSchema } from './schema'

export type CreateTripRequestResult =
  | { ok: true; id: string; reference: string; quoted_total: number; payment_plan: CombinedPaymentPlan }
  | { ok: false; status: number; code: string; error: string; details?: unknown }

async function loadPackagePaymentKinds(packageIds: string[]): Promise<Record<string, PaymentKind>> {
  if (packageIds.length === 0 || !isSupabaseConfigured()) return {}
  const { data, error } = await getSupabaseAdmin()
    .from('trip_packages')
    .select('id, payment_kind')
    .in('id', packageIds)
  if (error) {
    console.error('loadPackagePaymentKinds error:', error)
    return {}
  }
  return Object.fromEntries(
    (data ?? []).map((row) => [row.id as string, ((row.payment_kind as PaymentKind | null) ?? 'experience_package')]),
  )
}

/**
 * Creates a trip_requests row for the M2 Trip Builder: validates the input,
 * resolves the journey dates against the transport schedule, prices it with
 * the server quote engine, derives the payment plan from the explicit
 * payment kinds (migration 030), resolves the customer, and inserts.
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

  const schedule = await getTransportSchedule()
  const datesResult = resolveJourneyDates(input, schedule)
  if (!datesResult.ok) {
    return { ok: false, status: 400, code: datesResult.code, error: datesResult.error }
  }
  const dates = datesResult.dates

  const quoteRequest = toQuoteRequest(input, dates)
  const quote = await computeQuote(quoteRequest)
  if (!quote.ok) {
    return { ok: false, status: quote.status, code: quote.code ?? 'PRICING_ERROR', error: quote.error }
  }

  const packageIds = input.experiences.filter((experience) => experience.kind === 'trip_package').map((experience) => experience.id)
  const packagePaymentKinds = await loadPackagePaymentKinds(packageIds)
  const parts = tripRequestPaymentParts(input, quote, packagePaymentKinds)
  const rules = await getPaymentRules()
  const paymentPlan = paymentPlanForParts(parts, rules.policies)

  const customer = await findOrCreateCustomerByPhone({
    phone: input.contact.phone,
    name: input.contact.name,
    email: input.contact.email || null,
  })

  const row = buildTripRequestRow(input, dates, quote, paymentPlan, customer.id)

  const { data, error } = await getSupabaseAdmin()
    .from('trip_requests')
    .insert(row)
    .select('id, reference')
    .single()

  if (error || !data) {
    console.error('createTripRequest insert error:', error)
    return { ok: false, status: 500, code: 'INSERT_FAILED', error: 'Failed to create trip request.' }
  }

  return { ok: true, id: data.id, reference: data.reference, quoted_total: quote.total, payment_plan: paymentPlan }
}
