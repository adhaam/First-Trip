/**
 * Revision history of a journey (trip_request_revisions, migration 051).
 *
 * Revision 1 ('original') is created lazily at the first amendment, so a
 * request that was never amended has no rows: its current row is treated as a
 * virtual revision 1. Pure (no server imports) for unit tests.
 */
import { isAvailabilityConfirmedStatus, journeyFromRow, type JourneyRow } from './amend'

export type RevisionRow = {
  revision_number: number
  kind: 'original' | 'amendment'
  journey: Record<string, unknown> | null
  quote_snapshot: Record<string, unknown> | null
  quoted_total: number | string | null
  payment_plan: Record<string, unknown> | null
  previous_total: number | string | null
  difference: number | string | null
  reason: string | null
  status_at_revision: string | null
  availability_confirmed: boolean | null
  created_by: string | null
  created_at: string
}

/** The request columns needed to synthesise the virtual revision 1. */
export type RevisionRequestRow = JourneyRow & {
  status: string
  created_at: string
  submitted_at?: string | null
  quoted_total?: number | string | null
  quote_snapshot?: Record<string, unknown> | null
  payment_plan?: Record<string, unknown> | null
}

export type RevisionView = {
  revision_number: number
  kind: 'original' | 'amendment'
  created_at: string
  created_by: string | null
  quoted_total: number | null
  previous_total: number | null
  difference: number | null
  reason: string | null
  status_at_revision: string | null
  availability_confirmed: boolean
  is_current: boolean
  /** The next revision that replaced this one, or null for the current revision. */
  superseded_by: number | null
  journey: Record<string, unknown>
  quote_snapshot: Record<string, unknown> | null
  payment_plan: Record<string, unknown> | null
  virtual: boolean
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function buildRevisionViews(rows: readonly RevisionRow[], request: RevisionRequestRow): RevisionView[] {
  if (!rows.length) {
    const snapshotTotal = num(request.quote_snapshot?.total)
    return [{
      revision_number: 1,
      kind: 'original',
      created_at: request.submitted_at ?? request.created_at,
      created_by: null,
      quoted_total: num(request.quoted_total) ?? snapshotTotal,
      previous_total: null,
      difference: null,
      reason: null,
      status_at_revision: request.status,
      availability_confirmed: isAvailabilityConfirmedStatus(request.status),
      is_current: true,
      superseded_by: null,
      journey: { ...journeyFromRow(request) },
      quote_snapshot: request.quote_snapshot ?? null,
      payment_plan: request.payment_plan ?? null,
      virtual: true,
    }]
  }
  const ascending = [...rows].sort((a, b) => a.revision_number - b.revision_number)
  const latest = ascending[ascending.length - 1].revision_number
  return ascending.map((row, index) => {
    const next = ascending[index + 1]
    return {
      revision_number: row.revision_number,
      kind: row.kind,
      created_at: row.created_at,
      created_by: row.created_by,
      quoted_total: num(row.quoted_total) ?? num(row.quote_snapshot?.total),
      previous_total: num(row.previous_total),
      difference: num(row.difference),
      reason: row.reason,
      status_at_revision: row.status_at_revision,
      availability_confirmed: Boolean(row.availability_confirmed),
      is_current: row.revision_number === latest,
      superseded_by: next ? next.revision_number : null,
      journey: row.journey ?? {},
      quote_snapshot: row.quote_snapshot,
      payment_plan: row.payment_plan,
      virtual: false,
    }
  })
}

/** The list shape returned by GET …/revisions (no heavy journey/snapshot payloads), newest first. */
export function revisionListItems(views: readonly RevisionView[]) {
  return [...views]
    .sort((a, b) => b.revision_number - a.revision_number)
    .map((view) => ({
      revision_number: view.revision_number,
      kind: view.kind,
      created_at: view.created_at,
      created_by: view.created_by,
      quoted_total: view.quoted_total,
      previous_total: view.previous_total,
      difference: view.difference,
      reason: view.reason,
      status_at_revision: view.status_at_revision,
      availability_confirmed: view.availability_confirmed,
      is_current: view.is_current,
    }))
}
