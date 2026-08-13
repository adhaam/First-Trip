'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, X, Search, Upload, Loader2 } from 'lucide-react'
import { SinaiTrip } from '@/lib/types'
import { cn } from '@/lib/utils'

const emptyTrip: Partial<SinaiTrip> = {
  name_ar: '', name_en: '',
  description_ar: '', description_en: '',
  category_ar: '', category_en: '',
  images: [],
  duration: '', duration_en: '',
  price: 0,
  includes_ar: [], includes_en: [],
  is_active: true,
}

export function SinaiTripManager() {
  const locale = useLocale()
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<SinaiTrip | null>(null)
  const [form, setForm] = useState<Partial<SinaiTrip>>({})
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/sinai-trips')
      if (res.status === 401) {
        window.location.href = `/${locale}/admin`
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTrips(data.trips || [])
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = trips.filter(t =>
    !search || t.name_ar.includes(search) || t.name_en.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (t: SinaiTrip) => { setEditing(t); setForm({ ...t }); setShowForm(true) }
  const handleAdd = () => { setEditing(null); setForm({ ...emptyTrip }); setShowForm(true) }

  const updateField = (field: string, value: string | number | string[] | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const addListItem = (field: 'includes_ar' | 'includes_en', inputId: string) => {
    const input = document.getElementById(inputId) as HTMLInputElement
    if (input?.value?.trim()) {
      updateField(field, [...((form[field] as string[]) || []), input.value.trim()])
      input.value = ''
    }
  }
  const removeListItem = (field: 'includes_ar' | 'includes_en', index: number) => {
    updateField(field, ((form[field] as string[]) || []).filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!form.name_ar || !form.name_en) return
    setSaving(true)
    try {
      const res = editing
        ? await fetch(`/api/admin/sinai-trips/${editing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
          })
        : await fetch('/api/admin/sinai-trips', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
          })
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (locale === 'ar' ? 'فشل الحفظ' : 'Save failed')); return }
      await load()
      setShowForm(false); setEditing(null); setForm({})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(locale === 'ar' ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/sinai-trips/${id}`, { method: 'DELETE' })
    if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || (locale === 'ar' ? 'فشل الحذف' : 'Delete failed')); return }
    setTrips(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'إضافة رحلة' : 'Add Trip'}
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الفئة' : 'Category'}</TableHead>
                <TableHead>{locale === 'ar' ? 'المدة' : 'Duration'}</TableHead>
                <TableHead>{locale === 'ar' ? 'السعر' : 'Price'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{locale === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={6} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{locale === 'ar' ? t.name_ar : t.name_en}</TableCell>
                  <TableCell>{locale === 'ar' ? t.category_ar : t.category_en}</TableCell>
                  <TableCell>{locale === 'ar' ? t.duration : t.duration_en}</TableCell>
                  <TableCell>{t.price?.toLocaleString()} ج.م</TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? 'default' : 'outline'} className={t.is_active ? 'bg-green-100 text-green-700' : ''}>
                      {t.is_active ? (locale === 'ar' ? 'نشط' : 'Active') : (locale === 'ar' ? 'متوقف' : 'Inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">
                  {locale === 'ar' ? 'لا توجد رحلات' : 'No trips found'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editing ? (locale === 'ar' ? 'تعديل الرحلة' : 'Edit Trip') : (locale === 'ar' ? 'إضافة رحلة جديدة' : 'Add New Trip')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditing(null) }}><X className="h-5 w-5" /></Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{locale === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label><Input value={form.name_ar || ''} onChange={e => updateField('name_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label><Input value={form.name_en || ''} onChange={e => updateField('name_en', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'الفئة (عربي)' : 'Category (Arabic)'}</Label><Input value={form.category_ar || ''} onChange={e => updateField('category_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'الفئة (إنجليزي)' : 'Category (English)'}</Label><Input value={form.category_en || ''} onChange={e => updateField('category_en', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'المدة (عربي)' : 'Duration (Arabic)'}</Label><Input value={form.duration || ''} onChange={e => updateField('duration', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'المدة (إنجليزي)' : 'Duration (English)'}</Label><Input value={form.duration_en || ''} onChange={e => updateField('duration_en', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'السعر' : 'Price'}</Label><Input type="number" min={0} value={form.price || 0} onChange={e => updateField('price', parseInt(e.target.value) || 0)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'رابط الصورة' : 'Image URL'}</Label><Input value={(form.images || [])[0] || ''} onChange={e => updateField('images', [e.target.value])} className="mt-1" placeholder="https://..." /></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">{locale === 'ar' ? 'يشمل (عربي)' : 'Includes (Arabic)'}</Label>
                  <div className="flex gap-2 mb-2">
                    <Input id="includes-ar-input" placeholder={locale === 'ar' ? 'أضف عنصر...' : 'Add item...'} className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => addListItem('includes_ar', 'includes-ar-input')}>+</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((form.includes_ar as string[]) || []).map((a, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">{a}<X className="h-3 w-3 cursor-pointer" onClick={() => removeListItem('includes_ar', i)} /></Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">{locale === 'ar' ? 'يشمل (إنجليزي)' : 'Includes (English)'}</Label>
                  <div className="flex gap-2 mb-2">
                    <Input id="includes-en-input" placeholder={locale === 'ar' ? 'أضف عنصر...' : 'Add item...'} className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => addListItem('includes_en', 'includes-en-input')}>+</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((form.includes_en as string[]) || []).map((a, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">{a}<X className="h-3 w-3 cursor-pointer" onClick={() => removeListItem('includes_en', i)} /></Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div><Label className="mb-2 block">{locale === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label><Textarea rows={3} value={form.description_ar || ''} onChange={e => updateField('description_ar', e.target.value)} /></div>
              <div><Label className="mb-2 block">{locale === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label><Textarea rows={3} value={form.description_en || ''} onChange={e => updateField('description_en', e.target.value)} /></div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active ?? true} onChange={e => updateField('is_active', e.target.checked)} className="h-4 w-4" />
                <span className={cn('text-sm', 'text-gray-700')}>{locale === 'ar' ? 'نشط (يظهر للعملاء)' : 'Active (visible to customers)'}</span>
              </label>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
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
