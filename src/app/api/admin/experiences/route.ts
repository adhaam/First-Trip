import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAllExperiences } from '@/lib/experiences-data'
import { experienceCreateSchema } from '@/lib/experiences-schema'
import { slugifyExperience } from '@/lib/experiences'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const experiences = await getAllExperiences()
  return NextResponse.json({ experiences })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = experienceCreateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const input = validated.data
  const baseSlug =
    slugifyExperience(input.slug || input.title_en || input.title_ar) || `experience-${Date.now()}`

  const supabase = getSupabaseAdmin()

  // Slugs are unique and user-visible, so suffix rather than reject.
  let slug = baseSlug
  for (let attempt = 1; attempt <= 20; attempt++) {
    const { data: clash } = await supabase.from('experiences').select('id').eq('slug', slug).maybeSingle()
    if (!clash) break
    slug = `${baseSlug}-${attempt + 1}`
  }

  const { data, error } = await supabase
    .from('experiences')
    .insert({ ...input, slug })
    .select()
    .single()

  if (error) {
    console.error('POST experience error:', error)
    return NextResponse.json({ error: 'Failed to create experience' }, { status: 500 })
  }
  return NextResponse.json({ experience: data }, { status: 201 })
}
