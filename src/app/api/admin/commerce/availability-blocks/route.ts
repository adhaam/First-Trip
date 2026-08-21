import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const blockSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).optional().default(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(300).optional().default(''),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('product_id')
  let query = supabase.from('rental_availability_blocks').select('*').order('start_date')
  if (productId) query = query.eq('product_id', productId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to load availability blocks' }, { status: 500 })
  return NextResponse.json({ blocks: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = blockSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  if (validated.data.end_date < validated.data.start_date) {
    return NextResponse.json({ error: 'end_date must be on or after start_date' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('rental_availability_blocks').insert(validated.data).select().single()
  if (error) return NextResponse.json({ error: 'Failed to create availability block' }, { status: 500 })
  return NextResponse.json({ block: data }, { status: 201 })
}
