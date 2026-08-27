import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  service_category: z.string().optional(),
  public_description_ar: z.string().optional(),
  public_description_en: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  internal_notes: z.string().optional(),
  public_credit_enabled: z.boolean().optional(),
  is_active: z.boolean().optional(),
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
    .from('experience_partners')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 })
  return NextResponse.json({ partner: data })
}

// Soft-deactivate — experience_partner_links.partner_id is ON DELETE CASCADE
// at the DB level, but we never hard-delete a partner from the admin UI so
// past experience associations (and any historical reporting) stay intact.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('experience_partners')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to deactivate partner' }, { status: 500 })
  return NextResponse.json({ success: true })
}
