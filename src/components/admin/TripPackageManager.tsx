'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { Reorder, useDragControls } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Plus, Pencil, Trash2, X, Search, Upload, Loader2, ImagePlus, GripVertical, AlertTriangle,
} from 'lucide-react'
import type { TripPackage, TripPackageCategory, SinaiTrip } from '@/lib/types'
import { computePackageTotals } from '@/lib/pricing'
import { cn } from '@/lib/utils'

interface PackageForm {
  id?: string
  slug: string
  name_ar: string
  name_en: string
  short_description_ar: string
  short_description_en: string
  description_ar: string
  description_en: string
  image: string
  badge_ar: string
  badge_en: string
  package_category_id: string | null
  featured: boolean
  is_active: boolean
  sort_order: number
  trip_ids: string[]
}

const emptyForm: PackageForm = {
  slug: '', name_ar: '', name_en: '',
  short_description_ar: '', short_description_en: '',
  description_ar: '', description_en: '',
  image: '', badge_ar: '', badge_en: '',
  package_category_id: null,
  featured: false, is_active: false, sort_order: 0,
  trip_ids: [],
}

function useAdminFetch() {
  const locale = useLocale()
  return useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    if (res.status === 401) { window.location.href = locale === 'ar' ? '/admin' : '/en/admin'; throw new Error('unauthorized') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [locale])
}

type AdminPackage = TripPackage & { trip_package_items?: { sort_order: number; sinai_trips: SinaiTrip | null }[] }

export function TripPackageManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()

  const [packages, setPackages] = useState<AdminPackage[]>([])
  const [categories, setCategories] = useState<TripPackageCategory[]>([])
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PackageForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [tripPicker, setTripPicker] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [pData, cData, tData] = await Promise.all([
        api('/api/admin/trip-packages'),
        api('/api/admin/trip-package-categories'),
        api('/api/admin/sinai-trips'),
      ])
      setPackages(pData.packages || [])
      setCategories(cData.categories || [])
      setTrips(tData.trips || [])
    } catch {
      setLoadError(ar ? 'تعذر تحميل البيانات' : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [api, ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const filtered = packages.filter(p =>
    !search || p.name_ar.includes(search) || p.name_en.toLowerCase().includes(search.toLowerCase())
  )

  const tripsById = useMemo(() => new Map(trips.map(t => [t.id, t])), [trips])
  const selectedTrips = useMemo(
    () => form.trip_ids.map(id => tripsById.get(id)).filter((t): t is SinaiTrip => Boolean(t)),
    [form.trip_ids, tripsById],
  )
  const totals = useMemo(() => computePackageTotals(selectedTrips), [selectedTrips])
  const missingPackagePrice = selectedTrips.filter(t => !(Number(t.package_price) > 0))

  const handleAdd = () => { setEditingId(null); setForm(emptyForm); setSaveError(''); setShowForm(true) }
  const handleEdit = (p: AdminPackage) => {
    setEditingId(p.id)
    const items = (p.trip_package_items || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    setForm({
      id: p.id,
      slug: p.slug, name_ar: p.name_ar, name_en: p.name_en,
      short_description_ar: p.short_description_ar || '', short_description_en: p.short_description_en || '',
      description_ar: p.description_ar || '', description_en: p.description_en || '',
      image: p.image || '', badge_ar: p.badge_ar || '', badge_en: p.badge_en || '',
      package_category_id: p.package_category_id || null,
      featured: p.featured, is_active: p.is_active, sort_order: p.sort_order,
      trip_ids: items.map(i => i.sinai_trips?.id).filter((id): id is string => Boolean(id)),
    })
    setSaveError('')
    setShowForm(true)
  }

  const updateField = <K extends keyof PackageForm>(field: K, value: PackageForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const addTrip = (tripId: string | null) => {
    if (!tripId || form.trip_ids.includes(tripId)) return
    updateField('trip_ids', [...form.trip_ids, tripId])
    setTripPicker('')
  }
  const removeTrip = (tripId: string) => {
    updateField('trip_ids', form.trip_ids.filter(id => id !== tripId))
  }
  const reorderTrips = (newOrder: SinaiTrip[]) => {
    updateField('trip_ids', newOrder.map(t => t.id))
  }

  const handleImageUpload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('folder', 'trip-packages')
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      updateField('image', data.url)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaveError('')
    if (!form.slug || !form.name_ar || !form.name_en) {
      setSaveError(ar ? 'الاسم والمعرف (slug) مطلوبين' : 'Name and slug are required')
      return
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setSaveError(ar ? 'المعرف (slug) يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطة' : 'Slug must contain only lowercase letters, numbers, and hyphens')
      return
    }
    if (form.is_active && !totals.isValid) {
      setSaveError(ar
        ? 'مينفعش تنشر الباكدج — لازم كل الرحلات المختارة يكون ليها "سعر باكدج" صحيح.'
        : 'Cannot publish — every included trip needs a valid package price first.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        slug: form.slug, name_ar: form.name_ar, name_en: form.name_en,
        short_description_ar: form.short_description_ar, short_description_en: form.short_description_en,
        description_ar: form.description_ar, description_en: form.description_en,
        image: form.image, badge_ar: form.badge_ar, badge_en: form.badge_en,
        package_category_id: form.package_category_id,
        featured: form.featured, is_active: form.is_active, sort_order: form.sort_order,
        trip_ids: form.trip_ids,
      }
      if (editingId) {
        await api(`/api/admin/trip-packages/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await api('/api/admin/trip-packages', { method: 'POST', body: JSON.stringify(payload) })
      }
      await load()
      setShowForm(false)
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    try {
      await api(`/api/admin/trip-packages/${id}`, { method: 'DELETE' })
      setPackages(prev => prev.filter(p => p.id !== id))
    } catch (e) { alert((e as Error).message) }
  }

  const fmt = (n: number) => `${n.toLocaleString()} ج.م`

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder={ar ? 'بحث...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="h-4 w-4 mr-2" />
          {ar ? 'إضافة باكدج' : 'Add Trip Package'}
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{ar ? 'عدد الرحلات' : 'Trips'}</TableHead>
                <TableHead>{ar ? 'الإجمالي العام' : 'Public total'}</TableHead>
                <TableHead>{ar ? 'إجمالي الباكدج' : 'Package total'}</TableHead>
                <TableHead>{ar ? 'التوفير' : 'Saving'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{ar ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{ar ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={7} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">{ar ? 'لا توجد باكدجات' : 'No trip packages yet'}</TableCell></TableRow>
              )}
              {!loading && filtered.map(p => {
                const rowTrips = (p.trip_package_items || []).map(i => i.sinai_trips).filter((t): t is SinaiTrip => Boolean(t))
                const t = computePackageTotals(rowTrips)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{ar ? p.name_ar : p.name_en}</TableCell>
                    <TableCell>{rowTrips.length}</TableCell>
                    <TableCell className="text-gray-500">{fmt(t.publicTotal)}</TableCell>
                    <TableCell className="font-semibold">{fmt(t.packageTotal)}</TableCell>
                    <TableCell className="text-green-600">{fmt(t.savings)}</TableCell>
                    <TableCell>
                      {!t.isValid ? (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                          <AlertTriangle className="h-3 w-3" />{ar ? 'غير صالح للنشر' : 'Not publishable'}
                        </Badge>
                      ) : (
                        <Badge className={p.is_active ? 'bg-green-100 text-green-700' : ''} variant={p.is_active ? 'default' : 'outline'}>
                          {p.is_active ? (ar ? 'منشور' : 'Published') : (ar ? 'مسودة' : 'Draft')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
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
                  {editingId ? (ar ? 'تعديل الباكدج' : 'Edit Trip Package') : (ar ? 'باكدج جديد' : 'New Trip Package')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{ar ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label><Input value={form.name_ar} onChange={e => updateField('name_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{ar ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label><Input value={form.name_en} onChange={e => updateField('name_en', e.target.value)} className="mt-1" /></div>
                <div className="md:col-span-2">
                  <Label>{ar ? 'المعرف (slug)' : 'Slug'}</Label>
                  <Input dir="ltr" value={form.slug} onChange={e => updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="mt-1" />
                </div>
                <div>
                  <Label>{ar ? 'التصنيف' : 'Package Category'}</Label>
                  <Select value={form.package_category_id || undefined} onValueChange={(v) => updateField('package_category_id', v || null)}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue placeholder={ar ? 'اختر تصنيف...' : 'Select a category...'} /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{ar ? c.name_ar : c.name_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ar ? 'الشارة (اختياري، عربي)' : 'Badge (optional, Arabic)'}</Label>
                  <Input value={form.badge_ar} onChange={e => updateField('badge_ar', e.target.value)} className="mt-1" placeholder="أفضل قيمة" />
                </div>
                <div>
                  <Label>{ar ? 'الشارة (اختياري، إنجليزي)' : 'Badge (optional, English)'}</Label>
                  <Input value={form.badge_en} onChange={e => updateField('badge_en', e.target.value)} className="mt-1" placeholder="Best Value" />
                </div>
                <div>
                  <Label className="mb-2 block">{ar ? 'صورة الباكدج' : 'Package Image'}</Label>
                  <label className={cn(
                    'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 text-sm font-medium hover:bg-gray-50 transition-colors',
                    uploading && 'opacity-60 pointer-events-none'
                  )}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {ar ? 'رفع صورة' : 'Upload image'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading}
                      onChange={e => handleImageUpload(e.target.files?.[0] || null)} />
                  </label>
                  {form.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image} alt="" className="mt-2 h-24 w-40 rounded object-cover border border-gray-200" />
                  )}
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>{ar ? 'وصف مختصر (عربي)' : 'Short description (Arabic)'}</Label><Textarea rows={2} value={form.short_description_ar} onChange={e => updateField('short_description_ar', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'وصف مختصر (إنجليزي)' : 'Short description (English)'}</Label><Textarea rows={2} value={form.short_description_en} onChange={e => updateField('short_description_en', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'الوصف الكامل (عربي)' : 'Full description (Arabic)'}</Label><Textarea rows={3} value={form.description_ar} onChange={e => updateField('description_ar', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'الوصف الكامل (إنجليزي)' : 'Full description (English)'}</Label><Textarea rows={3} value={form.description_en} onChange={e => updateField('description_en', e.target.value)} className="mt-1" /></div>
                </div>
              </div>

              {/* ─── Trip picker + reorder ─── */}
              <div className="border-t border-gray-200 pt-4">
                <Label className="mb-2 block font-semibold">{ar ? 'الرحلات المشمولة' : 'Included Trips'}</Label>
                <Select value={tripPicker} onValueChange={addTrip}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={ar ? 'أضف رحلة...' : 'Add a trip...'} /></SelectTrigger>
                  <SelectContent>
                    {trips.filter(t => !form.trip_ids.includes(t.id)).map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {ar ? t.name_ar : t.name_en} — {Number(t.package_price) > 0 ? `${ar ? 'باكدج' : 'pkg'} ${t.package_price}` : (ar ? 'من غير سعر باكدج' : 'no package price')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTrips.length > 0 && (
                  <Reorder.Group as="div" axis="y" values={selectedTrips} onReorder={reorderTrips} className="mt-3 space-y-1.5">
                    {selectedTrips.map(t => (
                      <PackageTripRow key={t.id} trip={t} ar={ar} onRemove={() => removeTrip(t.id)} />
                    ))}
                  </Reorder.Group>
                )}

                {selectedTrips.length === 0 && (
                  <p className="mt-2 text-sm text-gray-400">{ar ? 'لسه مفيش رحلات مختارة' : 'No trips selected yet'}</p>
                )}

                {missingPackagePrice.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {ar
                      ? `${missingPackagePrice.length} رحلة من غير سعر باكدج صحيح — الباكدج مش هينفع يتنشر لحد ما يتظبطوا`
                      : `${missingPackagePrice.length} trip(s) missing a valid package price — the package can't publish until they're fixed`}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">{ar ? 'الإجمالي العام' : 'Public total'}</div>
                    <div className="font-semibold text-gray-700">{fmt(totals.publicTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{ar ? 'إجمالي الباكدج' : 'Package total'}</div>
                    <div className="font-bold text-brand-blue">{fmt(totals.packageTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{ar ? 'توفير العميل' : 'Customer saving'}</div>
                    <div className="font-semibold text-green-600">{fmt(totals.savings)}</div>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  {ar ? 'العميل بيشوف إجمالي الباكدج بس — أسعار كل رحلة لوحدها في الباكدج متعرضش للعميل.' : 'Customers only ever see the final package total — per-trip package prices are never shown publicly.'}
                </p>
              </div>

              <div className="flex items-center gap-6 border-t border-gray-200 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={e => updateField('featured', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{ar ? 'مميز' : 'Featured'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => updateField('is_active', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{ar ? 'منشور (يظهر للعملاء)' : 'Published (visible to customers)'}</span>
                </label>
              </div>

              {saveError && <p className="text-sm text-red-600 font-medium">{saveError}</p>}

              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setShowForm(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {ar ? 'حفظ' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function PackageTripRow({ trip, ar, onRemove }: { trip: SinaiTrip; ar: boolean; onRemove: () => void }) {
  const controls = useDragControls()
  const valid = Number(trip.package_price) > 0
  return (
    <Reorder.Item as="div" value={trip} dragListener={false} dragControls={controls}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-sm">
      <button type="button" onPointerDown={e => controls.start(e)} className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center text-gray-400 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 truncate">{ar ? trip.name_ar : trip.name_en}</span>
      <span className={cn('shrink-0 text-xs', valid ? 'text-gray-500' : 'text-amber-600')}>
        {valid ? `${ar ? 'باكدج' : 'pkg'} ${trip.package_price}` : (ar ? 'من غير سعر باكدج' : 'no package price')}
      </span>
      <button type="button" onClick={onRemove} className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </Reorder.Item>
  )
}
