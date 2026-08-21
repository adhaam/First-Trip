'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CartItem, CartState, FulfillmentMethod } from '@/lib/commerce-types'
import {
  CART_STORAGE_KEY, addItem, cartItemCount, cartSubtotal, emptyCart, parseCart, removeItem,
  serializeCart, updateQuantity,
} from '@/lib/cart'

interface CartContextValue {
  items: CartItem[]
  fulfillmentMethod: FulfillmentMethod
  deliveryZoneId: string | null
  deliveryAddress: string
  subtotal: number
  count: number
  hydrated: boolean
  add: (item: CartItem) => void
  remove: (lineId: string) => void
  setQuantity: (lineId: string, quantity: number) => void
  setFulfillmentMethod: (method: FulfillmentMethod) => void
  setDeliveryZoneId: (id: string | null) => void
  setDeliveryAddress: (address: string) => void
  clear: () => void
  isOpen: boolean
  open: () => void
  close: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(emptyCart())
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only hydration from localStorage (SSR has no cart)
    setState(parseCart(window.localStorage.getItem(CART_STORAGE_KEY)))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(state))
  }, [state, hydrated])

  const add = useCallback((item: CartItem) => {
    setState((prev) => ({ ...prev, items: addItem(prev.items, item) }))
    setIsOpen(true)
  }, [])
  const remove = useCallback((lineId: string) => {
    setState((prev) => ({ ...prev, items: removeItem(prev.items, lineId) }))
  }, [])
  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setState((prev) => ({ ...prev, items: updateQuantity(prev.items, lineId, quantity) }))
  }, [])
  const setFulfillmentMethod = useCallback((method: FulfillmentMethod) => {
    setState((prev) => ({ ...prev, fulfillmentMethod: method }))
  }, [])
  const setDeliveryZoneId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, deliveryZoneId: id }))
  }, [])
  const setDeliveryAddress = useCallback((address: string) => {
    setState((prev) => ({ ...prev, deliveryAddress: address }))
  }, [])
  const clear = useCallback(() => setState(emptyCart()), [])

  const value = useMemo<CartContextValue>(() => ({
    items: state.items,
    fulfillmentMethod: state.fulfillmentMethod,
    deliveryZoneId: state.deliveryZoneId,
    deliveryAddress: state.deliveryAddress,
    subtotal: cartSubtotal(state.items),
    count: cartItemCount(state.items),
    hydrated,
    add, remove, setQuantity, setFulfillmentMethod, setDeliveryZoneId, setDeliveryAddress, clear,
    isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false),
  }), [state, hydrated, add, remove, setQuantity, setFulfillmentMethod, setDeliveryZoneId, setDeliveryAddress, clear, isOpen])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
