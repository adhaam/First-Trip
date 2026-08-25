import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const SECTIONS = ['rent', 'merch', 'sinai_trips'] as const

const promoCodeUpdateSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, - and _').optional(),
  label: z.string().max(200).optional(),
  discount_type: z.enum(['amount', 'percentage']).optional(),
  discount_value: z.number().positive().optional(),
  applies_to: z.array(z.enum(SECTIONS)).min(1, 'Pick at least one section').optional(),
  is_active: z.boolean().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = promoCodeUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message || 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  const patch = { ...validated.data, ...(validated.data.code ? { code: validated.data.code.toUpperCase() } : {}) }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('promo_codes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PATCH promo_code error:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A promo code with this code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 })
  }
  return NextResponse.json({ promoCode: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('promo_codes').delete().eq('id', id)
  if (error) {
    console.error('DELETE promo_code error:', error)
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
