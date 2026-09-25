import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id: postId, linkId } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { error } = await supabase
    .from('community_post_links')
    .delete()
    .eq('id', linkId)
    .eq('post_id', postId)
  if (error) {
    console.error('DELETE community_post_link error:', error)
    return NextResponse.json({ error: 'Failed to remove link' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
