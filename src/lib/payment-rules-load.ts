import 'server-only'

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase'
import { DEFAULT_PAYMENT_METHODS, DEFAULT_PAYMENT_POLICIES, type PaymentMethod, type PaymentPolicy } from './payment-rules'

let warnedMissingTables = false

type PaymentRules = { policies: PaymentPolicy[], methods: PaymentMethod[] }

function missingTables(error: { code?: string | null } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function fallback(): PaymentRules {
  return { policies: [...DEFAULT_PAYMENT_POLICIES], methods: [...DEFAULT_PAYMENT_METHODS] }
}

/** Loads active rules; the migration seed remains the safe fallback during rollout. */
export async function getPaymentRules(): Promise<PaymentRules> {
  if (!isSupabaseConfigured()) return fallback()
  const supabase = getSupabaseAdmin()
  const [policiesResult, methodsResult] = await Promise.all([
    supabase.from('payment_policies').select('booking_kind, upfront_percent, upfront_due, balance_due, is_active').eq('is_active', true),
    supabase.from('payment_methods').select('code, name_ar, name_en, on_request_only, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true }),
  ])
  if (missingTables(policiesResult.error) || missingTables(methodsResult.error)) {
    if (!warnedMissingTables) {
      warnedMissingTables = true
      console.warn('Payment policy tables are unavailable; using migration defaults.')
    }
    return fallback()
  }
  if (policiesResult.error || methodsResult.error) {
    console.error('getPaymentRules error:', policiesResult.error ?? methodsResult.error)
    return { policies: [], methods: [] }
  }
  return {
    policies: (policiesResult.data ?? []).map((row) => ({ ...row, upfront_percent: Number(row.upfront_percent) })) as PaymentPolicy[],
    methods: (methodsResult.data ?? []).map((row) => ({ ...row, sort_order: Number(row.sort_order) })) as PaymentMethod[],
  }
}
