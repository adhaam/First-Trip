'use client'

// ─── Seasonal pricing periods for one accommodation ───
// Table of named date ranges with single/double/triple nightly rates.
// Overlap protection lives in the DB (EXCLUDE constraint) — the API returns a
// clear 409 which we surface verbatim. The pricing engine resolves each night
// of a stay against these periods individually (see src/lib/pricing.ts).

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { CalendarRange, Copy, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { AccommodationSeasonalRate } from '@/lib/types'

interface DraftRate {
  id?: string
  name: string
  start_date: string
  end_date: string
  single_price: string
  double_price: string
  triple_price: string
}

const emptyDraft: DraftRate = {
  name: '', start_date: '', end_date: '',
  single_price: '0', double_price: '0', triple_price: '0',
}

export function SeasonalRatesEditor({ accommodationId, locale }: {
  accommodationId: string
  locale: string
}) {
  const ar = locale === 'ar'
  const [rates, setRates] = useState<AccommodationSeasonalRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<DraftRate | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/seasonal-rates?accommodation_id=${accommodationId}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) setRates(data.rates || [])
    } finally {
      setLoading(false)
    }
  }, [accommodationId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const saveDraft = async () => {
    if (!draft) return
    setError('')
    if (!draft.start_date || !draft.end_date) {
      setError(ar ? 'تاريخ البداية والنهاية مطلوبين' : 'Start and end dates are required')
      return
    }
    if (draft.end_date < draft.start_date) {
      setError(ar ? 'تاريخ النهاية قبل البداية' : 'End date is before the start date')
      return
    }
    setSaving(true)
    try {
      const payload = {
        accommodation_id: accommodationId,
        name: draft.name,
        start_date: draft.start_date,
        end_date: draft.end_date,
        single_price: Number(draft.single_price) || 0,
        double_price: Number(draft.double_price) || 0,
        triple_price: Number(draft.triple_price) || 0,
      }
      const res = draft.id
        ? await fetch(`/api/admin/seasonal-rates/${draft.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, accommodation_id: undefined }),
          })
        : await fetch('/api/admin/seasonal-rates', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || (ar ? 'فشل الحفظ' : 'Save failed'))
        return
      }
      setDraft(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (rate: AccommodationSeasonalRate) => {
    if (!confirm(ar ? `متأكد من حذف فترة "${rate.name || rate.start_date}"؟` : `Delete period "${rate.name || rate.start_date}"?`)) return
    const res = await fetch(`/api/admin/seasonal-rates/${rate.id}`, { method: 'DELETE' })
    if (res.ok) setRates(prev => prev.filter(r => r.id !== rate.id))
  }

  const toggleActive = async (rate: AccommodationSeasonalRate) => {
    const res = await fetch(`/api/admin/seasonal-rates/${rate.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rate.is_active }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || (ar ? 'فشل التحديث' : 'Update failed')); return }
    setRates(prev => prev.map(r => r.id === rate.id ? { ...r, is_active: !r.is_active } : r))
  }

  const duplicate = (rate: AccommodationSeasonalRate) => {
    setError('')
    setDraft({
      name: `${rate.name} (${ar ? 'نسخة' : 'copy'})`,
      start_date: '', end_date: '', // dates must differ — overlap is blocked
      single_price: String(rate.single_price),
      double_price: String(rate.double_price),
      triple_price: String(rate.triple_price),
    })
  }

  const edit = (rate: AccommodationSeasonalRate) => {
    setError('')
    setDraft({
      id: rate.id,
      name: rate.name,
      start_date: rate.start_date,
      end_date: rate.end_date,
      single_price: String(rate.single_price),
      double_price: String(rate.double_price),
      triple_price: String(rate.triple_price),
    })
  }

  return (
    <div>
      <Label className="mb-1 flex items-center gap-1.5 font-bold text-gray-900">
        <CalendarRange className="h-4 w-4 text-gray-400" />
        {ar ? 'الأسعار الموسمية' : 'Seasonal Pricing'}
      </Label>
      <p className="mb-3 text-xs text-gray-500">
        {ar
          ? 'فترات بتواريخ محددة بأسعار مختلفة (زي رأس السنة). الليالي اللي جوه الفترة بتتحسب بسعرها، والباقي بالسعر الأساسي — ليلة بليلة.'
          : 'Date ranges with their own nightly prices (e.g. New Year). Nights inside a period use its rates; the rest use the base price — resolved night by night.'}
      </p>

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {ar ? 'جاري التحميل...' : 'Loading...'}
        </div>
      ) : (
        <>
          {rates.length > 0 && (
            <div className="mb-3 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? 'الفترة' : 'Period'}</TableHead>
                    <TableHead>{ar ? 'من' : 'From'}</TableHead>
                    <TableHead>{ar ? 'إلى' : 'To'}</TableHead>
                    <TableHead>{ar ? 'سينجل' : 'Single'}</TableHead>
                    <TableHead>{ar ? 'دبل' : 'Double'}</TableHead>
                    <TableHead>{ar ? 'تريبل' : 'Triple'}</TableHead>
                    <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-right">{ar ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map(r => (
                    <TableRow key={r.id} className={r.is_active ? '' : 'opacity-50'}>
                      <TableCell className="font-medium">{r.name || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{r.start_date}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{r.end_date}</TableCell>
                      <TableCell>{Number(r.single_price).toLocaleString()}</TableCell>
                      <TableCell>{Number(r.double_price).toLocaleString()}</TableCell>
                      <TableCell>{Number(r.triple_price).toLocaleString()}</TableCell>
                      <TableCell>
                        <button type="button" onClick={() => toggleActive(r)}>
                          <Badge variant={r.is_active ? 'default' : 'outline'} className={r.is_active ? 'cursor-pointer bg-green-100 text-green-700' : 'cursor-pointer'}>
                            {r.is_active ? (ar ? 'نشطة' : 'Active') : (ar ? 'موقوفة' : 'Off')}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button type="button" variant="ghost" size="icon" title={ar ? 'تعديل' : 'Edit'} onClick={() => edit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" title={ar ? 'نسخ الأسعار لفترة جديدة' : 'Copy rates to a new period'} onClick={() => duplicate(r)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => remove(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {draft ? (
            <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">
                  {draft.id ? (ar ? 'تعديل الفترة' : 'Edit period') : (ar ? 'فترة جديدة' : 'New period')}
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => { setDraft(null); setError('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                <div className="col-span-2">
                  <Label className="text-xs">{ar ? 'اسم الفترة' : 'Period name'}</Label>
                  <Input className="mt-1 h-8" placeholder={ar ? 'الكريسماس ورأس السنة' : 'Christmas / New Year'} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? 'من' : 'From'}</Label>
                  <Input className="mt-1 h-8" type="date" value={draft.start_date} onChange={e => setDraft({ ...draft, start_date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? 'إلى' : 'To'}</Label>
                  <Input className="mt-1 h-8" type="date" value={draft.end_date} onChange={e => setDraft({ ...draft, end_date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? 'سينجل' : 'Single'}</Label>
                  <Input className="mt-1 h-8" type="number" min={0} value={draft.single_price} onChange={e => setDraft({ ...draft, single_price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? 'دبل' : 'Double'}</Label>
                  <Input
                    className="mt-1 h-8" type="number" min={0}
                    value={draft.double_price}
                    onChange={e => {
                      const v = e.target.value
                      setDraft(d => {
                        if (!d) return d
                        // suggest triple = double × 1.5 while triple is untouched/zero
                        const suggestTriple = !Number(d.triple_price)
                        return {
                          ...d,
                          double_price: v,
                          triple_price: suggestTriple && Number(v) > 0 ? String(Math.round(Number(v) * 1.5)) : d.triple_price,
                        }
                      })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">{ar ? 'تريبل' : 'Triple'}</Label>
                  <Input className="mt-1 h-8" type="number" min={0} value={draft.triple_price} onChange={e => setDraft({ ...draft, triple_price: e.target.value })} />
                </div>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setDraft(null); setError('') }}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="button" size="sm" onClick={saveDraft} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                  {ar ? 'حفظ الفترة' : 'Save period'}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => { setDraft({ ...emptyDraft }); setError('') }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {ar ? 'إضافة فترة موسمية' : 'Add seasonal period'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
