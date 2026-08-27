import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { validateExperiencePublishable } from '@/lib/experience-pricing'

const experienceUpdateSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  title_ar: z.string().min(1).optional(),
  title_en: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  short_description_ar: z.string().optional(),
  short_description_en: z.string().optional(),
  full_description_ar: z.string().optional(),
  full_description_en: z.string().optional(),
  included_ar: z.array(z.string()).optional(),
  included_en: z.array(z.string()).optional(),
  not_included_ar: z.array(z.string()).optional(),
  not_included_en: z.array(z.string()).optional(),
  itinerary: z.array(z.object({
    title_ar: z.string(), title_en: z.string(),
    description_ar: z.string().optional(), description_en: z.string().optional(),
  })).optional(),
  hero_image: z.string().optional(),
  gallery: z.array(z.string()).max(6).optional(),
  duration_ar: z.string().optional(),
  duration_en: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.enum(['EGP', 'USD']).optional(),
  discount_value: z.number().nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  discount_label: z.string().optional(),
  badge_ar: z.string().optional(),
  badge_en: z.string().optional(),
  featured: z.boolean().optional(),
  starting_from_price: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
  sort_order: z.number().int().min(0).optional(),
  partner_ids: z.array(z.string().uuid()).optional(),
  trip_ids: z.array(z.string().uuid()).optional(),
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
  const { partner_ids, trip_ids, ...fields } = validated.data
  const supabase = getSupabaseAdmin()

  if (fields.status === 'published') {
    const price = fields.price ?? (await supabase.from('experiences').select('price').eq('id', id).single()).data?.price
    const err = validateExperiencePublishable(price)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('experiences')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update experience' }, { status: 500 })

  if (partner_ids !== undefined || trip_ids !== undefined) {
    await writeLinks(supabase, id, partner_ids ?? [], trip_ids ?? [])
  }
  return NextResponse.json({ experience: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('experiences').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete experience' }, { status: 500 })
  return NextResponse.json({ success: true })
}
