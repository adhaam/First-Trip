import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const postUpdateSchema = z.object({
  title_ar: z.string().min(1).optional(),
  title_en: z.string().min(1).optional(),
  content_ar: z.string().optional(),
  content_en: z.string().optional(),
  category: z.enum(['blog', 'hidden-gems', 'stories', 'dahab-guide']).optional(),
  image_url: z.string().optional().nullable(),
  video_url: z.string().optional().nullable(),
  sort_order: z.number().optional(),
  is_pinned: z.boolean().optional(),
  is_published: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = postUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('community_posts').update(validated.data).eq('id', id).select().single()
  if (error) {
    console.error('PATCH community_post error:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
  return NextResponse.json({ post: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('community_posts').delete().eq('id', id)
  if (error) {
    console.error('DELETE community_post error:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
