import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { validateExperiencePublishable } from '@/lib/experience-pricing'

const experienceSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  title_ar: z.string().min(1),
  title_en: z.string().min(1),
  category: z.string().nullable().optional(),
  short_description_ar: z.string().optional().default(''),
  short_description_en: z.string().optional().default(''),
  full_description_ar: z.string().optional().default(''),
  full_description_en: z.string().optional().default(''),
  included_ar: z.array(z.string()).optional().default([]),
  included_en: z.array(z.string()).optional().default([]),
  not_included_ar: z.array(z.string()).optional().default([]),
  not_included_en: z.array(z.string()).optional().default([]),
  itinerary: z.array(z.object({
    title_ar: z.string(), title_en: z.string(),
    description_ar: z.string().optional(), description_en: z.string().optional(),
  })).optional().default([]),
  hero_image: z.string().optional().default(''),
  gallery: z.array(z.string()).max(6).optional().default([]),
  duration_ar: z.string().optional().default(''),
  duration_en: z.string().optional().default(''),
  price: z.number().min(0).optional().default(0),
  currency: z.enum(['EGP', 'USD']).optional().default('EGP'),
  discount_value: z.number().nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  discount_label: z.string().optional().default(''),
  badge_ar: z.string().optional().default(''),
  badge_en: z.string().optional().default(''),
  featured: z.boolean().optional().default(false),
  starting_from_price: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published']).optional().default('draft'),
  sort_order: z.number().int().min(0).optional().default(0),
  // Ordered linked partner/trip ids — array order becomes each join table's sort_order.
  partner_ids: z.array(z.string().uuid()).optional().default([]),
  trip_ids: z.array(z.string().uuid()).optional().default([]),
})

async function writeLinks(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  experienceId: string,
  partnerIds: string[],
  tripIds: string[],
) {
  await Promise.all([
    supabase.from('experience_partner_links').delete().eq('experience_id', experienceId),
    supabase.from('experience_trips').delete().eq('experience_id', experienceId),
  ])
  await Promise.all([
    partnerIds.length > 0
      ? supabase.from('experience_partner_links').insert(
          partnerIds.map((partner_id, sort_order) => ({ experience_id: experienceId, partner_id, sort_order })),
        )
      : Promise.resolve(),
    tripIds.length > 0
      ? supabase.from('experience_trips').insert(
          tripIds.map((trip_id, sort_order) => ({ experience_id: experienceId, trip_id, sort_order })),
        )
      : Promise.resolve(),
  ])
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experiences')
    .select(`
      *,
      experience_partner_links(sort_order, experience_partners(id, name)),
      experience_trips(sort_order, sinai_trips(id, name_ar, name_en)),
      experience_dates(id, start_date, end_date, total_spots, status, is_open, price_override)
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('GET experiences error:', error)
    return NextResponse.json({ error: 'Failed to load experiences' }, { status: 500 })
  }
  return NextResponse.json({ experiences: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = experienceSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { partner_ids, trip_ids, ...fields } = validated.data

  if (fields.status === 'published') {
    const err = validateExperiencePublishable(fields.price)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('experiences').insert(fields).select().single()
  if (error) {
    console.error('POST experience error:', error)
    return NextResponse.json({ error: 'Failed to create experience (slug may already exist)' }, { status: 500 })
  }
  await writeLinks(supabase, data.id, partner_ids, trip_ids)
  return NextResponse.json({ experience: data }, { status: 201 })
}
