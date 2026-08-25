import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const SECTIONS = ['rent', 'merch', 'sinai_trips'] as const

const promoCodeSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, - and _'),
  label: z.string().max(200).optional().default(''),
  discount_type: z.enum(['amount', 'percentage']),
  discount_value: z.number().positive(),
  applies_to: z.array(z.enum(SECTIONS)).min(1, 'Pick at least one section'),
  is_active: z.boolean().optional().default(true),
  starts_at: z.string().datetime().nullable().optional().default(null),
  expires_at: z.string().datetime().nullable().optional().default(null),
  max_uses: z.number().int().positive().nullable().optional().default(null),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('GET promo_codes error:', error)
    return NextResponse.json({ error: 'Failed to load promo codes' }, { status: 500 })
  }
  return NextResponse.json({ promoCodes: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = promoCodeSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message || 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('promo_codes')
    .insert({ ...validated.data, code: validated.data.code.toUpperCase() })
    .select()
    .single()

  if (error) {
    console.error('POST promo_code error:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A promo code with this code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 })
  }
  return NextResponse.json({ promoCode: data }, { status: 201 })
}
