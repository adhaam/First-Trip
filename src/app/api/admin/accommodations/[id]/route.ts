import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const mealPlanSchema = z.object({
  key: z.enum(['room_only', 'breakfast', 'half_board', 'all_inclusive']),
  label_ar: z.string(),
  label_en: z.string(),
  price_per_person_per_night: z.number().min(0),
  is_active: z.boolean(),
})

const accommodationUpdateSchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  type: z.enum(['hotel', 'chalet', 'camp']).optional(),
  tier: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  images: z.array(z.string()).optional(),
  image_url: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  location: z.string().optional(),
  location_ar: z.string().optional(),
  location_en: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  amenities_ar: z.array(z.string()).optional(),
  amenities_en: z.array(z.string()).optional(),
  price_per_night: z.number().min(0).optional(),
  price_4day: z.number().min(0).optional(),
  price_5day: z.number().min(0).optional(),
  price_double_room: z.number().min(0).optional(),
  price_single_room: z.number().min(0).optional(),
  price_triple_room: z.number().min(0).optional(),
  meal_plans: z.array(mealPlanSchema).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = accommodationUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('accommodations')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PATCH accommodation error:', error)
    return NextResponse.json({ error: 'Failed to update accommodation' }, { status: 500 })
  }
  return NextResponse.json({ accommodation: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('accommodations').delete().eq('id', id)

  if (error) {
    console.error('DELETE accommodation error:', error)
    return NextResponse.json({ error: 'Failed to delete accommodation' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
