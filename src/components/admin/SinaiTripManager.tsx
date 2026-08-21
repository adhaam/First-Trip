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
import { Plus, Pencil, Trash2, X, Search, Upload, Loader2, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { SinaiTrip } from '@/lib/types'
import { cn } from '@/lib/utils'

const emptyTrip: Partial<SinaiTrip> = {
  name_ar: '', name_en: '',
  description_ar: '', description_en: '',
  category_ar: '', category_en: '',
  images: [],
  duration: '', duration_en: '',
  price: 0,
  package_price: null,
  includes_ar: [], includes_en: [],
  sort_order: 0,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = trips.filter(t =>
    !search || t.name_ar.includes(search) || t.name_en.toLowerCase().includes(search.toLowerCase())
  )

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
                  <TableCell>
                    <div>{t.price?.toLocaleString()} ج.م</div>
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
