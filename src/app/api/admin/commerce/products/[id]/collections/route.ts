import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const schema = z.object({ collection_ids: z.array(z.string().uuid()) })

// Replaces the full set of collections a product belongs to — the common
// case in a product editor's "assign to collections" checklist.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = schema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { error: deleteError } = await supabase.from('commerce_product_collections').delete().eq('product_id', id)
  if (deleteError) return NextResponse.json({ error: 'Failed to update collections' }, { status: 500 })

  if (validated.data.collection_ids.length > 0) {
    const { error: insertError } = await supabase.from('commerce_product_collections').insert(
      validated.data.collection_ids.map((collection_id, sort_order) => ({ product_id: id, collection_id, sort_order })),
    )
    if (insertError) return NextResponse.json({ error: 'Failed to update collections' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
