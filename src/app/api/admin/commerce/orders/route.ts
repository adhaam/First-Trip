import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { searchParams } = new URL(req.url)
  const orderType = searchParams.get('order_type')
  let query = supabase
    .from('commerce_orders')
    .select('*, customers(name, phone), commerce_order_items(*)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (orderType === 'merch' || orderType === 'rental' || orderType === 'mixed') {
    query = query.eq('order_type', orderType)
  }
  const { data, error } = await query
  if (error) {
    console.error('GET commerce_orders error:', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
  return NextResponse.json({ orders: data })
}
