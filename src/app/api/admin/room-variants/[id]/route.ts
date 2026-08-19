import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

const TABLE = 'accommodation_room_variants'

const patchSchema = z.object({
  base_room_type: z.enum(['single', 'double', 'triple']).optional(),
  name_ar: z.string().min(1).max(100).optional(),
  name_en: z.string().min(1).max(100).optional(),
  occupancy: z.number().int().min(1).max(10).optional(),
  price_per_night: z.number().min(0).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ok = await requireAdmin(req as Parameters<typeof requireAdmin>[0])
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variant: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ok = await requireAdmin(req as Parameters<typeof requireAdmin>[0])
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from(TABLE).delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
