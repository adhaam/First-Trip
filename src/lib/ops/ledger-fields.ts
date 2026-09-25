/**
 * Money on a request row changes only through the append-only payment ledger
 * (POST /api/admin/payments → weemap_record_payment, migration 036). Edit routes
 * refuse these keys outright instead of silently dropping them, so a stale
 * screen that still tries to type an amount gets a clear answer.
 */
export const LEDGER_ONLY_FIELDS = [
  'payment_status', 'amount_paid', 'payment_channel', 'payment_received_by', 'payment_date',
] as const

export function ledgerOnlyFieldsIn(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []
  return LEDGER_ONLY_FIELDS.filter((field) => field in (body as Record<string, unknown>))
}
