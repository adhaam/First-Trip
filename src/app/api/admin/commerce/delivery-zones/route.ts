import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const zoneSchema = z.object({
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  fee_type: z.enum(['fixed', 'free', 'quote']).default('fixed'),
  fixed_fee: z.number().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional().default(0),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('delivery_zones').select('*').order('sort_order')
  if (error) return NextResponse.json({ error: 'Failed to load delivery zones' }, { status: 500 })
  return NextResponse.json({ zones: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = zoneSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('delivery_zones').insert(validated.data).select().single()
  if (error) return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 })
  return NextResponse.json({ zone: data }, { status: 201 })
}
