import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Minimal in-memory stand-in for the Supabase query builder, covering only
 * the chain shapes the customer resolver uses:
 *   from(t).select().eq().is().maybeSingle()
 *   from(t).insert(v).select().single()
 *   from(t).update(v).eq().select().single()
 * Every executed query is logged in `ops` so tests can assert exactly what
 * was written. Test-only — never import from app code.
 */

type Row = Record<string, unknown>
type Filter = { op: 'eq' | 'is'; column: string; value: unknown }

export interface FakeOp {
  table: string
  kind: 'select' | 'insert' | 'update'
  values?: Row
  filters: Filter[]
}

export interface FakeSupabaseOptions {
  /**
   * Called before an insert is applied. Return an error to reject it (e.g. to
   * simulate the partial unique index losing a race); the hook may mutate
   * `tables` first to plant the concurrent winner.
   */
  beforeInsert?: (table: string, row: Row, tables: Record<string, Row[]>) => { message: string; code?: string } | null
}

export function createFakeSupabase(
  seed: Record<string, Row[]> = {},
  options: FakeSupabaseOptions = {},
) {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((r) => ({ ...r }))
  const ops: FakeOp[] = []

  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) => (f.op === 'eq' ? row[f.column] === f.value : (row[f.column] ?? null) === f.value))

  class Query {
    private kind: FakeOp['kind'] = 'select'
    private values?: Row
    private filters: Filter[] = []
    constructor(private table: string) {}

    select() { return this }
    insert(values: Row) { this.kind = 'insert'; this.values = values; return this }
    update(values: Row) { this.kind = 'update'; this.values = values; return this }
    eq(column: string, value: unknown) { this.filters.push({ op: 'eq', column, value }); return this }
    is(column: string, value: unknown) { this.filters.push({ op: 'is', column, value }); return this }

    private run(): { rows: Row[]; error: { message: string; code?: string } | null } {
      const rows = (tables[this.table] ||= [])
      ops.push({ table: this.table, kind: this.kind, values: this.values, filters: [...this.filters] })
      if (this.kind === 'insert') {
        const row: Row = { id: randomUUID(), merged_into: null, created_at: new Date().toISOString(), ...this.values }
        const error = options.beforeInsert?.(this.table, row, tables) ?? null
        if (error) return { rows: [], error }
        rows.push(row)
        return { rows: [{ ...row }], error: null }
      }
      const hit = rows.filter((r) => matches(r, this.filters))
      if (this.kind === 'update') for (const r of hit) Object.assign(r, this.values)
      return { rows: hit.map((r) => ({ ...r })), error: null }
    }

    async maybeSingle() {
      const { rows, error } = this.run()
      if (error) return { data: null, error }
      if (rows.length > 1) return { data: null, error: { message: 'multiple rows' } }
      return { data: rows[0] ?? null, error: null }
    }

    async single() {
      const { rows, error } = this.run()
      if (error) return { data: null, error }
      if (rows.length !== 1) return { data: null, error: { message: `expected 1 row, got ${rows.length}` } }
      return { data: rows[0], error: null }
    }
  }

  const client = { from: (table: string) => new Query(table) } as unknown as SupabaseClient
  return { client, tables, ops }
}
