'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'

/** Shared admin fetch: JSON headers, redirect to login on 401, throws with the server's message. */
export function useOpsFetch() {
  const locale = useLocale()
  return useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
    if (res.status === 401) {
      window.location.href = locale === 'ar' ? '/admin' : '/en/admin'
      throw new Error('unauthorized')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = new Error(data.error || 'Request failed') as Error & { code?: string; payload?: unknown }
      error.code = data.code
      error.payload = data
      throw error
    }
    return data
  }, [locale])
}
