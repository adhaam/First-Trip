import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { error } = await supabase.from('rental_availability_blocks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete availability block' }, { status: 500 })
  return NextResponse.json({ success: true })
}
