import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const tripUpdateSchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  category_ar: z.string().optional(),
  category_en: z.string().optional(),
  images: z.array(z.string()).optional(),
  duration: z.string().optional(),
  duration_en: z.string().optional(),
  price: z.number().min(0).optional(),
  // Package cost — used when this trip is included in a package (null = unset).
  package_price: z.number().min(0).nullable().optional(),
  includes_ar: z.array(z.string()).optional(),
  includes_en: z.array(z.string()).optional(),
  sort_order: z.number().int().min(0).optional(),
  discount_value: z.number().min(0).nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  discount_label: z.string().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = tripUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('sinai_trips').update(validated.data).eq('id', id).select().single()
  if (error) {
    console.error('PATCH sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }
  return NextResponse.json({ trip: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('sinai_trips').delete().eq('id', id)
  if (error) {
    console.error('DELETE sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
