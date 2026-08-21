import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

// Creates an option (e.g. "Size") together with its values (e.g. S/M/L/XL)
// in one call — the common case in the admin UI.
const optionSchema = z.object({
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  sort_order: z.number().int().min(0).optional().default(0),
  values: z.array(z.object({ value_ar: z.string().min(1), value_en: z.string().min(1) })).min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = optionSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data: option, error: optionError } = await supabase
    .from('commerce_product_options')
    .insert({ product_id: id, name_ar: validated.data.name_ar, name_en: validated.data.name_en, sort_order: validated.data.sort_order })
    .select()
    .single()
  if (optionError || !option) return NextResponse.json({ error: 'Failed to create option' }, { status: 500 })

  const { data: values, error: valuesError } = await supabase
    .from('commerce_product_option_values')
    .insert(validated.data.values.map((v, i) => ({ option_id: option.id, value_ar: v.value_ar, value_en: v.value_en, sort_order: i })))
    .select()
  if (valuesError) return NextResponse.json({ error: 'Failed to create option values' }, { status: 500 })

  return NextResponse.json({ option: { ...option, commerce_product_option_values: values } }, { status: 201 })
}
