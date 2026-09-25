import assert from 'node:assert/strict'
import test from 'node:test'
import { createCommerceOrderWithClient } from './order-core'

type State = { inventory: number; orders: string[]; items: string[]; restocks: number }
type FluentQuery = {
  select(): FluentQuery
  in(): FluentQuery
  eq(): FluentQuery
  is(): FluentQuery
  insert(): FluentQuery
  delete(): FluentQuery
  update(): FluentQuery
  single(): Promise<unknown>
  maybeSingle(): Promise<unknown>
  then(resolve: (value: unknown) => unknown): Promise<unknown>
}

/** Minimal fluent fake: fail the first order-item insert after stock/order creation. */
function failingItemInsertClient(state: State) {
  let table = ''
  let operation = ''
  const result = () => {
    if (operation === 'select') {
      if (table === 'commerce_products') return { data: [{ id: 'p1', name_ar: 'منتج', name_en: 'Product', product_type: 'sale', base_price: 100, is_active: true, archived_at: null, track_inventory: true, deposit_amount: 0 }], error: null }
      if (table === 'commerce_product_variants') return { data: [{ id: 'v1', product_id: 'p1', price_override: null, inventory_quantity: state.inventory, is_active: true, option_value_ids: [] }], error: null }
    }
    if (operation === 'insert') {
      if (table === 'commerce_orders') { state.orders.push('o1'); return { data: { id: 'o1', order_number: 'WM-1000' }, error: null } }
      if (table === 'commerce_order_items') return { data: null, error: { message: 'forced item failure' } }
    }
    if (operation === 'delete') {
      if (table === 'commerce_orders') state.orders = []
      if (table === 'commerce_order_items') state.items = []
      return { data: null, error: null }
    }
    return { data: null, error: null }
  }
  const chain: FluentQuery = {
    select() { if (!operation) operation = 'select'; return chain }, in() { return chain }, eq() { return chain }, is() { return chain },
    insert() { operation = 'insert'; return chain }, delete() { operation = 'delete'; return chain }, update() { operation = 'update'; return chain },
    single() { return Promise.resolve(result()) }, maybeSingle() { return Promise.resolve(result()) },
    then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve) },
  }
  return {
    from(nextTable: string) { table = nextTable; operation = ''; return chain },
    async rpc(name: string, args: { p_qty: number }) {
      if (name === 'decrement_variant_inventory') { state.inventory -= args.p_qty; return { data: true, error: null } }
      if (name === 'restock_variant_inventory') { state.inventory += args.p_qty; state.restocks += args.p_qty; return { data: null, error: null } }
      return { data: null, error: null }
    },
  }
}

test('createCommerceOrderWithClient compensates stock and order when an item insert fails', async () => {
  const state: State = { inventory: 3, orders: [], items: [], restocks: 0 }
  const result = await createCommerceOrderWithClient({
    customerName: 'Test Customer', customerPhone: '+201000000000', fulfillmentMethod: 'pickup',
    items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
  }, {
    db: failingItemInsertClient(state) as never,
    findOrCreateCustomer: async () => ({ id: 'c1' }),
    recordCustomerActivity: async () => {},
    getTotalInventory: async () => 0,
  })
  assert.deepEqual(result, { success: false, error: 'Failed to create order' })
  assert.equal(state.inventory, 3)
  assert.equal(state.restocks, 2)
  assert.deepEqual(state.orders, [])
})
