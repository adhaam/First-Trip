'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Plus, Trash2, X, Loader2, Upload } from 'lucide-react'
import { TripDate, TripDuration } from '@/lib/types'

interface TripDateForm {
  date: string
  day_of_week: 'sunday' | 'thursday'
  duration: TripDuration
  is_active: boolean
}

const emptyDate: TripDateForm = { date: '', day_of_week: 'sunday', duration: 4, is_active: true }

export function TripDatesManager() {
  const locale = useLocale()
  const [dates, setDates] = useState<TripDate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TripDateForm>(emptyDate)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/trip-dates')
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDates(data.dates || [])
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل التواريخ' : 'Failed to load dates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = () => { setForm({ ...emptyDate }); setShowForm(true) }

  const handleSave = async () => {
    if (!form.date) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/trip-dates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (locale === 'ar' ? 'فشل الحفظ' : 'Save failed')); return }
      await load()
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (d: TripDate) => {
    const res = await fetch(`/api/admin/trip-dates/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !d.is_active }),
    })
    if (res.status === 401) { window.location.assign(`/${locale}/admin`); return }
    if (!res.ok) { const data = await res.json().catch(() => ({})); alert(data.error || (locale === 'ar' ? 'فشل التحديث' : 'Update failed')); return }
    setDates(prev => prev.map(x => x.id === d.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm(locale === 'ar' ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/trip-dates/${id}`, { method: 'DELETE' })
    if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || (locale === 'ar' ? 'فشل الحذف' : 'Delete failed')); return }
    setDates(prev => prev.filter(x => x.id !== id))
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{locale === 'ar' ? 'تواريخ الرحلات' : 'Trip Dates'}</h2>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'إضافة تاريخ' : 'Add Date'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{locale === 'ar' ? 'اليوم' : 'Day'}</TableHead>
                <TableHead>{locale === 'ar' ? 'المدة' : 'Duration'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{locale === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={5} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && dates.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{formatDate(d.date)}</TableCell>
                  <TableCell>{d.day_of_week === 'sunday' ? (locale === 'ar' ? 'الأحد' : 'Sunday') : (locale === 'ar' ? 'الخميس' : 'Thursday')}</TableCell>
                  <TableCell>{d.duration} {locale === 'ar' ? 'أيام' : 'days'}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(d)}>
                      <Badge variant={d.is_active ? 'default' : 'outline'} className={d.is_active ? 'bg-green-100 text-green-700 cursor-pointer' : 'cursor-pointer'}>
                        {d.is_active ? (locale === 'ar' ? 'متاح' : 'Open') : (locale === 'ar' ? 'مغلق' : 'Closed')}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !loadError && dates.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  {locale === 'ar' ? 'لا توجد تواريخ بعد' : 'No dates yet'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-md my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{locale === 'ar' ? 'إضافة تاريخ جديد' : 'Add New Date'}</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button>
              </div>

              <div>
                <Label>{locale === 'ar' ? 'التاريخ' : 'Date'}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className="mt-1" />
              </div>

              <div>
                <Label className="mb-2 block">{locale === 'ar' ? 'اليوم' : 'Day'}</Label>
                <Select value={form.day_of_week} onValueChange={(v) => v && setForm(prev => ({ ...prev, day_of_week: v as 'sunday' | 'thursday' }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">{locale === 'ar' ? 'الأحد' : 'Sunday'}</SelectItem>
                    <SelectItem value="thursday">{locale === 'ar' ? 'الخميس' : 'Thursday'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">{locale === 'ar' ? 'المدة' : 'Duration'}</Label>
                <Select value={String(form.duration)} onValueChange={(v) => v && setForm(prev => ({ ...prev, duration: (parseInt(v) as TripDuration) }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 {locale === 'ar' ? 'أيام' : 'days'}</SelectItem>
                    <SelectItem value="5">5 {locale === 'ar' ? 'أيام' : 'days'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))} className="h-4 w-4" />
                <span className="text-sm text-gray-700">{locale === 'ar' ? 'متاح للحجز' : 'Open for booking'}</span>
              </label>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setShowForm(false)}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {locale === 'ar' ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
