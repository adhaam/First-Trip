'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { EXPERIENCE_BOOKING_STATUSES, type ExperienceBookingStatus } from '@/lib/experiences'

interface BookingRow {
  id: string
  experience_id: string
  experience_date_id: string
  full_name: string
  phone: string
  email: string
  spots_requested: number
  notes: string
  quoted_price: number | null
  currency: string
  status: ExperienceBookingStatus
  payment_status: string | null
  amount_paid: number | null
  payment_channel: string | null
  payment_received_by: string | null
  discount_value: number | null
  discount_type: string | null
  created_at: string
  experiences?: { title_ar: string; title_en: string; slug: string } | null
  experience_dates?: { start_date: string; end_date: string; total_spots: number } | null
}

interface ExperienceBookingsTableProps {
  experienceId?: string
  dateId?: string
  /** Called after a status change so parent availability numbers can refresh. */
  onStatusChanged?: () => void | Promise<void>
}

export function ExperienceBookingsTable({ experienceId, dateId, onStatusChanged }: ExperienceBookingsTableProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (experienceId) params.set('experience_id', experienceId)
      if (dateId) params.set('date_id', dateId)
      const res = await fetch(`/api/admin/experience-bookings?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load bookings')
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [experienceId, dateId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const filtered = statusFilter === 'all' ? bookings : bookings.filter((b) => b.status === statusFilter)

  const changeStatus = async (id: string, status: ExperienceBookingStatus) => {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/experience-bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to update booking')
        return
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
      await onStatusChanged?.()
    } finally {
      setBusyId(null)
    }
  }

  // Exports exactly what's on screen, BOM-prefixed so Excel reads Arabic.
  const exportCSV = () => {
    const headers = [
      'Name', 'Phone', 'Email', 'Spots', 'Notes', 'Experience', 'Start date', 'End date',
      'Quoted price', 'Currency', 'Status', 'Booking date',
    ]
    const rows = filtered.map((b) => [
      b.full_name, b.phone, b.email, String(b.spots_requested), b.notes,
      b.experiences?.title_en || b.experiences?.title_ar || '',
      b.experience_dates?.start_date || '', b.experience_dates?.end_date || '',
      b.quoted_price == null ? '' : String(b.quoted_price), b.currency, b.status,
      new Date(b.created_at).toISOString().slice(0, 10),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `experience-bookings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {EXPERIENCE_BOOKING_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">{filtered.length} booking(s)</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Spots</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Trip date</TableHead>
              <TableHead>Booked on</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-gray-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-gray-500">No bookings yet.</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.full_name}</TableCell>
                <TableCell dir="ltr">
                  <a href={`https://wa.me/${b.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">
                    {b.phone}
                  </a>
                </TableCell>
                <TableCell dir="ltr" className="max-w-[180px] truncate">{b.email}</TableCell>
                <TableCell>{b.spots_requested}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={b.notes}>{b.notes || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {b.experience_dates ? `${b.experience_dates.start_date} → ${b.experience_dates.end_date}` : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">{new Date(b.created_at).toLocaleDateString('en-GB')}</TableCell>
                <TableCell className="text-xs">
                  <span className={`inline-block rounded px-1.5 py-0.5 ${b.payment_status === 'paid' ? 'bg-green-100 text-green-700' : b.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{b.payment_status || 'unpaid'}</span>
                  {b.payment_channel && <span className="block text-gray-400 mt-0.5">{b.payment_channel}{b.payment_received_by ? ` → ${b.payment_received_by}` : ''}</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {busyId === b.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    <Select value={b.status} onValueChange={(v) => v && changeStatus(b.id, v as ExperienceBookingStatus)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE_BOOKING_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <StatusBadge status={b.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ExperienceBookingStatus }) {
  if (status === 'confirmed') return <Badge className="bg-green-600">Confirmed</Badge>
  if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>
  return <Badge className="bg-amber-500">Pending</Badge>
}
