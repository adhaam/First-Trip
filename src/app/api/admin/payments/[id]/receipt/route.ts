import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSiteSettings } from '@/lib/data'
import { documentHtmlResponse, documentJson } from '@/lib/documents/response'
import { buildReceipt, type ReceiptRecord } from '@/lib/documents/receipt'
import { getSupabaseAdmin } from '@/lib/supabase'

// A Payment Receipt for ONE payment_records row, as standalone, printable HTML. It is built from
// the ledger entry itself — the amount, date, method and reference that were actually recorded and
// the running total received as at that payment — never from an expected amount. A refund has no
// receipt. A journey component (a booking converted off a trip request) has no documents of its
// own: its money belongs to the journey, so the receipt is the journey's.
const querySchema = z.object({ locale: z.enum(['ar', 'en']).default('en') })

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return documentJson({ error: 'Invalid id', code: 'invalid' }, 400)
  }
  const query = querySchema.safeParse({ locale: req.nextUrl.searchParams.get('locale') || undefined })
  if (!query.success) {
    return documentJson({ error: 'Invalid query', code: 'invalid', details: query.error.flatten() }, 400)
  }

  const supabase = getSupabaseAdmin(gate.staff)
  const { data: record, error: recordError } = await supabase
    .from('payment_records')
    .select('id, entity_type, entity_id, direction, amount, method, reference, received_at, amount_paid_after')
    .eq('id', id)
    .maybeSingle()
  if (recordError) {
    console.error('receipt: load payment record error:', recordError)
    return documentJson({ error: 'Failed to load the payment', code: 'LOAD_FAILED' }, 500)
  }
  if (!record) return documentJson({ error: 'Payment not found', code: 'not_found' }, 404)
  if (record.direction === 'refunded') {
    return documentJson({ error: 'receipt_not_for_refund', code: 'receipt_not_for_refund' }, 409)
  }

  // ops_work_items already normalises reference / customer / agreed total for every entity type.
  const { data: item, error: itemError } = await supabase
    .from('ops_work_items')
    .select('reference, customer_name, customer_phone, amount_total, title_en, title_ar, journey_component')
    .eq('entity_type', record.entity_type)
    .eq('entity_id', record.entity_id)
    .maybeSingle()
  if (itemError) {
    console.error('receipt: load booking error:', itemError)
    return documentJson({ error: 'Failed to load the booking', code: 'LOAD_FAILED' }, 500)
  }
  if (!item) return documentJson({ error: 'Booking not found', code: 'not_found' }, 404)
  if (item.journey_component) {
    return documentJson({ error: 'component_of_journey', code: 'component_of_journey' }, 409)
  }

  const settings = await getSiteSettings()
  const result = buildReceipt({
    record: record as ReceiptRecord,
    subject: {
      reference: String(item.reference),
      customer_name: String(item.customer_name ?? ''),
      customer_phone: item.customer_phone ?? null,
      total: Number(item.amount_total) || 0,
      title_en: item.title_en ?? null,
      title_ar: item.title_ar ?? null,
    },
    settings,
    locale: query.data.locale,
  })
  if (!result.ok) return documentJson({ error: result.code, code: result.code }, 409)
  return documentHtmlResponse(result.html)
}
