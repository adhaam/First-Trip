'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { ExperienceDateWithAvailability, ExperienceWithDates } from '@/lib/experiences'

interface ExperienceDatesPanelProps {
  experience: ExperienceWithDates
  onChanged: () => void | Promise<void>
  onViewBookings: (dateId: string) => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function ExperienceDatesPanel({ experience, onChanged, onViewBookings }: ExperienceDatesPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ start_date: todayIso(), end_date: todayIso(), total_spots: 10 })

  const call = async (id: string, fn: () => Promise<Response>) => {
    setBusyId(id)
    setError('')
    try {
      const res = await fn()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Request failed')
        return false
      }
      await onChanged()
      return true
    } finally {
      setBusyId(null)
    }
  }

  const addDate = async () => {
    if (draft.end_date < draft.start_date) {
      setError('End date must be on or after start date')
      return
    }
    setAdding(true)
    const ok = await call('new', () =>
      fetch('/api/admin/experience-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience_id: experience.id, ...draft }),
      }),
    )
    setAdding(false)
    if (ok) setDraft({ start_date: todayIso(), end_date: todayIso(), total_spots: 10 })
  }

  const patchDate = (date: ExperienceDateWithAvailability, patch: Record<string, unknown>) =>
    call(date.id, () =>
      fetch(`/api/admin/experience-dates/${date.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    )

  const deleteDate = (date: ExperienceDateWithAvailability) => {
    if (!confirm('Delete this trip date? Bookings on it will be deleted too.')) return
    return call(date.id, () => fetch(`/api/admin/experience-dates/${date.id}`, { method: 'DELETE' }))
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dates</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Taken</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {experience.dates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                  No trip dates yet.
                </TableCell>
              </TableRow>
            )}
            {experience.dates.map((date) => (
              <TableRow key={date.id}>
                <TableCell className="whitespace-nowrap font-medium">
                  {date.start_date} → {date.end_date}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={date.spots_taken}
                    className="w-20"
                    defaultValue={date.total_spots}
                    onBlur={(e) => {
                      const next = parseInt(e.target.value) || 0
                      if (next !== date.total_spots) patchDate(date, { total_spots: next })
                    }}
                  />
                </TableCell>
                <TableCell>{date.spots_taken}</TableCell>
                <TableCell className={date.spots_remaining <= 0 ? 'font-semibold text-red-600' : ''}>
                  {date.spots_remaining}
                </TableCell>
                <TableCell>
                  <StatusBadge date={date} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {busyId === date.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    <Button size="sm" variant="outline" onClick={() => onViewBookings(date.id)}>
                      Bookings
                    </Button>
                    {date.status === 'cancelled' ? (
                      <Button size="sm" variant="outline" onClick={() => patchDate(date, { status: 'open' })}>
                        Reopen
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => patchDate(date, { is_open: !date.is_open })}
                        >
                          {date.is_open ? 'Close booking' : 'Open booking'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => patchDate(date, { status: 'cancelled' })}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteDate(date)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border bg-gray-50 p-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">Add a trip date</h4>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="mb-1.5 block text-xs">Start date</Label>
            <Input
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">End date</Label>
            <Input
              type="date"
              min={draft.start_date}
              value={draft.end_date}
              onChange={(e) => setDraft((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Total spots</Label>
            <Input
              type="number"
              min={0}
              className="w-24"
              value={draft.total_spots}
              onChange={(e) => setDraft((p) => ({ ...p, total_spots: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <Button onClick={addDate} disabled={adding}>
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add date
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ date }: { date: ExperienceDateWithAvailability }) {
  if (date.status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>
  if (date.spots_remaining <= 0) return <Badge variant="destructive">Sold out</Badge>
  if (!date.is_open) return <Badge variant="outline">Closed</Badge>
  return <Badge className="bg-green-600">Open</Badge>
}
