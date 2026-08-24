import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getExperienceCategories } from '@/lib/experiences-data'
import { experienceCategorySchema } from '@/lib/experiences-schema'
import { slugifyExperience } from '@/lib/experiences'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ categories: await getExperienceCategories() })
}

/** Adds a custom tag. Existing slugs are updated rather than rejected. */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = experienceCategorySchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const input = validated.data
  const slug = slugifyExperience(input.slug || input.label_en || input.label_ar)
  if (!slug) {
    return NextResponse.json({ error: 'Could not derive a slug from that label' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_categories')
    .upsert({ slug, label_ar: input.label_ar, label_en: input.label_en, sort_order: input.sort_order })
    .select()
    .single()

  if (error) {
    console.error('POST experience_category error:', error)
    return NextResponse.json({ error: 'Failed to save category' }, { status: 500 })
  }
  return NextResponse.json({ category: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }
  if (slug === 'other') {
    return NextResponse.json({ error: 'The "other" tag is the fallback and cannot be deleted' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { count } = await supabase
    .from('experiences')
    .select('id', { count: 'exact', head: true })
    .eq('category', slug)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `${count} experience(s) still use this tag`, experiences: count },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('experience_categories').delete().eq('slug', slug)
  if (error) {
    console.error('DELETE experience_category error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
