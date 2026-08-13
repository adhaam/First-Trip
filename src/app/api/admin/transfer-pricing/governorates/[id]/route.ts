import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  price_surcharge: z.number().min(0).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()

  // Guard the Cairo baseline (see the POST route for why).
  if (validated.data.price_surcharge !== undefined && validated.data.price_surcharge !== 0) {
    const { data: existing } = await supabase
      .from('transfer_governorate_pricing')
      .select('governorate_code')
      .eq('id', id)
      .single()
    if (existing?.governorate_code === 'cairo') {
      return NextResponse.json(
        { error: 'Cairo is the base price and must have a surcharge of 0' },
        { status: 400 },
      )
    }
  }

  const { data, error } = await supabase
    .from('transfer_governorate_pricing')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PATCH transfer governorate error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  return NextResponse.json({
    governorate: { ...data, price_surcharge: Number(data.price_surcharge) },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: existing } = await supabase
    .from('transfer_governorate_pricing')
    .select('governorate_code')
    .eq('id', id)
    .single()

  if (existing?.governorate_code === 'cairo') {
    return NextResponse.json(
      { error: 'Cairo is the base price row and cannot be deleted' },
      { status: 400 },
    )
  }

  const { error } = await supabase.from('transfer_governorate_pricing').delete().eq('id', id)
  if (error) {
    console.error('DELETE transfer governorate error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
