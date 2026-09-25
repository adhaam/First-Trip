import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { COMMUNITY_LINK_TARGET_TYPES } from '@/lib/community'
import { communityLinkTargetExists, getLinkedTargetsForPost } from '@/lib/community-links'

const linkCreateSchema = z.object({
  target_type: z.enum(COMMUNITY_LINK_TARGET_TYPES),
  target_id: z.string().uuid(),
  sort_order: z.number().int().optional(),
})

/** Linked targets for the post, resolved against their live rows — what the admin editor renders. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const links = await getLinkedTargetsForPost(id)
  return NextResponse.json({ links })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id: postId } = await params
  const body = await req.json().catch(() => null)
  const validated = linkCreateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { target_type, target_id, sort_order } = validated.data

  // The target must actually exist and be public — never link a draft,
  // inactive row or an id that doesn't exist, whatever the caller sends.
  const exists = await communityLinkTargetExists(target_type, target_id)
  if (!exists) {
    return NextResponse.json({ error: 'Target not found or not public' }, { status: 404 })
  }

  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('community_post_links')
    .insert({ post_id: postId, target_type, target_id, sort_order: sort_order ?? 0 })
    .select()
    .single()
  if (error) {
    // unique(post_id, target_type, target_id) violation — not a server error.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This target is already linked' }, { status: 409 })
    }
    console.error('POST community_post_link error:', error)
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
  }
  return NextResponse.json({ link: data }, { status: 201 })
}
