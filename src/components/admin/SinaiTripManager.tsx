'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Reorder, useDragControls } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, X, Search, Upload, Loader2, ImagePlus, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { SinaiTrip, TripCategory, TripDiscountType } from '@/lib/types'
import { effectiveTripPrice } from '@/lib/pricing'
import { cn } from '@/lib/utils'

/** `<input type="datetime-local">` needs `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyTrip: Partial<SinaiTrip> = {
  name_ar: '', name_en: '',
  description_ar: '', description_en: '',
  category_ar: '', category_en: '', trip_category_id: null,
  images: [],
  duration: '', duration_en: '',
  price: 0,
  package_price: null,
  discount_type: null,
  discount_value: null,
  discount_starts_at: null,
  discount_ends_at: null,
  includes_ar: [], includes_en: [],
  sort_order: 0,
  is_active: true,
}

export function SinaiTripManager() {
  const locale = useLocale()
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [categories, setCategories] = useState<TripCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<SinaiTrip | null>(null)
  const [form, setForm] = useState<Partial<SinaiTrip>>({})
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError('')
    try {
      const current = ((form.images as string[]) || []).slice()
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.append('file', file)
        body.append('folder', 'trips')
        const res = await fetch('/api/admin/upload-image', { method: 'POST', body })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        current.push(data.url)
      }
      updateField('images', current)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    const current = ((form.images as string[]) || []).slice()
    current.splice(index, 1)
    updateField('images', current)
  }

  const moveImage = (index: number, dir: 'left' | 'right') => {
    const current = ((form.images as string[]) || []).slice()
    const target = dir === 'left' ? index - 1 : index + 1
    if (target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    updateField('images', current)
  }

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/sinai-trips')
      if (res.status === 401) {
        window.location.href = locale === 'en' ? '/en/admin' : '/admin'
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
    fetch('/api/admin/trip-categories')
      .then(res => res.ok ? res.json() : { categories: [] })
      .then(data => setCategories(data.categories || []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectCategory = (categoryId: string | null) => {
    const cat = categories.find(c => c.id === categoryId)
    if (!cat) return
    setForm(prev => ({ ...prev, trip_category_id: cat.id, category_ar: cat.name_ar, category_en: cat.name_en }))
  }

  const filtered = trips.filter(t =>
    !search || t.name_ar.includes(search) || t.name_en.toLowerCase().includes(search.toLowerCase())
  )
  // Drag-reordering only makes sense against the full, unfiltered list.
  const canReorder = !search

  const handleEdit = (t: SinaiTrip) => { setEditing(t); setForm({ ...t }); setShowForm(true) }
  const handleAdd = () => { setEditing(null); setForm({ ...emptyTrip }); setShowForm(true) }

  const updateField = (field: string, value: string | number | string[] | boolean | null) => {
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
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
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
    if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || (locale === 'ar' ? 'فشل الحذف' : 'Delete failed')); return }
    setTrips(prev => prev.filter(t => t.id !== id))
  }

  // Drag-and-drop reorder: update local state immediately (no flash / full
  // reload) and persist the new sort_order values for changed rows only.
  const handleReorder = (newOrder: SinaiTrip[]) => {
    const reindexed = newOrder.map((t, idx) => ({ ...t, sort_order: idx }))
    setTrips(reindexed)
    const changed = reindexed.filter((t, idx) => trips.find(x => x.id === t.id)?.sort_order !== idx)
    Promise.all(
      changed.map(t =>
        fetch(`/api/admin/sinai-trips/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: t.sort_order }),
        }),
      ),
    ).catch(() => {
      load()
    })
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

      {canReorder ? (
        <p className="text-xs text-gray-500">
          {locale === 'ar' ? '🖐️ اسحب من ⣿ عشان تغيّر ترتيب العرض — بيتحفظ فورًا.' : '🖐️ Drag by ⣿ to change display order — saved instantly.'}
        </p>
      ) : (
        <p className="text-xs text-amber-600">
          {locale === 'ar' ? 'امسح البحث عشان تقدر تسحب وتظبط الترتيب.' : 'Clear the search to drag-reorder.'}
        </p>
      )}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{locale === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الفئة' : 'Category'}</TableHead>
                <TableHead>{locale === 'ar' ? 'المدة' : 'Duration'}</TableHead>
                <TableHead>{locale === 'ar' ? 'السعر' : 'Price'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{locale === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            {loading || loadError || filtered.length === 0 ? (
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell></TableRow>
                )}
                {!loading && loadError && (
                  <TableRow><TableCell colSpan={7} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
                )}
                {!loading && !loadError && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    {locale === 'ar' ? 'لا توجد رحلات' : 'No trips found'}
                  </TableCell></TableRow>
                )}
              </TableBody>
            ) : canReorder ? (
              <Reorder.Group as="tbody" axis="y" values={filtered} onReorder={handleReorder} className="[&_tr:last-child]:border-0">
                {filtered.map(t => (
                  <TripRow key={t.id} t={t} locale={locale} onEdit={handleEdit} onDelete={handleDelete} draggable />
                ))}
              </Reorder.Group>
            ) : (
              <TableBody>
                {filtered.map(t => (
                  <TripRow key={t.id} t={t} locale={locale} onEdit={handleEdit} onDelete={handleDelete} draggable={false} />
                ))}
              </TableBody>
            )}
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
                <div className="md:col-span-2">
                  <Label>{locale === 'ar' ? 'الفئة' : 'Category'}</Label>
                  <Select value={form.trip_category_id || undefined} onValueChange={selectCategory}>
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder={locale === 'ar' ? 'اختر فئة...' : 'Select a category...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar : c.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{locale === 'ar' ? 'المدة (عربي)' : 'Duration (Arabic)'}</Label><Input value={form.duration || ''} onChange={e => updateField('duration', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'المدة (إنجليزي)' : 'Duration (English)'}</Label><Input value={form.duration_en || ''} onChange={e => updateField('duration_en', e.target.value)} className="mt-1" /></div>
                <div>
                  <Label>{locale === 'ar' ? 'السعر العام (للعميل)' : 'Public price (customer)'}</Label>
                  <Input type="number" min={0} value={form.price || 0} onChange={e => updateField('price', parseInt(e.target.value) || 0)} className="mt-1" />
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'سعر الباكدج (لما تكون رحلة مشمولة)' : 'Package cost (when included in a package)'}</Label>
                  <Input
                    type="number" min={0}
                    value={form.package_price ?? ''}
                    placeholder={locale === 'ar' ? 'فاضي = السعر العام' : 'Empty = public price'}
                    onChange={e => updateField('package_price', e.target.value === '' ? null : (parseInt(e.target.value) || 0))}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    {locale === 'ar'
                      ? 'ده اللي بيدخل في حساب الباقة لو الرحلة دي من الرحلتين المشمولين.'
                      : 'Used inside the package total when this trip is one of the two included trips.'}
                  </p>
                </div>

                {/* ─── Discount ─── applies to the public price only. */}
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <Label className="mb-3 block text-sm font-semibold">
                    {locale === 'ar' ? 'الخصم' : 'Discount'}
                  </Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">{locale === 'ar' ? 'نوع الخصم' : 'Discount type'}</Label>
                      <Select
                        value={form.discount_type || 'none'}
                        onValueChange={v => {
                          if (!v) return
                          // 'none' is a UI-only placeholder — a Select cannot
                          // hold an empty value. It is stored as NULL, which
                          // is what the DB CHECK constraint expects.
                          const next = v === 'none' ? null : (v as TripDiscountType)
                          setForm(prev => ({
                            ...prev,
                            discount_type: next,
                            discount_value: next === null ? null : (prev.discount_value || 0),
                          }))
                        }}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{locale === 'ar' ? 'بدون خصم' : 'No discount'}</SelectItem>
                          <SelectItem value="amount">{locale === 'ar' ? 'مبلغ ثابت (ج.م)' : 'Flat amount (EGP)'}</SelectItem>
                          <SelectItem value="percentage">{locale === 'ar' ? 'نسبة مئوية (%)' : 'Percentage (%)'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">
                        {form.discount_type === 'percentage'
                          ? (locale === 'ar' ? 'قيمة الخصم (%)' : 'Discount value (%)')
                          : (locale === 'ar' ? 'قيمة الخصم (ج.م)' : 'Discount value (EGP)')}
                      </Label>
                      <Input
                        type="number" min={0}
                        max={form.discount_type === 'percentage' ? 100 : (form.price || undefined)}
                        disabled={!form.discount_type}
                        value={form.discount_value ?? ''}
                        onChange={e => updateField('discount_value', Number(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">
                        {locale === 'ar' ? 'يبدأ في (اختياري)' : 'Starts at (optional)'}
                      </Label>
                      <Input
                        type="datetime-local"
                        disabled={!form.discount_type}
                        value={toLocalInputValue(form.discount_starts_at)}
                        onChange={e => updateField('discount_starts_at', e.target.value || null)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {locale === 'ar' ? 'ينتهي في (اختياري)' : 'Ends at (optional)'}
                      </Label>
                      <Input
                        type="datetime-local"
                        disabled={!form.discount_type}
                        value={toLocalInputValue(form.discount_ends_at)}
                        onChange={e => updateField('discount_ends_at', e.target.value || null)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <DiscountPreview form={form} locale={locale} />

                  <p className="mt-2 text-[11px] text-gray-500">
                    {locale === 'ar'
                      ? 'الخصم بيتطبق على السعر العام بس — سعر الباكدج مش بيتأثر. الحجوزات القديمة بتفضل بسعرها الأصلي.'
                      : 'The discount applies to the public price only — package cost is unaffected. Existing bookings keep the price they were made at.'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block">{locale === 'ar' ? 'صور الرحلة' : 'Trip Images'}</Label>
                  {/* Upload button */}
                  <label className={cn(
                    'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 transition-colors',
                    uploading && 'opacity-60 pointer-events-none'
                  )}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {locale === 'ar' ? 'رفع صور' : 'Upload images'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      multiple
                      className="sr-only"
                      disabled={uploading}
                      onChange={e => handleImageUpload(e.target.files)}
                    />
                  </label>
                  {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
                  {/* Image preview grid */}
                  {((form.images as string[]) || []).length > 0 && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {((form.images as string[]) || []).map((url, i) => (
                        <div key={i} className="relative group aspect-square rounded overflow-hidden border border-gray-200 bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                            <button type="button" onClick={() => moveImage(i, 'left')} disabled={i === 0} className="rounded bg-white/80 p-0.5 disabled:opacity-30"><ChevronLeft className="h-3 w-3" /></button>
                            <button type="button" onClick={() => removeImage(i)} className="rounded bg-red-500 p-0.5 text-white"><X className="h-3 w-3" /></button>
                            <button type="button" onClick={() => moveImage(i, 'right')} disabled={i === ((form.images as string[]) || []).length - 1} className="rounded bg-white/80 p-0.5 disabled:opacity-30"><ChevronRight className="h-3 w-3" /></button>
                          </div>
                          {i === 0 && <span className="absolute top-1 left-1 rounded bg-brand-blue px-1 py-0.5 text-[10px] text-white">Cover</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">{locale === 'ar' ? 'الصورة الأولى هي صورة الغلاف. JPG/PNG/WebP/AVIF — بحد أقصى 5 ميجابايت للصورة.' : 'First image is cover. JPG/PNG/WebP/AVIF — max 5 MB each.'}</p>
                </div>
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

              <div className="flex items-center gap-4">
                <div className="w-32">
                  <Label className="mb-1 block text-xs">{locale === 'ar' ? 'ترتيب العرض' : 'Display Order'}</Label>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order ?? 0}
                    onChange={e => updateField('sort_order', parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">{locale === 'ar' ? '0 = الأول، كلما زاد = متأخر' : '0 = first, higher = later'}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active ?? true} onChange={e => updateField('is_active', e.target.checked)} className="h-4 w-4" />
                  <span className={cn('text-sm', 'text-gray-700')}>{locale === 'ar' ? 'نشط (يظهر للعملاء)' : 'Active (visible to customers)'}</span>
                </label>
              </div>

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

// Extracted so the row can carry its own drag controls — only the grip
// handle starts a drag (dragListener={false}), so clicking Edit/Delete never
// accidentally triggers a reorder.
function TripRow({
  t,
  locale,
  onEdit,
  onDelete,
  draggable,
}: {
  t: SinaiTrip
  locale: string
  onEdit: (t: SinaiTrip) => void
  onDelete: (id: string) => void
  draggable: boolean
}) {
  const controls = useDragControls()
  const row = (
    <>
      <TableCell className="w-10">
        {draggable ? (
          <button
            type="button"
            onPointerDown={e => controls.start(e)}
            className="flex h-8 w-8 cursor-grab items-center justify-center text-gray-400 hover:text-gray-600 active:cursor-grabbing"
            aria-label={locale === 'ar' ? 'اسحب لتغيير الترتيب' : 'Drag to reorder'}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center text-gray-200">
            <GripVertical className="h-4 w-4" />
          </span>
        )}
      </TableCell>
      <TableCell className="font-medium">{locale === 'ar' ? t.name_ar : t.name_en}</TableCell>
      <TableCell>{locale === 'ar' ? t.category_ar : t.category_en}</TableCell>
      <TableCell>{locale === 'ar' ? t.duration : t.duration_en}</TableCell>
      <TableCell>
        {(() => {
          const priced = effectiveTripPrice(t)
          return priced.isDiscounted ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] text-gray-400 line-through">{priced.original.toLocaleString()}</span>
              <span className="font-semibold text-green-700">{priced.final.toLocaleString()} ج.م</span>
              <span className="rounded bg-green-100 px-1 text-[10px] font-semibold text-green-800">
                −{priced.discountType === 'percentage' ? `${priced.discountValue}%` : priced.discountAmount.toLocaleString()}
              </span>
            </div>
          ) : (
            <div>{t.price?.toLocaleString()} ج.م</div>
          )
        })()}
        <div className={cn('text-[11px]', t.package_price == null ? 'text-amber-600' : 'text-gray-400')}>
          {t.package_price != null
            ? `${locale === 'ar' ? 'باكدج: ' : 'Pkg: '}${Number(t.package_price).toLocaleString()}`
            : (locale === 'ar' ? 'سعر الباكدج غير مضبوط' : 'Package cost not set')}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={t.is_active ? 'default' : 'outline'} className={t.is_active ? 'bg-green-100 text-green-700' : ''}>
          {t.is_active ? (locale === 'ar' ? 'نشط' : 'Active') : (locale === 'ar' ? 'متوقف' : 'Inactive')}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(t)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </TableCell>
    </>
  )

  if (!draggable) {
    return <TableRow>{row}</TableRow>
  }

  return (
    <Reorder.Item
      as="tr"
      value={t}
      dragListener={false}
      dragControls={controls}
      className="border-b transition-colors hover:bg-muted/50 bg-card"
    >
      {row}
    </Reorder.Item>
  )
}

/**
 * Live "what the customer will actually pay" readout for the discount block.
 * Runs the same effectiveTripPrice() the server prices with, so the admin
 * can never see a preview that disagrees with the real charge — including
 * the clamps for an over-100% or over-price value.
 */
function DiscountPreview({ form, locale }: { form: Partial<SinaiTrip>; locale: string }) {
  const ar = locale === 'ar'
  const priced = effectiveTripPrice({
    price: Number(form.price) || 0,
    discount_type: form.discount_type,
    discount_value: form.discount_value,
    discount_starts_at: form.discount_starts_at,
    discount_ends_at: form.discount_ends_at,
  })

  if (!priced.isDiscounted) {
    // Distinguish "no discount configured" from "configured but not live yet",
    // otherwise a scheduled discount looks like it silently failed to save.
    const configured = Boolean(form.discount_type) && Number(form.discount_value) > 0
    return (
      <p className="mt-3 text-xs text-gray-500">
        {configured
          ? (ar
              ? 'الخصم متسجّل بس مش فعّال دلوقتي (بره فترة التواريخ المحددة).'
              : 'Discount saved but not active right now (outside the configured date window).')
          : (ar ? 'مفيش خصم — العميل هيدفع السعر العام.' : 'No discount — the customer pays the public price.')}
      </p>
    )
  }

  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-2 rounded-md bg-white px-3 py-2 text-sm">
      <span className="text-gray-400 line-through">{fmt(priced.original)}</span>
      <span className="text-lg font-bold text-green-700">{fmt(priced.final)} {ar ? 'ج.م' : 'EGP'}</span>
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        −{priced.discountType === 'percentage' ? `${priced.discountValue}%` : `${fmt(priced.discountAmount)} ${ar ? 'ج.م' : 'EGP'}`}
      </span>
      <span className="text-xs text-gray-500">
        {ar ? `يوفّر ${fmt(priced.discountAmount)} ج.م للفرد` : `Saves ${fmt(priced.discountAmount)} EGP per person`}
      </span>
    </div>
  )
}
