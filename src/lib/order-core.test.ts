import assert from 'node:assert/strict'
import test from 'node:test'
import { applyOrderPatchWithClient, createCommerceOrderWithClient, type OrderItemSnapshot } from './order-core'
import { createOrderStatusFake } from './testing/order-core-fake'

type Row = Record<string, unknown>

function saleLine(id: string, variantId: string, quantity: number, snapshot: OrderItemSnapshot = { inventory_reserved: true }): Row {
  // order_id mirrors the real commerce_order_items schema (NOT NULL FK, migration 013)
  // so the fake's .eq('order_id', orderId) filter in stockReservedLines matches these rows
  // the way it would match real ones.
  return { id, order_id: 'o1', product_id: `p-${id}`, variant_id: variantId, quantity, item_type: 'sale', variant_snapshot: snapshot }
}

test('cancel marks successful restocks, retries only failed lines, and then becomes a no-op', async () => {
  const state = {
    order: { id: 'o1', status: 'confirmed' }, items: [saleLine('i1', 'v1', 1), saleLine('i2', 'v2', 2), saleLine('i3', 'v3', 3)],
    inventory: { v1: 0, v2: 0, v3: 0 }, failedRestocks: new Set(['v2']), restockCalls: [] as string[], decrementCalls: [] as string[],
  }
  const db = createOrderStatusFake(state)
  const first = await applyOrderPatchWithClient(db as never, 'o1', { status: 'cancelled', expectedStatus: 'confirmed' })
  assert.deepEqual(first, { ok: false, status: 409, code: 'restock_incomplete', error: 'Order was cancelled but some inventory restocks are incomplete', pendingLineIds: ['i2'], warnings: ['Variant v2 was not restocked by 2'] })
  assert.equal(state.order.status, 'cancelled')
  assert.deepEqual(state.inventory, { v1: 1, v2: 0, v3: 3 })
  assert.ok((state.items[0].variant_snapshot as OrderItemSnapshot).inventory_restocked_at)
  assert.equal((state.items[1].variant_snapshot as OrderItemSnapshot).inventory_restocked_at, undefined)
  assert.ok((state.items[2].variant_snapshot as OrderItemSnapshot).inventory_restocked_at)
  state.failedRestocks.clear()
  assert.equal((await applyOrderPatchWithClient(db as never, 'o1', { status: 'cancelled', expectedStatus: 'cancelled' })).ok, true)
  assert.deepEqual(state.restockCalls, ['v1', 'v2', 'v3', 'v2'])
  assert.deepEqual(state.inventory, { v1: 1, v2: 2, v3: 3 })
  assert.equal((await applyOrderPatchWithClient(db as never, 'o1', { status: 'cancelled', expectedStatus: 'cancelled' })).ok, true)
  assert.deepEqual(state.restockCalls, ['v1', 'v2', 'v3', 'v2'])
})

test('reopen after partial restock reserves only the lines whose cancellation restock succeeded', async () => {
  const state = {
    order: { id: 'o1', status: 'cancelled' },
    items: [saleLine('i1', 'v1', 1, { inventory_reserved: true, inventory_restocked_at: '2026-01-01T00:00:00.000Z' }), saleLine('i2', 'v2', 2), saleLine('i3', 'v3', 3, { inventory_reserved: true, inventory_restocked_at: '2026-01-01T00:00:00.000Z' })],
    inventory: { v1: 1, v2: 0, v3: 3 }, failedRestocks: new Set<string>(), restockCalls: [] as string[], decrementCalls: [] as string[],
  }
  const result = await applyOrderPatchWithClient(createOrderStatusFake(state) as never, 'o1', { status: 'new', expectedStatus: 'cancelled' })
  assert.equal(result.ok, true)
  assert.equal(state.order.status, 'new')
  assert.deepEqual(state.decrementCalls, ['v1', 'v3'])
  assert.deepEqual(state.inventory, { v1: 0, v2: 0, v3: 0 })
  for (const item of state.items) assert.equal((item.variant_snapshot as OrderItemSnapshot).inventory_restocked_at, undefined)
})

function creationRollbackClient(state: { orders: Row[]; items: Row[]; deleteOrderFails: boolean; itemInsertCount: number; failFirstItem: boolean; restockCalls: { variantId: string; qty: number }[] }) {
  class Query {
    private operation = 'select'; private values: Row = {}
    constructor(private table: string) {}
    select() { return this }; in() { return this }; eq() { return this }; is() { return this }
    insert(values: Row) { this.operation = 'insert'; this.values = values; return this }; update(values: Row) { this.operation = 'update'; this.values = values; return this }; delete() { this.operation = 'delete'; return this }
    private execute() {
      if (this.operation === 'select') {
        if (this.table === 'commerce_products') return { data: [{ id: 'p1', name_ar: 'Product', name_en: 'Product', product_type: 'sale', base_price: 100, is_active: true, archived_at: null, track_inventory: true, deposit_amount: 0 }], error: null }
        if (this.table === 'commerce_product_variants') return { data: [{ id: 'v1', product_id: 'p1', price_override: null, inventory_quantity: 3, is_active: true, option_value_ids: [] }], error: null }
      }
      if (this.operation === 'insert' && this.table === 'commerce_orders') { const order = { id: 'o1', order_number: 'WM-1000', ...this.values }; state.orders.push(order); return { data: order, error: null } }
      if (this.operation === 'insert' && this.table === 'commerce_order_items') {
        state.itemInsertCount += 1
        if ((state.failFirstItem && state.itemInsertCount === 1) || state.itemInsertCount === 2) return { data: null, error: { message: 'forced item failure' } }
        const item = { id: `i${state.itemInsertCount}`, ...this.values }; state.items.push(item); return { data: item, error: null }
      }
      if (this.operation === 'delete' && this.table === 'commerce_orders') { if (state.deleteOrderFails) return { data: null, error: { message: 'forced order delete failure' } }; state.orders = []; state.items = []; return { data: null, error: null } }
      if (this.operation === 'delete' && this.table === 'commerce_order_items') { state.items = []; return { data: null, error: null } }
      if (this.operation === 'update' && this.table === 'commerce_orders') { state.orders.forEach((order) => Object.assign(order, this.values)); return { data: null, error: null } }
      return { data: null, error: null }
    }
    async single() { const result = this.execute(); return { data: result.data, error: result.error } }
    then(resolve: (value: unknown) => unknown) { return Promise.resolve(this.execute()).then(resolve) }
  }
  return {
    from(table: string) { return new Query(table) },
    async rpc(name: string, args?: { p_variant_id: string; p_qty: number }) {
      if (name === 'decrement_variant_inventory') return { data: true, error: null }
      if (name === 'restock_variant_inventory' && args) {
        state.restockCalls.push({ variantId: args.p_variant_id, qty: args.p_qty })
        return { data: true, error: null }
      }
      return { data: null, error: null }
    },
  }
}

async function createFailingOrder(db: unknown, items: { productId: string; variantId: string; quantity: number }[]) {
  return createCommerceOrderWithClient({ customerName: 'Test', customerPhone: '+201000000000', fulfillmentMethod: 'pickup', items }, { db: db as never, findOrCreateCustomer: async () => ({ id: 'c1' }), recordCustomerActivity: async () => {}, getTotalInventory: async () => 0 })
}

test('creation rollback leaves a zero-value cancelled record when deleting the order fails', async () => {
  const state = { orders: [] as Row[], items: [] as Row[], deleteOrderFails: true, itemInsertCount: 0, failFirstItem: true, restockCalls: [] as { variantId: string; qty: number }[] }
  const result = await createFailingOrder(creationRollbackClient(state), [{ productId: 'p1', variantId: 'v1', quantity: 1 }])
  assert.equal(result.success, false)
  const order = state.orders[0]
  assert.deepEqual({ status: order.status, subtotal: order.subtotal, delivery_fee: order.delivery_fee, total_price: order.total_price }, { status: 'cancelled', subtotal: 0, delivery_fee: 0, total_price: 0 })
  assert.match(String(order.internal_notes), /Creation rolled back - no items/)
})

test('createCommerceOrderWithClient restocks decremented variants when an item insert fails', async () => {
  // Regression: an order-item insert failure must roll back the stock this
  // order already decremented, and leave neither the order nor its items
  // behind (current compensation order: order row deleted first, items
  // cascade — see 'creation rollback deletes the order first...' below).
  const state = { orders: [] as Row[], items: [] as Row[], deleteOrderFails: false, itemInsertCount: 0, failFirstItem: true, restockCalls: [] as { variantId: string; qty: number }[] }
  const result = await createFailingOrder(creationRollbackClient(state), [{ productId: 'p1', variantId: 'v1', quantity: 2 }])
  assert.deepEqual(result, { success: false, error: 'Failed to create order' })
  assert.deepEqual(state.restockCalls, [{ variantId: 'v1', qty: 2 }])
  assert.deepEqual(state.orders, [])
  assert.deepEqual(state.items, [])
})

test('creation rollback deletes the order first and cascades already-created items', async () => {
  const state = { orders: [] as Row[], items: [] as Row[], deleteOrderFails: false, itemInsertCount: 0, failFirstItem: false, restockCalls: [] as { variantId: string; qty: number }[] }
  const result = await createFailingOrder(creationRollbackClient(state), [{ productId: 'p1', variantId: 'v1', quantity: 1 }, { productId: 'p1', variantId: 'v1', quantity: 1 }])
  assert.equal(result.success, false)
  assert.deepEqual(state.orders, [])
  assert.deepEqual(state.items, [])
})
