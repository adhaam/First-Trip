import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

// ─────────────────────────────────────────────────────────────────────────────
// Room Variants API — migration-safe
// Returns { migrationPending: true } when the accommodation_room_variants table
// does not yet exist, so the admin UI can show a "migration required" notice
// instead of a crash.
// ─────────────────────────────────────────────────────────────────────────────

const TABLE = 'accommodation_room_variants'

const variantSchema = z.object({
  accommodation_id: z.string().uuid(),
  base_room_type: z.enum(['single', 'double', 'triple']),
  name_ar: z.string().min(1).max(100),
  name_en: z.string().min(1).max(100),
  occupancy: z.number().int().min(1).max(10),
  price_per_night: z.number().min(0),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

function isMissingTable(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    // PostgreSQL: undefined_table or relation does not exist
    return (err as { code: string }).code === '42P01'
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: string }).message).toLowerCase()
    return msg.includes('does not exist') || msg.includes('relation')
  }
  return false
}

export async function GET(req: NextRequest) {
  const ok = await requireAdmin(req as Parameters<typeof requireAdmin>[0])
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accommodationId = req.nextUrl.searchParams.get('accommodation_id')
  if (!accommodationId) return NextResponse.json({ error: 'accommodation_id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('accommodation_id', accommodationId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ migrationPending: true, variants: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ variants: data || [] })
}

export async function POST(req: NextRequest) {
  const ok = await requireAdmin(req as Parameters<typeof requireAdmin>[0])
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = variantSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(TABLE)
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ migrationPending: true }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ variant: data }, { status: 201 })
}
