/**
 * Maps errors raised by the Operations Center RPCs (migration 036:
 * weemap_record_payment, weemap_convert_trip_request) to HTTP responses. The
 * functions RAISE a bare machine code as the message, so the message IS the code.
 */
export type RpcErrorMapping = { status: number; code: string }

const BY_MESSAGE: Record<string, number> = {
  stale_payment_state: 409,
  request_not_confirmed: 409,
  payment_before_confirmation: 422,
  overpayment: 422,
  refund_exceeds_paid: 422,
  invalid_amount: 422,
  invalid_direction: 422,
  invalid_entity_type: 422,
  missing_accommodation: 422,
  missing_quote_snapshot: 422,
  snapshot_mismatch: 422,
  not_found: 404,
}

// Function or table not there yet: the code is deployed before migration 036.
const MIGRATION_PENDING_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883'])

export function mapRpcError(error: { message?: string; code?: string } | null | undefined): RpcErrorMapping | null {
  if (!error) return null
  const message = (error.message ?? '').trim()
  if (message in BY_MESSAGE) return { status: BY_MESSAGE[message], code: message }
  if (error.code && MIGRATION_PENDING_CODES.has(error.code)) return { status: 503, code: 'migration_pending' }
  return null
}
