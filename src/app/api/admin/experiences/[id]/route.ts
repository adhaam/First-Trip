import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { experienceUpdateSchema } from '@/lib/experiences-schema'
import { slugifyExperience } from '@/lib/experiences'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = experienceUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const patch = { ...validated.data }
  const supabase = getSupabaseAdmin()

  if (patch.slug !== undefined) {
    const desired = slugifyExperience(patch.slug)
    if (!desired) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
    }
    const { data: clash } = await supabase
      .from('experiences')
      .select('id')
      .eq('slug', desired)
      .neq('id', id)
      .maybeSingle()
    if (clash) {
      return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    }
    patch.slug = desired
  }

  const { data, error } = await supabase.from('experiences').update(patch).eq('id', id).select().single()
  if (error) {
    console.error('PATCH experience error:', error)
    return NextResponse.json({ error: 'Failed to update experience' }, { status: 500 })
  }
  return NextResponse.json({ experience: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()

  // Dates and bookings cascade, so refuse to silently destroy booking history.
  const { count } = await supabase
    .from('experience_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('experience_id', id)
    .neq('status', 'cancelled')

  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'
  if ((count ?? 0) > 0 && !force) {
    return NextResponse.json(
      { error: 'Experience has active bookings', bookings: count, hint: 'Retry with ?force=true to delete anyway' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('experiences').delete().eq('id', id)
  if (error) {
    console.error('DELETE experience error:', error)
    return NextResponse.json({ error: 'Failed to delete experience' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
