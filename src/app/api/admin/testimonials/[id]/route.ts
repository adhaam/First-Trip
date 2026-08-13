import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  text_ar: z.string().max(2000).optional(),
  text_en: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  avatar_url: z.string().optional().nullable(),
  trip_ar: z.string().max(200).optional(),
  trip_en: z.string().max(200).optional(),
  source: z.string().max(40).optional(),
  source_url: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('testimonials')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PATCH testimonial error:', error)
    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 })
  }
  return NextResponse.json({ testimonial: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('testimonials').delete().eq('id', id)

  if (error) {
    console.error('DELETE testimonial error:', error)
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
