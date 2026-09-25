import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('trip_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('GET trip_categories error:', error)
    return NextResponse.json({ error: 'Failed to load trip categories' }, { status: 500 })
  }
  return NextResponse.json({ categories: data })
}
