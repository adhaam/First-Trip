import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { POST_CATEGORIES } from '@/lib/community'

const postSchema = z.object({
  title_ar: z.string().min(1),
  title_en: z.string().min(1),
  content_ar: z.string().optional().default(''),
  content_en: z.string().optional().default(''),
  category: z.enum(POST_CATEGORIES),
  image_url: z.string().optional().nullable(),
  video_url: z.string().optional().nullable(),
  sort_order: z.number().optional().default(0),
  is_pinned: z.boolean().optional().default(false),
  is_published: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('GET community_posts error:', error)
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 })
  }
  return NextResponse.json({ posts: data })
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const validated = postSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase.from('community_posts').insert(validated.data).select().single()
  if (error) {
    console.error('POST community_post error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
  return NextResponse.json({ post: data }, { status: 201 })
}
