import {
  WorkflowError,
  allowedNextStatuses,
  assertTransition,
  type RequestDomain,
  type RequestStatus,
} from './request-workflow'

export type StatusUpdateResponse<Row> = {
  data: Row | null
  error: unknown | null
}

/**
 * The small persistence surface the workflow needs. Route handlers adapt their
 * Supabase query to this interface, which keeps the compare-and-swap logic
 * independent of Next.js and straightforward to test.
 */
export interface AdminStatusUpdateClient<Row> {
  readStatus(id: string): Promise<StatusUpdateResponse<{ status: string }>>
  update(id: string, patch: Record<string, unknown>, currentStatus?: string): Promise<StatusUpdateResponse<Row>>
}

export type AdminStatusUpdateResult<Row> =
  | { kind: 'updated'; data: Row }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; allowed: string[] }
  | { kind: 'stale_status' }
  | { kind: 'error'; error: unknown }

/**
 * Updates a request row after checking its state transition. Status changes
 * use the status that was read as a compare-and-swap guard so concurrent admin
 * edits cannot silently overwrite one another. Non-status patches need no read.
 */
export async function updateAdminStatus<D extends RequestDomain, Row>(
  client: AdminStatusUpdateClient<Row>,
  domain: D,
  id: string,
  patch: Record<string, unknown>,
): Promise<AdminStatusUpdateResult<Row>> {
  const nextStatus = patch.status
  if (nextStatus === undefined) {
    const result = await client.update(id, patch)
    if (result.error) return { kind: 'error', error: result.error }
    if (!result.data) return { kind: 'not_found' }
    return { kind: 'updated', data: result.data }
  }

  const current = await client.readStatus(id)
  if (current.error) return { kind: 'error', error: current.error }
  if (!current.data) return { kind: 'not_found' }

  try {
    assertTransition(domain, current.data.status as RequestStatus<D>, nextStatus as RequestStatus<D>)
  } catch (error) {
    if (error instanceof WorkflowError) {
      return {
        kind: 'invalid_transition',
        allowed: allowedNextStatuses(domain, current.data.status as RequestStatus<D>),
      }
    }
    throw error
  }

  const updated = await client.update(id, patch, current.data.status)
  if (updated.error) return { kind: 'error', error: updated.error }
  if (!updated.data) return { kind: 'stale_status' }
  return { kind: 'updated', data: updated.data }
}
