import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { tripDiscountFields, validateTripDiscount } from '@/lib/trip-discounts'
import { isMissingTripCategoryTagsTable } from '@/lib/trip-categories'
import { syncTripCategoryTags } from './tag-sync'

const tripSchema = z.object({
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description_ar: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  category_ar: z.string().optional().default(''),
  category_en: z.string().optional().default(''),
  trip_category_id: z.string().uuid().nullable().optional(),
  category_ids: z.array(z.string().uuid()).optional(),
  images: z.array(z.string()).optional().default([]),
  duration: z.string().optional().default(''),
  duration_en: z.string().optional().default(''),
  price: z.number().min(0),
  // Legacy package-cost field, retained for historical bookings/snapshots only.
  // The live pricing engine no longer reads this — included trips are free.
  package_price: z.number().min(0).nullable().optional(),
  includes_ar: z.array(z.string()).optional().default([]),
  includes_en: z.array(z.string()).optional().default([]),
  sort_order: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  ...tripDiscountFields,
}).superRefine(validateTripDiscount)

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('sinai_trips')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('GET sinai_trips error:', error)
    return NextResponse.json({ error: 'Failed to load trips' }, { status: 500 })
  }
  const trips = data ?? []
  const { data: tagRows, error: tagError } = trips.length > 0
    ? await supabase
        .from('sinai_trip_category_tags')
        .select('trip_id, category_id')
        .in('trip_id', trips.map((trip) => trip.id))
    : { data: [], error: null }

  if (tagError && !isMissingTripCategoryTagsTable(tagError)) {
    console.error('GET sinai_trip tags error:', tagError)
  }
  const tagIdsByTrip = new Map<string, string[]>()
  for (const tag of tagRows ?? []) {
    const ids = tagIdsByTrip.get(tag.trip_id) ?? []
    ids.push(tag.category_id)
    tagIdsByTrip.set(tag.trip_id, ids)
  }
  return NextResponse.json({
    trips: trips.map((trip) => ({
      ...trip,
      category_ids: Array.from(new Set([trip.trip_category_id, ...(tagIdsByTrip.get(trip.id) ?? [])].filter(Boolean))),
    })),
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const validated = tripSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { category_ids = [], ...tripData } = validated.data
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase.from('sinai_trips').insert(tripData).select().single()
  if (error) {
    console.error('POST sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }
  const tagSync = await syncTripCategoryTags(supabase, data.id, category_ids, data.trip_category_id)
  if (tagSync.error) return NextResponse.json({ error: tagSync.error }, { status: 500 })
  return NextResponse.json({ trip: data, warning: tagSync.warning }, { status: 201 })
}
