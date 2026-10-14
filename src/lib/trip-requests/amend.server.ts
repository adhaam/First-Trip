import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { PaymentPlan } from '@/lib/payment-rules'
import type { RoomPlan } from '@/lib/room-allocation'
import { mapRpcError } from '@/lib/ops/rpc-errors'
import { quotationLines, type QuotationLine } from '@/lib/quotation-document'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { PriceSnapshot } from '@/lib/types'
import {
  amendedJourneyPayload,
  amendmentBlocker,
  currentTotal,
  parseJourney,
  resetsAvailability,
  roundMoney,
  type AmendableRow,
  type AmendmentBlocker,
  type AmendedJourneyPayload,
} from './amend'
import type { JourneyDates } from './build'
import { buildRevisionViews, type RevisionRow, type RevisionView } from './revisions'
import { priceTripRequest } from './service'

export type AmendError = { ok: false; status: number; code: string; error: string; details?: unknown }

export type LoadedRow = AmendableRow & {
  created_at: string
  submitted_at?: string | null
  quote_snapshot?: Record<string, unknown> | null
  payment_plan?: Record<string, unknown> | null
}
export type LoadedAmendableRow = { row: LoadedRow; hasPayments: boolean }

/** The request row plus whether the payment ledger holds any entry for it. */
export async function loadAmendableRow(
  supabase: SupabaseClient,
  id: string,
): Promise<LoadedAmendableRow | AmendError> {
  const { data, error } = await supabase.from('trip_requests').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('amend: load trip request error:', error)
    return { ok: false, status: 500, code: 'LOAD_FAILED', error: 'Failed to load the trip request.' }
  }
  if (!data) return { ok: false, status: 404, code: 'not_found', error: 'Trip request not found.' }
  const { count, error: ledgerError } = await supabase
    .from('payment_records')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'trip_request')
    .eq('entity_id', id)
  if (ledgerError) {
    console.error('amend: payment ledger lookup error:', ledgerError)
    return { ok: false, status: 500, code: 'LOAD_FAILED', error: 'Failed to load the trip request.' }
  }
  return { row: data as LoadedRow, hasPayments: (count ?? 0) > 0 }
}

/** The JSON error response every amendment route returns for an AmendError. */
export function amendErrorResponse(error: AmendError) {
  return NextResponse.json(
    { error: error.error, code: error.code, ...(error.details ? { details: error.details } : {}) },
    { status: error.status },
  )
}

/** 400 for a request body / query that failed zod validation. */
export function invalidInputResponse(error: { flatten: () => unknown }, message = 'Invalid data') {
  return NextResponse.json({ error: message, code: 'invalid', details: error.flatten() }, { status: 400 })
}

export function isAmendError(value: unknown): value is AmendError {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false
}

type Priced = Extract<Awaited<ReturnType<typeof priceTripRequest>>, { ok: true }>

async function priceJourney(
  row: AmendableRow,
  journey: unknown,
): Promise<{ ok: true; priced: Priced } | AmendError> {
  const parsed = parseJourney(journey, row.source)
  if (!parsed.success) {
    return {
      ok: false, status: 400, code: 'VALIDATION_ERROR', error: 'Invalid journey.', details: parsed.error.flatten(),
    }
  }
  const priced = await priceTripRequest(parsed.data)
  if (!priced.ok) return priced
  return { ok: true, priced }
}

export type AmendmentPreview = {
  ok: true
  original: { total: number; lines: QuotationLine[] }
  revised: {
    total: number
    /** Same snapshot-derived lines as `original`, so the two sides compare key by key. */
    lines: QuotationLine[]
    payment: PaymentPlan
    rooms: RoomPlan | null
    dates: JourneyDates
    journey: AmendedJourneyPayload
  }
  difference: number
  availability_reset: boolean
  blocker: AmendmentBlocker | null
}

/** Re-prices a proposed journey against the stored request without writing anything. */
export async function previewAmendment(
  id: string,
  journey: unknown,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<AmendmentPreview | AmendError> {
  const loaded = await loadAmendableRow(supabase, id)
  if (isAmendError(loaded)) return loaded
  const { row, hasPayments } = loaded

  const result = await priceJourney(row, journey)
  if (!result.ok) return result
  const { priced } = result

  const originalTotal = currentTotal(row)
  return {
    ok: true,
    original: {
      total: originalTotal,
      lines: quotationLines(
        row.quote_snapshot ? { ...(row.quote_snapshot as unknown as PriceSnapshot), total: originalTotal } : null,
      ),
    },
    revised: {
      total: priced.quote.total,
      lines: quotationLines(priced.quote.snapshot),
      payment: priced.paymentPlan,
      rooms: priced.quote.rooms ?? null,
      dates: priced.dates,
      journey: amendedJourneyPayload({
        input: priced.input,
        departureDate: priced.dates.departureDate,
        roomAllocations: priced.quote.roomAllocations,
      }),
    },
    difference: roundMoney(priced.quote.total - originalTotal),
    availability_reset: resetsAvailability(row.status),
    blocker: amendmentBlocker({ status: row.status, amount_paid: row.amount_paid, has_payments: hasPayments }),
  }
}

export type AmendmentResult = {
  revision_number: number
  previous_total: number
  new_total: number
  difference: number
  status: string
  converted: boolean
  booking_id: string | null
  trip_booking_ids: string[]
  removed_trip_booking_ids: string[]
  /** The request's new updated_at: the expected_updated_at for the next amendment. */
  updated_at: string
}

/**
 * Applies an amendment. Totals are NEVER taken from the client: the journey is
 * re-priced here and the RPC receives the freshly computed snapshot, total and
 * payment plan together with the (optimistic-lock) expected_updated_at.
 */
export async function applyAmendment(
  id: string,
  journey: unknown,
  expectedUpdatedAt: string,
  reason: string,
  staffClient: SupabaseClient,
): Promise<{ ok: true; result: AmendmentResult } | AmendError> {
  const loaded = await loadAmendableRow(staffClient, id)
  if (isAmendError(loaded)) return loaded
  const { row, hasPayments } = loaded

  const blocker = amendmentBlocker({ status: row.status, amount_paid: row.amount_paid, has_payments: hasPayments })
  if (blocker) return { ok: false, status: 409, code: blocker, error: blocker }

  const priced = await priceJourney(row, journey)
  if (!priced.ok) return priced
  const { quote, input, dates, paymentPlan } = priced.priced

  const payload = amendedJourneyPayload({
    input,
    departureDate: dates.departureDate,
    roomAllocations: quote.roomAllocations,
  })
  const { data, error } = await staffClient.rpc('weemap_amend_trip_request', {
    p_request_id: id,
    p_expected_updated_at: expectedUpdatedAt,
    p_journey: payload,
    p_quote_snapshot: quote.snapshot,
    p_quoted_total: quote.total,
    p_payment_plan: paymentPlan,
    p_reason: reason,
  })
  if (error) {
    const mapped = mapRpcError(error)
    if (mapped) return { ok: false, status: mapped.status, code: mapped.code, error: mapped.code }
    console.error('amend trip request rpc error:', error)
    return { ok: false, status: 500, code: 'AMEND_FAILED', error: 'Failed to amend the trip request.' }
  }
  return { ok: true, result: data as AmendmentResult }
}

// Table not there yet: the code is deployed before migration 051, so nothing has been amended.
const MISSING_RELATION_CODES = new Set(['PGRST205', '42P01'])

/** Every revision of a request (oldest first); a never-amended request yields its virtual revision 1. */
export async function loadRevisionViews(
  supabase: SupabaseClient,
  row: LoadedRow,
): Promise<RevisionView[] | AmendError> {
  const { data, error } = await supabase
    .from('trip_request_revisions')
    .select('*')
    .eq('trip_request_id', row.id)
    .order('revision_number', { ascending: true })
  if (error && !(error.code && MISSING_RELATION_CODES.has(error.code))) {
    console.error('amend: load revisions error:', error)
    return { ok: false, status: 500, code: 'LOAD_FAILED', error: 'Failed to load the revisions.' }
  }
  return buildRevisionViews((error ? [] : data ?? []) as RevisionRow[], row)
}
