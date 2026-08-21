import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const categorySchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  applies_to: z.enum(['sale', 'rental', 'both']).default('both'),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description_ar: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  image_url: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).optional().default(0),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_categories')
    .select('*')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  return NextResponse.json({ categories: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = categorySchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('commerce_categories').insert(validated.data).select().single()
  if (error) {
    console.error('POST commerce_category error:', error)
    return NextResponse.json({ error: 'Failed to create category (slug may already exist)' }, { status: 500 })
  }
  return NextResponse.json({ category: data }, { status: 201 })
}
