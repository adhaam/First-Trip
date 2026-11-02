import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { revalidateAccommodationSurfaces } from './revalidate-public'

const mealPlanSchema = z.object({
  key: z.enum(['room_only', 'breakfast', 'half_board', 'all_inclusive']),
  label_ar: z.string(),
  label_en: z.string(),
  price_per_person_per_night: z.number().min(0),
  is_active: z.boolean(),
})

const accommodationSchema = z.object({
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  type: z.enum(['hotel', 'chalet', 'camp']),
  tier: z.string().optional(),
  description_ar: z.string().trim().optional().default(''),
  description_en: z.string().trim().optional().default(''),
  images: z.array(z.string()).optional().default([]),
  image_url: z.string().optional(),
  rating: z.number().min(1).max(5).optional().default(4),
  location: z.string().optional().default(''),
  location_ar: z.string().optional(),
  location_en: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  amenities_ar: z.array(z.string()).optional().default([]),
  amenities_en: z.array(z.string()).optional().default([]),
  price_per_night: z.number().min(0),
  price_4day: z.number().min(0),
  price_5day: z.number().min(0),
  price_double_room: z.number().min(0).optional().default(0),
  price_single_room: z.number().min(0).optional().default(0),
  price_triple_room: z.number().min(0).optional().default(0),
  meal_plans: z.array(mealPlanSchema).optional().default([]),
  sort_order: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('accommodations')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('GET accommodations error:', error)
    return NextResponse.json({ error: 'Failed to load accommodations' }, { status: 500 })
  }
  return NextResponse.json({ accommodations: data })
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const validated = accommodationSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  // The public site shows the description in the visitor's language and falls
  // back to the other one, so a new stay needs at least one of the two.
  if (!validated.data.description_ar && !validated.data.description_en) {
    return NextResponse.json(
      {
        error: 'Add a description in at least one language (Arabic or English).',
        code: 'DESCRIPTION_REQUIRED',
      },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('accommodations')
    .insert(validated.data)
    .select()
    .single()

  if (error) {
    console.error('POST accommodation error:', error)
    return NextResponse.json({ error: 'Failed to create accommodation' }, { status: 500 })
  }
  revalidateAccommodationSurfaces(data?.id)
  return NextResponse.json({ accommodation: data }, { status: 201 })
}
