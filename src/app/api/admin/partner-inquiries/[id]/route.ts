import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  status: z.enum(['new', 'contacted', 'in_discussion', 'closed']).optional(),
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
    .from('partner_inquiries')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 })
  return NextResponse.json({ inquiry: data })
}
