import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { experienceDateCreateSchema } from '@/lib/experiences-schema'

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = experienceDateCreateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('experience_dates').insert(validated.data).select().single()
  if (error) {
    console.error('POST experience_date error:', error)
    return NextResponse.json({ error: 'Failed to create trip date' }, { status: 500 })
  }
  return NextResponse.json({ date: data }, { status: 201 })
}
