import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

// Durations are fully dynamic — admin sets whatever set of tiers fits the
// product (1/3/7/14/30 days, or just 1/7/30, etc.). Nothing is hard-coded.
const tierSchema = z.object({
  variant_id: z.string().uuid().nullable().optional(),
  duration_days: z.number().int().min(1),
  label_ar: z.string().optional().default(''),
  label_en: z.string().optional().default(''),
  price: z.number().min(0),
  sort_order: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('rental_pricing_tiers')
    .select('*')
    .eq('product_id', id)
    .order('duration_days')
  if (error) return NextResponse.json({ error: 'Failed to load pricing tiers' }, { status: 500 })
  return NextResponse.json({ tiers: data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = tierSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('rental_pricing_tiers')
    .insert({ ...validated.data, product_id: id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create pricing tier (duplicate duration?)' }, { status: 500 })
  return NextResponse.json({ tier: data }, { status: 201 })
}
