import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
  applies_to: z.enum(['sale', 'rental', 'both']).optional(),
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  image_url: z.string().optional(),
  icon: z.string().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

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
    .from('commerce_categories')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  return NextResponse.json({ category: data })
}

// Soft delete only — "Deletion must respect related product data. Prefer
// archive/soft deletion where appropriate." Products referencing this
// category keep working (category_id is ON DELETE SET NULL at the DB level
// too, but we never hard-delete from the admin UI).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('commerce_categories')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to archive category' }, { status: 500 })
  return NextResponse.json({ success: true })
}
