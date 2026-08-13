import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const transferTypeEnum = z.enum(['package_bus', 'hiace'])

const settingsUpdateSchema = z.object({
  transfer_type: transferTypeEnum,
  base_price: z.number().min(0).optional(),
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  vehicle_ar: z.string().optional(),
  vehicle_en: z.string().optional(),
  is_active: z.boolean().optional(),
})

/** Returns both the base prices and every governorate surcharge, in one call. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()

  const [settingsRes, govRes] = await Promise.all([
    supabase.from('transfer_settings').select('*').order('transfer_type'),
    supabase
      .from('transfer_governorate_pricing')
      .select('*')
      .order('transfer_type')
      .order('sort_order', { ascending: true }),
  ])

  if (settingsRes.error || govRes.error) {
    console.error('GET transfer-pricing error:', settingsRes.error || govRes.error)
    return NextResponse.json({ error: 'Failed to load transfer pricing' }, { status: 500 })
  }

  return NextResponse.json({
    settings: (settingsRes.data ?? []).map((s) => ({ ...s, base_price: Number(s.base_price) })),
    governorates: (govRes.data ?? []).map((g) => ({
      ...g,
      price_surcharge: Number(g.price_surcharge),
    })),
  })
}

/** Updates the base (Cairo) price for one transfer type. */
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = settingsUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  const { transfer_type, ...fields } = validated.data
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transfer_settings')
    .update(fields)
    .eq('transfer_type', transfer_type)
    .select()
    .single()

  if (error) {
    console.error('PATCH transfer-settings error:', error)
    return NextResponse.json({ error: 'Failed to update transfer settings' }, { status: 500 })
  }
  return NextResponse.json({ settings: { ...data, base_price: Number(data.base_price) } })
}
