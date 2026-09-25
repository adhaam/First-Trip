import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { applyOrderPatchWithClient, createCommerceOrderWithClient } from './order-core'

// Order creation and status changes are one database transaction each
// (migration 039; behaviour proven by supabase/tests/commerce_integrity.sql).
// These tests pin what the server sends to those functions and how it
// answers their errors.

type Row = Record<string, unknown>
type RpcCall = { name: string; args: Record<string, unknown> }
type RpcAnswer = { data: unknown; error: { message: string; code?: string } | null }

const PRODUCTS: Row[] = [
  {
    id: 'p1', name_ar: 'قميص', name_en: 'Shirt', product_type: 'sale', base_price: 100,
    is_active: true, archived_at: null, track_inventory: true, deposit_amount: 0,
  },
  {
    id: 'p2', name_ar: 'خيمة', name_en: 'Tent', product_type: 'rental', base_price: 0,
    is_active: true, archived_at: null, track_inventory: false, deposit_amount: 200,
  },
]
const VARIANTS: Row[] = [
  { id: 'v1', product_id: 'p1', price_override: 120, inventory_quantity: 3, is_active: true, option_value_ids: ['o1'] },
]
const TIERS: Row[] = [
  { id: 't1', product_id: 'p2', variant_id: null, duration_days: 1, price: 150, is_active: true },
]

function fakeDb(answer: (call: RpcCall) => RpcAnswer, updates: Row[] = []) {
  const calls: RpcCall[] = []
  class Query {
    private values: Row | null = null
    constructor(private table: string) {}
    select() { return this }
    in() { return this }
    eq() { return this }
    update(values: Row) { this.values = values; updates.push({ table: this.table, ...values }); return this }
    async maybeSingle() {
      return { data: this.values ? { id: 'o1', ...this.values } : null, error: null }
    }
    then(resolve: (value: unknown) => unknown) {
      const data = this.table === 'commerce_products' ? PRODUCTS
        : this.table === 'commerce_product_variants' ? VARIANTS
          : this.table === 'rental_pricing_tiers' ? TIERS : []
      return Promise.resolve({ data, error: null }).then(resolve)
    }
  }
  return {
    calls,
    db: {
      from: (table: string) => new Query(table),
      rpc: async (name: string, args: Record<string, unknown>) => {
        const call = { name, args }
        calls.push(call)
        return answer(call)
      },
    },
  }
}

const deps = (db: unknown) => ({
  db: db as never,
  findOrCreateCustomer: async () => ({ id: 'c1' }),
  recordCustomerActivity: async () => {},
  today: () => '2026-10-01',
})

const input = {
  customerName: 'Mona',
  customerPhone: '01000000000',
  fulfillmentMethod: 'pickup' as const,
  items: [
    { productId: 'p1', variantId: 'v1', quantity: 2 },
    { productId: 'p2', quantity: 1, rentalDurationDays: 2, rentalStartDate: '2026-10-05' },
  ],
}

test('creation prices every line on the server and writes it in one call', async () => {
  const { db, calls } = fakeDb(() => ({ data: { order_id: 'o1', order_number: 'WM-1001' }, error: null }))
  const result = await createCommerceOrderWithClient(input, deps(db))
  assert.equal(result.success, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'weemap_place_commerce_order')
  const order = calls[0].args.p_order as Row
  const items = calls[0].args.p_items as Row[]
  assert.equal(order.subtotal, 540)
  assert.equal(order.total_price, 540)
  assert.equal(order.fulfillment_method, 'pickup')
  assert.equal(items[0].unit_price, 120)
  assert.equal(items[0].line_total, 240)
  assert.equal((items[0].variant_snapshot as Row).inventory_reserved, true)
  assert.equal(items[1].item_type, 'rental')
  assert.equal(items[1].rental_start_date, '2026-10-05')
  assert.equal(items[1].rental_end_date, '2026-10-06')
  assert.equal(items[1].line_total, 300)
  assert.match(String(order.internal_notes), /deposit due at handover: 200 EGP/)
  if (result.success) {
    assert.equal(result.orderNumber, 'WM-1001')
    assert.equal(result.depositTotal, 200)
  }
})

test('creation answers the database refusals with the product name, never a raw error', async () => {
  for (const [message, expected] of [
    ['insufficient_stock:v1', 'Insufficient stock for Shirt'],
    ['rental_unavailable:p2', 'Tent is not available for the selected dates'],
  ]) {
    const { db } = fakeDb(() => ({ data: null, error: { message, code: 'PT409' } }))
    assert.deepEqual(await createCommerceOrderWithClient(input, deps(db)), { success: false, error: expected })
  }
  const logged = mock.method(console, 'error', () => {})
  const { db } = fakeDb(() => ({ data: null, error: { message: 'totals_mismatch', code: 'PT409' } }))
  assert.deepEqual(await createCommerceOrderWithClient(input, deps(db)), { success: false, error: 'Failed to create order' })
  assert.equal(logged.mock.callCount(), 1)
  logged.mock.restore()
})

test('creation refuses bad input before writing anything', async () => {
  const { db, calls } = fakeDb(() => ({ data: null, error: null }))
  const cases = [
    { ...input, items: [] },
    { ...input, items: [{ productId: 'p1', variantId: 'v1', quantity: 0 }] },
    { ...input, items: [{ productId: 'p1', quantity: 1 }] },
    { ...input, items: [{ productId: 'p2', quantity: 1, rentalDurationDays: 2, rentalStartDate: '2026-09-01' }] },
    { ...input, items: [{ productId: 'missing', quantity: 1 }] },
    { ...input, items: [{ productId: 'p2', quantity: 1, rentalDurationDays: 2, rentalStartDate: '2030-02-30' }] },
  ]
  for (const bad of cases) assert.equal((await createCommerceOrderWithClient(bad, deps(db))).success, false)
  assert.equal(calls.length, 0)
})

test('a status change goes to the transactional function with the status the screen saw', async () => {
  const { db, calls } = fakeDb(() => ({ data: { id: 'o1', status: 'cancelled' }, error: null }))
  const result = await applyOrderPatchWithClient(db as never, 'o1', { status: 'cancelled', expectedStatus: 'ready' })
  assert.deepEqual(calls, [{
    name: 'weemap_set_commerce_order_status',
    args: { p_order_id: 'o1', p_expected_status: 'ready', p_status: 'cancelled' },
  }])
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.transition, 'cancelled')

  const reopened = await applyOrderPatchWithClient(db as never, 'o1', { status: 'new', expectedStatus: 'cancelled' })
  assert.equal(reopened.ok && reopened.transition, 'reopened')
})

test('database refusals map to clear 404 / 409 answers', async () => {
  const cases: [string, number, string | undefined][] = [
    ['not_found', 404, undefined],
    ['stale_status', 409, 'stale_status'],
    ['invalid_transition', 409, 'invalid_transition'],
    ['insufficient_stock:v1', 409, 'insufficient_stock'],
  ]
  for (const [message, status, code] of cases) {
    const { db } = fakeDb(() => ({ data: null, error: { message, code: 'PT409' } }))
    const result = await applyOrderPatchWithClient(db as never, 'o1', { status: 'completed', expectedStatus: 'ready' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, status, message)
      assert.equal(result.code, code, message)
    }
  }
})

test('a notes-only edit is a plain write and never calls the status function', async () => {
  const updates: Row[] = []
  const { db, calls } = fakeDb(() => ({ data: null, error: null }), updates)
  const result = await applyOrderPatchWithClient(db as never, 'o1', { internal_notes: 'Call before noon' })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 0)
  assert.deepEqual(updates, [{ table: 'commerce_orders', internal_notes: 'Call before noon' }])
})
