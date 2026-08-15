import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const updateSchema = z.object({
  name: z.string().max(120).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  single_price: z.number().min(0).optional(),
  double_price: z.number().min(0).optional(),
  triple_price: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

const OVERLAP_SQLSTATE = '23P01' // exclusion_violation

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('accommodation_seasonal_rates')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    if (error.code === OVERLAP_SQLSTATE) {
      return NextResponse.json(
        { error: 'This period overlaps an existing active period for this accommodation.' },
        { status: 409 },
      )
    }
    console.error('PATCH seasonal rate error:', error)
    return NextResponse.json({ error: 'Failed to update seasonal rate' }, { status: 500 })
  }
  return NextResponse.json({ rate: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('accommodation_seasonal_rates').delete().eq('id', id)
  if (error) {
    console.error('DELETE seasonal rate error:', error)
    return NextResponse.json({ error: 'Failed to delete seasonal rate' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
