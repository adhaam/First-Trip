'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, ChevronRight, Download, Loader2, Plus, RefreshCw } from 'lucide-react'
import { EXPERIENCE_BOOKING_STATUSES, type ExperienceBookingStatus, type ExperienceWithDates } from '@/lib/experiences'
import { applyDiscount } from '@/lib/pricing'

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
  /** Pass the experience(s) with their dates embedded to enable "Add manual booking". */
  experiences?: ExperienceWithDates[]
}

const EMPTY_MANUAL = {
  experience_id: '',
  experience_date_id: '',
  full_name: '',
  phone: '',
  email: '',
  spots_requested: 1,
  notes: '',
  status: 'confirmed' as 'pending' | 'confirmed' | 'cancelled',
  payment_status: 'unpaid' as 'unpaid' | 'partial' | 'paid' | 'refunded',
  amount_paid: '',
  payment_channel: '' as string,
  payment_received_by: '',
  discount_value: '',
  discount_type: '' as string,
}

export function ExperienceBookingsTable({ experienceId, dateId, onStatusChanged, experiences }: ExperienceBookingsTableProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manual, setManual] = useState(EMPTY_MANUAL)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState('')

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

  const patchBooking = async (id: string, patch: Record<string, unknown>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
    await fetch(`/api/admin/experience-bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  const selectedExperience = experiences?.find((e) => e.id === manual.experience_id)
  const selectedDate = selectedExperience?.dates.find((d) => d.id === manual.experience_date_id)
  const manualUnitPrice = selectedDate?.price_override ?? selectedExperience?.price ?? 0
  const manualQuotedPrice = manualUnitPrice * (Number(manual.spots_requested) || 0)
  const manualFinalPrice = manual.discount_value && manual.discount_type
    ? applyDiscount(manualQuotedPrice, Number(manual.discount_value), manual.discount_type).final
    : manualQuotedPrice

  const submitManual = async () => {
    setManualError('')
    if (!manual.experience_date_id || !manual.full_name.trim() || !manual.phone.trim()) {
      setManualError('Pick a date and fill in name + phone')
      return
    }
    setManualSaving(true)
    try {
      const res = await fetch('/api/admin/experience-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience_date_id: manual.experience_date_id,
          full_name: manual.full_name.trim(),
          phone: manual.phone.trim(),
          email: manual.email || undefined,
          spots_requested: Number(manual.spots_requested) || 1,
          notes: manual.notes || undefined,
          status: manual.status,
          payment_status: manual.payment_status,
          amount_paid: manual.amount_paid ? Number(manual.amount_paid) : undefined,
          payment_channel: manual.payment_channel || undefined,
          payment_received_by: manual.payment_received_by || undefined,
          discount_value: manual.discount_value ? Number(manual.discount_value) : undefined,
          discount_type: manual.discount_type || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')
      setBookings((prev) => [data.booking, ...prev])
      setManual(EMPTY_MANUAL)
      setShowManualForm(false)
      await onStatusChanged?.()
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Failed to create booking')
    } finally {
      setManualSaving(false)
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
          {experiences && experiences.length > 0 && (
            <Button size="sm" onClick={() => setShowManualForm((v) => !v)} className="bg-brand-blue hover:bg-brand-blue-dark text-white">
              <Plus className="mr-1 h-4 w-4" />
              Add manual booking
            </Button>
          )}
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

      {showManualForm && experiences && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">New manual booking</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs">Experience *</Label>
              <Select value={manual.experience_id} onValueChange={(v) => v && setManual((m) => ({ ...m, experience_id: v, experience_date_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                <SelectContent>
                  {experiences.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title_en || e.title_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Date *</Label>
              <Select value={manual.experience_date_id} onValueChange={(v) => v && setManual((m) => ({ ...m, experience_date_id: v }))} disabled={!selectedExperience}>
                <SelectTrigger><SelectValue placeholder="Select date" /></SelectTrigger>
                <SelectContent>
                  {selectedExperience?.dates.filter((d) => d.status !== 'cancelled').map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.start_date} → {d.end_date} ({d.spots_remaining} left)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Spots</Label>
              <Input type="number" min={1} value={manual.spots_requested} onChange={(e) => setManual((m) => ({ ...m, spots_requested: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Customer name *</Label>
              <Input value={manual.full_name} onChange={(e) => setManual((m) => ({ ...m, full_name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Phone *</Label>
              <Input dir="ltr" value={manual.phone} onChange={(e) => setManual((m) => ({ ...m, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Email</Label>
              <Input dir="ltr" value={manual.email} onChange={(e) => setManual((m) => ({ ...m, email: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <Select value={manual.status} onValueChange={(v) => v && setManual((m) => ({ ...m, status: v as typeof m.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Payment status</Label>
              <Select value={manual.payment_status} onValueChange={(v) => v && setManual((m) => ({ ...m, payment_status: v as typeof m.payment_status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Amount paid</Label>
              <Input type="number" min={0} value={manual.amount_paid} onChange={(e) => setManual((m) => ({ ...m, amount_paid: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Payment channel</Label>
              <Select value={manual.payment_channel || '_none'} onValueChange={(v) => setManual((m) => ({ ...m, payment_channel: v === '_none' ? '' : (v ?? '') }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Not set</SelectItem>
                  <SelectItem value="instapay">InstaPay</SelectItem>
                  <SelectItem value="vodafonecash">Vodafone Cash</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Received by</Label>
              <Input placeholder="Employee / provider" value={manual.payment_received_by} onChange={(e) => setManual((m) => ({ ...m, payment_received_by: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Discount</Label>
              <Input type="number" min={0} placeholder="None" value={manual.discount_value} onChange={(e) => setManual((m) => ({ ...m, discount_value: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Discount type</Label>
              <Select value={manual.discount_type || '_none'} onValueChange={(v) => setManual((m) => ({ ...m, discount_type: v === '_none' ? '' : (v ?? '') }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="percentage">Percentage %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedDate && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
              Auto-calculated price: <strong>{manualQuotedPrice.toLocaleString()} {selectedExperience?.currency}</strong>
              {manualFinalPrice !== manualQuotedPrice && (
                <> → after discount: <strong>{manualFinalPrice.toLocaleString()} {selectedExperience?.currency}</strong></>
              )}
            </div>
          )}
          {manualError && <p className="text-xs text-red-600 font-medium">{manualError}</p>}
          <div className="flex gap-2">
            <Button onClick={submitManual} disabled={manualSaving} className="bg-brand-blue hover:bg-brand-blue-dark text-white">
              {manualSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Save booking
            </Button>
            <Button variant="outline" onClick={() => { setShowManualForm(false); setManualError('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

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
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-gray-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-gray-500">No bookings yet.</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((b) => {
              const isOpen = expandedId === b.id
              return (
              <Fragment key={b.id}>
              <TableRow className="cursor-pointer" onClick={() => setExpandedId(isOpen ? null : b.id)}>
                <TableCell className="font-medium">{b.full_name}</TableCell>
                <TableCell dir="ltr" onClick={(e) => e.stopPropagation()}>
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
                <TableCell onClick={(e) => e.stopPropagation()}>
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
                <TableCell>{isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}</TableCell>
              </TableRow>
              {isOpen && (
                <TableRow>
                  <TableCell colSpan={10} className="bg-gray-50 p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <Label className="text-xs text-gray-500">Amount paid</Label>
                        <Input
                          type="number" min={0} dir="ltr" className="mt-1 h-8"
                          defaultValue={b.amount_paid ?? 0}
                          onBlur={e => {
                            const v = Number(e.target.value) || 0
                            if (v !== Number(b.amount_paid || 0)) patchBooking(b.id, { amount_paid: v })
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Payment status</Label>
                        <Select value={b.payment_status || 'unpaid'} onValueChange={(v) => v && patchBooking(b.id, { payment_status: v })}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Payment channel</Label>
                        <Select value={b.payment_channel || '_none'} onValueChange={(v) => patchBooking(b.id, { payment_channel: v === '_none' ? null : v })}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Not set</SelectItem>
                            <SelectItem value="instapay">InstaPay</SelectItem>
                            <SelectItem value="vodafonecash">Vodafone Cash</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Received by</Label>
                        <Input
                          placeholder="Employee / hotel / provider"
                          className="mt-1 h-8 text-xs"
                          defaultValue={b.payment_received_by || ''}
                          onBlur={e => { if (e.target.value !== (b.payment_received_by || '')) patchBooking(b.id, { payment_received_by: e.target.value }) }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Discount value</Label>
                        <Input
                          type="number" min={0} dir="ltr" className="mt-1 h-8"
                          placeholder="None"
                          defaultValue={b.discount_value ?? ''}
                          onBlur={e => {
                            const v = e.target.value === '' ? null : Number(e.target.value)
                            if (v !== (b.discount_value ?? null)) patchBooking(b.id, { discount_value: v })
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Discount type</Label>
                        <Select value={b.discount_type || '_none'} onValueChange={(v) => patchBooking(b.id, { discount_type: v === '_none' ? null : v })}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            <SelectItem value="amount">Amount</SelectItem>
                            <SelectItem value="percentage">Percentage %</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {!!b.discount_value && b.discount_type && (
                        <div className="text-sm self-end pb-2">
                          <span className="text-xs text-gray-500">After discount: </span>
                          <span className="font-semibold text-green-700">
                            {applyDiscount(Number(b.quoted_price) || 0, b.discount_value, b.discount_type).final.toLocaleString()} {b.currency}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
              )
            })}
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
