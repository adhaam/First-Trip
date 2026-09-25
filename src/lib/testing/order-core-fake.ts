/** Stateful fake used by order-core tests; it deliberately implements only
 * the Supabase calls exercised by cancellation and reopening. */
type Row = Record<string, unknown>
type Filter = { type: 'eq' | 'neq' | 'in'; key: string; value: unknown }

export interface OrderStatusFakeState {
  order: Row
  items: Row[]
  inventory: Record<string, number>
  failedRestocks: Set<string>
  restockCalls: string[]
  decrementCalls: string[]
}

export function createOrderStatusFake(state: OrderStatusFakeState) {
  const matches = (row: Row, filters: Filter[]) => filters.every((filter) => {
    if (filter.type === 'eq') return row[filter.key] === filter.value
    if (filter.type === 'neq') return row[filter.key] !== filter.value
    return (filter.value as unknown[]).includes(row[filter.key])
  })
  class Query {
    private operation: 'select' | 'update' = 'select'
    private values: Row = {}
    private filters: Filter[] = []
    constructor(private table: string) {}
    select() { return this }
    update(values: Row) { this.operation = 'update'; this.values = values; return this }
    eq(key: string, value: unknown) { this.filters.push({ type: 'eq', key, value }); return this }
    neq(key: string, value: unknown) { this.filters.push({ type: 'neq', key, value }); return this }
    in(key: string, value: unknown[]) { this.filters.push({ type: 'in', key, value }); return this }
    private execute() {
      const rows = this.table === 'commerce_orders' ? [state.order] : this.table === 'commerce_order_items' ? state.items : []
      const hit = rows.filter((row) => matches(row, this.filters))
      if (this.operation === 'update') hit.forEach((row) => Object.assign(row, this.values))
      return { data: hit.map((row) => ({ ...row })), error: null }
    }
    async maybeSingle() { const { data, error } = this.execute(); return { data: data[0] ?? null, error } }
    then(resolve: (value: unknown) => unknown) { return Promise.resolve(this.execute()).then(resolve) }
  }
  return {
    from(table: string) { return new Query(table) },
    async rpc(name: string, args: { p_variant_id: string; p_qty: number }) {
      if (name === 'restock_variant_inventory') {
        state.restockCalls.push(args.p_variant_id)
        if (state.failedRestocks.has(args.p_variant_id)) return { data: null, error: { message: 'forced restock failure' } }
        state.inventory[args.p_variant_id] += args.p_qty
        return { data: true, error: null }
      }
      if (name === 'decrement_variant_inventory') {
        state.decrementCalls.push(args.p_variant_id)
        if (state.inventory[args.p_variant_id] < args.p_qty) return { data: false, error: null }
        state.inventory[args.p_variant_id] -= args.p_qty
        return { data: true, error: null }
      }
      return { data: null, error: null }
    },
  }
}
