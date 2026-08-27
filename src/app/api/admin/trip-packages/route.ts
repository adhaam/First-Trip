import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const packageSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  short_description_ar: z.string().optional().default(''),
  short_description_en: z.string().optional().default(''),
  description_ar: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  image: z.string().optional().default(''),
  badge_ar: z.string().optional().default(''),
  badge_en: z.string().optional().default(''),
  package_category_id: z.string().uuid().nullable().optional(),
  featured: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).optional().default(0),
  // Ordered trip ids — array order becomes trip_package_items.sort_order.
  trip_ids: z.array(z.string().uuid()).optional().default([]),
})

/**
 * "A Trip Package cannot be published if any included trip has no valid
 * package_price" — the one server-side gate that must never be bypassed,
 * regardless of what the admin UI already checked client-side.
 */
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

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_packages')
    .select('*, trip_package_items(sort_order, sinai_trips(id, name_ar, name_en, price, package_price))')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('GET trip_packages error:', error)
    return NextResponse.json({ error: 'Failed to load trip packages' }, { status: 500 })
  }
  return NextResponse.json({ packages: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = packageSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { trip_ids, ...fields } = validated.data
  const supabase = getSupabaseAdmin()

  if (fields.is_active) {
    const err = await validatePublishable(supabase, trip_ids)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  const { data, error } = await supabase.from('trip_packages').insert(fields).select().single()
  if (error) {
    console.error('POST trip_package error:', error)
    return NextResponse.json({ error: 'Failed to create trip package (slug may already exist)' }, { status: 500 })
  }
  await writeItems(supabase, data.id, trip_ids)
  return NextResponse.json({ package: data }, { status: 201 })
}
