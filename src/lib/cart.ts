// ─── WEEMAP SINAI — Cart serialization (pure, no I/O) ───
// Deliberately framework-free so it's unit-testable and reusable from the
// CartProvider (client) without dragging React into the test file.
//
// IMPORTANT: this is UX state only. It is never trusted as pricing/inventory
// authority — see createCommerceOrder() in src/lib/orders.ts, which recomputes
// everything server-side from the database at checkout time.

import type { CartItem, CartState, FulfillmentMethod } from './commerce-types'

export const CART_STORAGE_KEY = 'weemap_cart_v2'
const CART_VERSION = 2 as const

export function emptyCart(): CartState {
  return { version: CART_VERSION, items: [], fulfillmentMethod: 'pickup', deliveryZoneId: null, deliveryAddress: '' }
}

function isFulfillment(v: unknown): v is FulfillmentMethod {
  return v === 'pickup' || v === 'delivery'
}

function isValidItem(v: unknown): v is CartItem {
  if (!v || typeof v !== 'object') return false
  const i = v as Record<string, unknown>
  if (typeof i.lineId !== 'string' || typeof i.productId !== 'string') return false
  if (typeof i.quantity !== 'number' || i.quantity < 1) return false
  if (i.kind === 'merch') return true
  if (i.kind === 'rental') {
    return typeof i.startDate === 'string' && typeof i.endDate === 'string' && typeof i.durationDays === 'number'
  }
  return false
}

/**
 * Parses a raw localStorage string into a valid CartState. Any malformed,
 * corrupted, or old-version payload safely recovers to an empty cart instead
 * of throwing — a customer should never get stuck on a broken cart.
 */
export function parseCart(raw: string | null): CartState {
  if (!raw) return emptyCart()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CART_VERSION) return emptyCart()
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isValidItem) : []
    return {
      version: CART_VERSION,
      items,
      fulfillmentMethod: isFulfillment(parsed.fulfillmentMethod) ? parsed.fulfillmentMethod : 'pickup',
      deliveryZoneId: typeof parsed.deliveryZoneId === 'string' ? parsed.deliveryZoneId : null,
      deliveryAddress: typeof parsed.deliveryAddress === 'string' ? parsed.deliveryAddress : '',
    }
  } catch {
    return emptyCart()
  }
}

export function serializeCart(state: CartState): string {
  return JSON.stringify(state)
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPriceEstimate * i.quantity, 0)
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

/** Two merch lines merge only when product+variant match exactly. */
export function findMergeableLine(items: CartItem[], candidate: CartItem): CartItem | undefined {
  if (candidate.kind === 'merch') {
    return items.find(
      (i) => i.kind === 'merch' && i.productId === candidate.productId && i.variantId === candidate.variantId,
    )
  }
  return items.find(
    (i) =>
      i.kind === 'rental' &&
      i.productId === candidate.productId &&
      i.variantId === candidate.variantId &&
      i.startDate === candidate.startDate &&
      i.durationDays === candidate.durationDays,
  )
}

export function addItem(items: CartItem[], candidate: CartItem): CartItem[] {
  const existing = findMergeableLine(items, candidate)
  if (existing) {
    return items.map((i) => (i.lineId === existing.lineId ? { ...i, quantity: i.quantity + candidate.quantity } : i))
  }
  return [...items, candidate]
}

export function removeItem(items: CartItem[], lineId: string): CartItem[] {
  return items.filter((i) => i.lineId !== lineId)
}

export function updateQuantity(items: CartItem[], lineId: string, quantity: number): CartItem[] {
  if (quantity < 1) return removeItem(items, lineId)
  return items.map((i) => (i.lineId === lineId ? { ...i, quantity } : i))
}

/** YYYY-MM-DD + duration (inclusive of start day) -> return date, no off-by-one. */
export function addRentalDays(startDateIso: string, durationDays: number): string {
  const d = new Date(startDateIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + durationDays - 1)
  return d.toISOString().slice(0, 10)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
