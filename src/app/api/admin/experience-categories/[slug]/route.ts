import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

// slug is the primary key and intentionally not editable here — experiences
// reference it by FK; renaming would need a dedicated migration path.
const updateSchema = z.object({
  label_ar: z.string().min(1).optional(),
  label_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_categories')
    .update(validated.data)
    .eq('slug', slug)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  return NextResponse.json({ category: data })
}
