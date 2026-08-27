import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const packageUpdateSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  short_description_ar: z.string().optional(),
  short_description_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  image: z.string().optional(),
  badge_ar: z.string().optional(),
  badge_en: z.string().optional(),
  package_category_id: z.string().uuid().nullable().optional(),
  featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  trip_ids: z.array(z.string().uuid()).optional(),
})

async function validatePublishable(supabase: ReturnType<typeof getSupabaseAdmin>, tripIds: string[]): Promise<string | null> {
  if (tripIds.length === 0) return 'A published package must include at least one trip.'
  const { data: trips, error } = await supabase
    .from('sinai_trips')
    .select('id, package_price')
    .in('id', tripIds)
  if (error) return 'Could not verify included trips.'
  const byId = new Map((trips || []).map((t) => [t.id, t]))
  for (const id of tripIds) {
    const trip = byId.get(id)
    const pkg = Number(trip?.package_price)
    if (!trip || !Number.isFinite(pkg) || pkg <= 0) {
      return `Trip ${id} has no valid package_price — set one before publishing this package.`
    }
  }
  return null
}

async function writeItems(supabase: ReturnType<typeof getSupabaseAdmin>, packageId: string, tripIds: string[]) {
  await supabase.from('trip_package_items').delete().eq('package_id', packageId)
  if (tripIds.length === 0) return
  const rows = tripIds.map((trip_id, sort_order) => ({ package_id: packageId, trip_id, sort_order }))
  await supabase.from('trip_package_items').insert(rows)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = packageUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { trip_ids, ...fields } = validated.data
  const supabase = getSupabaseAdmin()

  // Publishing (or already-published + still active after this edit) always
  // re-validates against whatever the final trip list is — a rename/edit
  // that removes a priced trip cannot leave a package silently invalid-live.
  const willBeActive = fields.is_active ?? (await supabase.from('trip_packages').select('is_active').eq('id', id).single()).data?.is_active
  if (willBeActive) {
    const { data: existingItems } = await supabase.from('trip_package_items').select('trip_id, sort_order').eq('package_id', id).order('sort_order')
    const finalTripIds = trip_ids ?? (existingItems || []).map((i) => i.trip_id)
    const err = await validatePublishable(supabase, finalTripIds)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('trip_packages')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update trip package' }, { status: 500 })

  if (trip_ids) await writeItems(supabase, id, trip_ids)
  return NextResponse.json({ package: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('trip_packages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete trip package' }, { status: 500 })
  return NextResponse.json({ success: true })
}
