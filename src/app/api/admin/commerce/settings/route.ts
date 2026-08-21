import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const settingsSchema = z.object({
  pickup_enabled: z.boolean().optional(),
  delivery_enabled: z.boolean().optional(),
  default_currency: z.string().min(1).max(10).optional(),
  orders_require_confirmation: z.boolean().optional(),
  online_payment_enabled: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('commerce_settings').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: 'Failed to load commerce settings' }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = settingsSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  // Online payment stays hard-disabled this phase regardless of what's sent —
  // "Do NOT integrate Stripe/Paymob/payment gateways... payment is disabled."
  const { online_payment_enabled: _ignored, ...safe } = validated.data
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('commerce_settings').update(safe).eq('id', 1).select().single()
  if (error) return NextResponse.json({ error: 'Failed to update commerce settings' }, { status: 500 })
  return NextResponse.json({ settings: data })
}
