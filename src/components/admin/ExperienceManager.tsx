'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocale } from 'next-intl'
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
  Plus, Pencil, Trash2, X, Search, Upload, Loader2, ImagePlus, AlertTriangle,
} from 'lucide-react'
import type { Experience, ExperienceCategory, ExperiencePartner, ExperienceItineraryStep, SinaiTrip } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ExperienceForm {
  id?: string
  slug: string
  title_ar: string
  title_en: string
  category: string | null
  short_description_ar: string
  short_description_en: string
  full_description_ar: string
  full_description_en: string
  included_ar: string[]
  included_en: string[]
  not_included_ar: string[]
  not_included_en: string[]
  itinerary: ExperienceItineraryStep[]
  hero_image: string
  gallery: string[]
  duration_ar: string
  duration_en: string
  price: number
  currency: 'EGP' | 'USD'
  discount_value: number | null
  discount_type: 'amount' | 'percentage' | null
  discount_label: string
  badge_ar: string
  badge_en: string
  featured: boolean
  starting_from_price: boolean
  status: 'draft' | 'published'
  sort_order: number
  partner_ids: string[]
  trip_ids: string[]
}

const emptyForm: ExperienceForm = {
  slug: '', title_ar: '', title_en: '', category: null,
  short_description_ar: '', short_description_en: '', full_description_ar: '', full_description_en: '',
  included_ar: [], included_en: [], not_included_ar: [], not_included_en: [],
  itinerary: [], hero_image: '', gallery: [],
  duration_ar: '', duration_en: '',
  price: 0, currency: 'EGP', discount_value: null, discount_type: null, discount_label: '',
  badge_ar: '', badge_en: '', featured: false, starting_from_price: false,
  status: 'draft', sort_order: 0,
  partner_ids: [], trip_ids: [],
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

type AdminExperience = Experience & {
  experience_partner_links?: { sort_order: number; experience_partners: { id: string; name: string } | null }[]
  experience_trips?: { sort_order: number; sinai_trips: { id: string; name_ar: string; name_en: string } | null }[]
}

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex gap-2 mb-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="flex-1" />
        <Button type="button" size="sm" variant="outline" onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft('') } }}>+</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1">{v}<X className="h-3 w-3 cursor-pointer" onClick={() => onChange(values.filter((_, idx) => idx !== i))} /></Badge>
        ))}
      </div>
    </div>
  )
}

export function ExperienceManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()

  const [experiences, setExperiences] = useState<AdminExperience[]>([])
  const [categories, setCategories] = useState<ExperienceCategory[]>([])
  const [partners, setPartners] = useState<ExperiencePartner[]>([])
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExperienceForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [eData, cData, pData, tData] = await Promise.all([
        api('/api/admin/experiences'),
        api('/api/admin/experience-categories'),
        api('/api/admin/experience-partners'),
        api('/api/admin/sinai-trips'),
      ])
      setExperiences(eData.experiences || [])
      setCategories(cData.categories || [])
      setPartners(pData.partners || [])
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

  const filtered = experiences.filter((e) => !search || e.title_ar.includes(search) || e.title_en.toLowerCase().includes(search.toLowerCase()))

  const updateField = <K extends keyof ExperienceForm>(field: K, value: ExperienceForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAdd = () => { setEditingId(null); setForm(emptyForm); setSaveError(''); setShowForm(true) }
  const handleEdit = (e: AdminExperience) => {
    setEditingId(e.id)
    setForm({
      id: e.id, slug: e.slug, title_ar: e.title_ar, title_en: e.title_en, category: e.category || null,
      short_description_ar: e.short_description_ar || '', short_description_en: e.short_description_en || '',
      full_description_ar: e.full_description_ar || '', full_description_en: e.full_description_en || '',
      included_ar: e.included_ar || [], included_en: e.included_en || [],
      not_included_ar: e.not_included_ar || [], not_included_en: e.not_included_en || [],
      itinerary: e.itinerary || [], hero_image: e.hero_image || '', gallery: e.gallery || [],
      duration_ar: e.duration_ar || '', duration_en: e.duration_en || '',
      price: e.price || 0, currency: e.currency || 'EGP',
      discount_value: e.discount_value ?? null, discount_type: e.discount_type ?? null, discount_label: e.discount_label || '',
      badge_ar: e.badge_ar || '', badge_en: e.badge_en || '', featured: e.featured, starting_from_price: e.starting_from_price,
      status: e.status, sort_order: e.sort_order,
      partner_ids: (e.experience_partner_links || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((l) => l.experience_partners?.id).filter((id): id is string => Boolean(id)),
      trip_ids: (e.experience_trips || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((l) => l.sinai_trips?.id).filter((id): id is string => Boolean(id)),
    })
    setSaveError('')
    setShowForm(true)
  }

  const handleImageUpload = async (files: FileList | null, target: 'hero_image' | 'gallery') => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.append('file', file)
        body.append('folder', 'experiences')
        const res = await fetch('/api/admin/upload-image', { method: 'POST', body })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        if (target === 'hero_image') updateField('hero_image', data.url)
        else updateField('gallery', [...form.gallery, data.url].slice(0, 6))
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const addItineraryStep = () => updateField('itinerary', [...form.itinerary, { title_ar: '', title_en: '', description_ar: '', description_en: '' }])
  const updateItineraryStep = (i: number, patch: Partial<ExperienceItineraryStep>) => {
    updateField('itinerary', form.itinerary.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  const removeItineraryStep = (i: number) => updateField('itinerary', form.itinerary.filter((_, idx) => idx !== i))

  const togglePartner = (id: string) => {
    updateField('partner_ids', form.partner_ids.includes(id) ? form.partner_ids.filter((p) => p !== id) : [...form.partner_ids, id])
  }
  const toggleTrip = (id: string) => {
    updateField('trip_ids', form.trip_ids.includes(id) ? form.trip_ids.filter((t) => t !== id) : [...form.trip_ids, id])
  }

  const handleSave = async () => {
    setSaveError('')
    if (!form.slug || !form.title_ar || !form.title_en) {
      setSaveError(ar ? 'الاسم والمعرف (slug) مطلوبين' : 'Title and slug are required')
      return
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setSaveError(ar ? 'المعرف (slug) يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطة' : 'Slug must contain only lowercase letters, numbers, and hyphens')
      return
    }
    if (form.status === 'published' && form.price <= 0) {
      setSaveError(ar ? 'مينفعش تنشر تجربة من غير سعر' : 'Cannot publish an experience with no price')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await api(`/api/admin/experiences/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await api('/api/admin/experiences', { method: 'POST', body: JSON.stringify(form) })
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
      await api(`/api/admin/experiences/${id}`, { method: 'DELETE' })
      setExperiences((prev) => prev.filter((e) => e.id !== id))
    } catch (e) { alert((e as Error).message) }
  }

  const activePartners = useMemo(() => partners.filter((p) => p.is_active), [partners])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder={ar ? 'بحث...' : 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="h-4 w-4 mr-2" />{ar ? 'إضافة تجربة' : 'Add Experience'}
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الاسم' : 'Title'}</TableHead>
                <TableHead>{ar ? 'التصنيف' : 'Category'}</TableHead>
                <TableHead>{ar ? 'السعر' : 'Price'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{ar ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && loadError && <TableRow><TableCell colSpan={5} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{ar ? 'لا توجد تجارب' : 'No experiences yet'}</TableCell></TableRow>
              )}
              {!loading && filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{ar ? e.title_ar : e.title_en}</TableCell>
                  <TableCell className="text-gray-500">{categories.find((c) => c.slug === e.category)?.[ar ? 'label_ar' : 'label_en'] || '—'}</TableCell>
                  <TableCell>
                    {e.price > 0 ? `${e.price.toLocaleString()} ${e.currency}` : (
                      <span className="flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle className="h-3 w-3" />{ar ? 'مفيش سعر' : 'No price'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={e.status === 'published' ? 'bg-green-100 text-green-700' : ''} variant={e.status === 'published' ? 'default' : 'outline'}>
                      {e.status === 'published' ? (ar ? 'منشور' : 'Published') : (ar ? 'مسودة' : 'Draft')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? (ar ? 'تعديل التجربة' : 'Edit Experience') : (ar ? 'تجربة جديدة' : 'New Experience')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{ar ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label><Input value={form.title_ar} onChange={(e) => updateField('title_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{ar ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label><Input value={form.title_en} onChange={(e) => updateField('title_en', e.target.value)} className="mt-1" /></div>
                <div className="md:col-span-2"><Label>{ar ? 'المعرف (slug)' : 'Slug'}</Label><Input dir="ltr" value={form.slug} onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="mt-1" /></div>
                <div>
                  <Label>{ar ? 'التصنيف' : 'Category'}</Label>
                  <Select value={form.category || undefined} onValueChange={(v) => updateField('category', v || null)}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue placeholder={ar ? 'اختر تصنيف...' : 'Select a category...'} /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{ar ? c.label_ar : c.label_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{ar ? 'المدة (عربي)' : 'Duration (Arabic)'}</Label><Input value={form.duration_ar} onChange={(e) => updateField('duration_ar', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'المدة (إنجليزي)' : 'Duration (English)'}</Label><Input value={form.duration_en} onChange={(e) => updateField('duration_en', e.target.value)} className="mt-1" /></div>
                </div>

                <div><Label>{ar ? 'وصف مختصر (عربي)' : 'Short description (Arabic)'}</Label><Textarea rows={2} value={form.short_description_ar} onChange={(e) => updateField('short_description_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{ar ? 'وصف مختصر (إنجليزي)' : 'Short description (English)'}</Label><Textarea rows={2} value={form.short_description_en} onChange={(e) => updateField('short_description_en', e.target.value)} className="mt-1" /></div>
                <div><Label>{ar ? 'الوصف الكامل (عربي)' : 'Full description (Arabic)'}</Label><Textarea rows={4} value={form.full_description_ar} onChange={(e) => updateField('full_description_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{ar ? 'الوصف الكامل (إنجليزي)' : 'Full description (English)'}</Label><Textarea rows={4} value={form.full_description_en} onChange={(e) => updateField('full_description_en', e.target.value)} className="mt-1" /></div>
              </div>

              {/* Pricing */}
              <div className="border-t border-gray-200 pt-4">
                <Label className="mb-2 block font-semibold">{ar ? 'التسعير (مستقل تمامًا عن باكدجات الرحلات)' : 'Pricing (fully independent from Trip Packages)'}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">{ar ? 'السعر النهائي' : 'Final price'}</Label>
                    <Input type="number" min={0} value={form.price} onChange={(e) => updateField('price', parseFloat(e.target.value) || 0)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">{ar ? 'العملة' : 'Currency'}</Label>
                    <Select value={form.currency} onValueChange={(v) => v && updateField('currency', v as 'EGP' | 'USD')}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="EGP">EGP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{ar ? 'خصم' : 'Discount value'}</Label>
                    <Input type="number" min={0} value={form.discount_value ?? ''} onChange={(e) => updateField('discount_value', e.target.value === '' ? null : parseFloat(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">{ar ? 'نوع الخصم' : 'Discount type'}</Label>
                    <Select value={form.discount_type || undefined} onValueChange={(v) => updateField('discount_type', (v as 'amount' | 'percentage') || null)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent><SelectItem value="amount">{ar ? 'مبلغ' : 'Amount'}</SelectItem><SelectItem value="percentage">{ar ? 'نسبة %' : 'Percentage'}</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.starting_from_price} onChange={(e) => updateField('starting_from_price', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{ar ? 'اعرض السعر كـ "يبدأ من"' : 'Show price as "starting from"'}</span>
                </label>
              </div>

              {/* Inclusions/exclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
                <ListEditor label={ar ? 'شامل (عربي)' : 'Included (Arabic)'} values={form.included_ar} onChange={(v) => updateField('included_ar', v)} placeholder={ar ? 'أضف عنصر...' : 'Add item...'} />
                <ListEditor label={ar ? 'شامل (إنجليزي)' : 'Included (English)'} values={form.included_en} onChange={(v) => updateField('included_en', v)} placeholder={ar ? 'أضف عنصر...' : 'Add item...'} />
                <ListEditor label={ar ? 'مش شامل (عربي)' : 'Not included (Arabic)'} values={form.not_included_ar} onChange={(v) => updateField('not_included_ar', v)} placeholder={ar ? 'أضف عنصر...' : 'Add item...'} />
                <ListEditor label={ar ? 'مش شامل (إنجليزي)' : 'Not included (English)'} values={form.not_included_en} onChange={(v) => updateField('not_included_en', v)} placeholder={ar ? 'أضف عنصر...' : 'Add item...'} />
              </div>

              {/* Itinerary */}
              <div className="border-t border-gray-200 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="font-semibold">{ar ? 'برنامج الرحلة' : 'Itinerary'}</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addItineraryStep}><Plus className="h-3.5 w-3.5 mr-1" />{ar ? 'إضافة خطوة' : 'Add step'}</Button>
                </div>
                <div className="space-y-2">
                  {form.itinerary.map((step, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-gray-200 p-2.5">
                      <Input placeholder={ar ? 'العنوان (عربي)' : 'Title (Arabic)'} value={step.title_ar} onChange={(e) => updateItineraryStep(i, { title_ar: e.target.value })} />
                      <Input placeholder={ar ? 'العنوان (إنجليزي)' : 'Title (English)'} value={step.title_en} onChange={(e) => updateItineraryStep(i, { title_en: e.target.value })} />
                      <Input placeholder={ar ? 'تفاصيل (عربي)' : 'Details (Arabic)'} value={step.description_ar || ''} onChange={(e) => updateItineraryStep(i, { description_ar: e.target.value })} />
                      <div className="flex gap-2">
                        <Input placeholder={ar ? 'تفاصيل (إنجليزي)' : 'Details (English)'} value={step.description_en || ''} onChange={(e) => updateItineraryStep(i, { description_en: e.target.value })} className="flex-1" />
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItineraryStep(i)} className="text-red-500"><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">{ar ? 'الصورة الرئيسية' : 'Hero image'}</Label>
                  <label className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 text-sm font-medium hover:bg-gray-50', uploading && 'opacity-60 pointer-events-none')}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {ar ? 'رفع صورة' : 'Upload'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading} onChange={(e) => handleImageUpload(e.target.files, 'hero_image')} />
                  </label>
                  {form.hero_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.hero_image} alt="" className="mt-2 h-24 w-40 rounded object-cover border border-gray-200" />
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">{ar ? 'معرض الصور (حتى 6)' : 'Gallery (up to 6)'}</Label>
                  <label className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 text-sm font-medium hover:bg-gray-50', uploading && 'opacity-60 pointer-events-none')}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {ar ? 'رفع صور' : 'Upload'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" disabled={uploading} onChange={(e) => handleImageUpload(e.target.files, 'gallery')} />
                  </label>
                  {form.gallery.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {form.gallery.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-200 bg-gray-100 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => updateField('gallery', form.gallery.filter((_, idx) => idx !== i))} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100">
                            <X className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Partners */}
              <div className="border-t border-gray-200 pt-4">
                <Label className="mb-2 block font-semibold">{ar ? 'الشركاء المرتبطين' : 'Linked partners'}</Label>
                <div className="flex flex-wrap gap-2">
                  {activePartners.map((p) => (
                    <button key={p.id} type="button" onClick={() => togglePartner(p.id)}
                      className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', form.partner_ids.includes(p.id) ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300 text-gray-600')}>
                      {p.name}
                    </button>
                  ))}
                  {activePartners.length === 0 && <p className="text-xs text-gray-400">{ar ? 'لا يوجد شركاء بعد' : 'No partners yet'}</p>}
                </div>
              </div>

              {/* Linked Sinai Trips */}
              <div className="border-t border-gray-200 pt-4">
                <Label className="mb-2 block font-semibold">{ar ? 'رحلات سيناء مرتبطة (اختياري، معلوماتي فقط)' : 'Linked Sinai Trips (optional, informational only)'}</Label>
                <p className="mb-2 text-[11px] text-gray-400">{ar ? 'الربط ده متأثرش على سعر التجربة أبدًا.' : "Linking never affects this experience's price."}</p>
                <div className="flex flex-wrap gap-2">
                  {trips.map((tr) => (
                    <button key={tr.id} type="button" onClick={() => toggleTrip(tr.id)}
                      className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', form.trip_ids.includes(tr.id) ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300 text-gray-600')}>
                      {ar ? tr.name_ar : tr.name_en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Badge/featured/status */}
              <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{ar ? 'الشارة (اختياري، عربي)' : 'Badge (optional, Arabic)'}</Label><Input value={form.badge_ar} onChange={(e) => updateField('badge_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{ar ? 'الشارة (اختياري، إنجليزي)' : 'Badge (optional, English)'}</Label><Input value={form.badge_en} onChange={(e) => updateField('badge_en', e.target.value)} className="mt-1" /></div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={(e) => updateField('featured', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{ar ? 'مميز' : 'Featured'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.status === 'published'} onChange={(e) => updateField('status', e.target.checked ? 'published' : 'draft')} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{ar ? 'منشور (يظهر للعملاء)' : 'Published (visible to customers)'}</span>
                </label>
                <div className="w-32">
                  <Label className="mb-1 block text-xs">{ar ? 'ترتيب العرض' : 'Display order'}</Label>
                  <Input type="number" min={0} value={form.sort_order} onChange={(e) => updateField('sort_order', parseInt(e.target.value) || 0)} />
                </div>
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
