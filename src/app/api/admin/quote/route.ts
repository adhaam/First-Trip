import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { computeQuote, quoteSchema } from '@/lib/quote-service'

// Admin price preview for the manual booking form.
//
// Same pricing as the public /api/quote (one shared computeQuote), with two
// deliberate differences:
//   * no rate limit — the public endpoint allows 20/hour per IP, and an
//     employee entering bookings back-to-back would burn through that in
//     minutes. Access is gated by requireAdmin instead.
//   * returns the normalised `lines` breakdown so the dashboard can show WHY
//     a total is what it is, rather than just the number.
//
// The snapshot is intentionally NOT returned. A preview must never be the
// source of a stored price: /api/admin/bookings recomputes server-side at
// creation time, so a stale or tampered preview cannot reach the DB.

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const validated = quoteSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await computeQuote(validated.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      lines: result.lines,
      num_people: result.numPeople,
      per_person: result.perPerson,
      total: result.total,
      is_priced: result.isPriced,
    })
  } catch (err) {
    console.error('Admin quote error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
