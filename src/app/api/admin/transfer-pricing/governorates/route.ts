import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const createSchema = z.object({
  transfer_type: z.enum(['package_bus', 'hiace']),
  governorate_code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and dashes only'),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  price_surcharge: z.number().min(0).default(0),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = createSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  // Cairo is the baseline the whole model is built on — it must stay at zero,
  // otherwise "surcharge above Cairo" stops meaning anything.
  if (validated.data.governorate_code === 'cairo' && validated.data.price_surcharge !== 0) {
    return NextResponse.json(
      { error: 'Cairo is the base price and must have a surcharge of 0' },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transfer_governorate_pricing')
    .insert(validated.data)
    .select()
    .single()

  if (error) {
    console.error('POST transfer governorate error:', error)
    const conflict = error.code === '23505'
    return NextResponse.json(
      { error: conflict ? 'This governorate already exists for this transfer type' : 'Failed to create' },
      { status: conflict ? 409 : 500 },
    )
  }
  return NextResponse.json(
    { governorate: { ...data, price_surcharge: Number(data.price_surcharge) } },
    { status: 201 },
  )
}
