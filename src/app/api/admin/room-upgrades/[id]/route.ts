import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireStaff } from '@/lib/admin-auth'

const TABLE = 'accommodation_room_upgrades'

const patchSchema = z.object({
  name_ar: z.string().min(1).max(100).optional(),
  name_en: z.string().min(1).max(100).optional(),
  extra_price_per_night: z.number().min(0).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req as Parameters<typeof requireStaff>[0])
  if (!gate.ok) return gate.response

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ upgrade: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req as Parameters<typeof requireStaff>[0])
  if (!gate.ok) return gate.response

  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  // Prefer deactivate over hard delete; only hard-delete if explicitly forced
  const force = new URL(req.url).searchParams.get('force') === '1'
  if (force) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  }
  // Soft-delete: deactivate
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ upgrade: data })
}
