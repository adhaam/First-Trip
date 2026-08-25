import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { looksLikeRawId, NOT_RAW_ID_MESSAGE } from '@/lib/validation'

const tripSchema = z.object({
  name_ar: z.string().min(1).refine((v) => !looksLikeRawId(v), NOT_RAW_ID_MESSAGE),
  name_en: z.string().min(1).refine((v) => !looksLikeRawId(v), NOT_RAW_ID_MESSAGE),
  description_ar: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  category_ar: z.string().optional().default(''),
  category_en: z.string().optional().default(''),
  images: z.array(z.string()).optional().default([]),
  duration: z.string().optional().default(''),
  duration_en: z.string().optional().default(''),
  price: z.number().min(0),
  // What WEEMAP uses when this trip is one of the two included package trips.
  // null = not configured yet → the pricing engine falls back to `price`.
  package_price: z.number().min(0).nullable().optional(),
  includes_ar: z.array(z.string()).optional().default([]),
  includes_en: z.array(z.string()).optional().default([]),
  sort_order: z.number().int().min(0).optional().default(0),
  discount_value: z.number().min(0).nullable().optional().default(null),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional().default(null),
  discount_label: z.string().optional().default(''),
  is_active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('sinai_trips')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('GET sinai_trips error:', error)
    return NextResponse.json({ error: 'Failed to load trips' }, { status: 500 })
  }
  return NextResponse.json({ trips: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = tripSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.issues[0]?.message || 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('sinai_trips').insert(validated.data).select().single()
  if (error) {
    console.error('POST sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }
  return NextResponse.json({ trip: data }, { status: 201 })
}
