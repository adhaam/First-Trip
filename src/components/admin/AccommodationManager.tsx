'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Plus, Pencil, Trash2, MapPin, Upload, X, Search, Loader2, ChevronUp, ChevronDown, ExternalLink, Link2, BedDouble, BedSingle, UtensilsCrossed } from 'lucide-react'
import { Accommodation, MealPlan, MealPlanKey } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SeasonalRatesEditor } from './SeasonalRatesEditor'

const TYPES = [
  { value: 'hotel', label_ar: '🏨 فندق', label_en: '🏨 Hotel' },
  { value: 'chalet', label_ar: '🏖️ شاليه', label_en: '🏖️ Chalet' },
  { value: 'camp', label_ar: '🏕️ كامب', label_en: '🏕️ Camp' },
]

const TIERS = [
  { value: 'budget', label_ar: '💸 Budget', label_en: '💸 Budget' },
  { value: 'standard', label_ar: '🏨 Standard', label_en: '🏨 Standard' },
  { value: 'premium', label_ar: '✨ Premium', label_en: '✨ Premium' },
  { value: 'lagoon', label_ar: '🌊 Lagoon', label_en: '🌊 Lagoon' },
]

// Meal-plan presets — admin just toggles which ones this property offers and
// sets a price for each; the label/key stay fixed so the booking form and
// price formula can rely on them.
const MEAL_PLAN_PRESETS: { key: MealPlanKey; label_ar: string; label_en: string }[] = [
  { key: 'room_only', label_ar: 'إقامة فقط', label_en: 'Room only' },
  { key: 'breakfast', label_ar: 'إقامة وإفطار', label_en: 'Bed & breakfast' },
  { key: 'half_board', label_ar: 'نص إقامة (إفطار وعشاء)', label_en: 'Half board (breakfast & dinner)' },
  { key: 'all_inclusive', label_ar: 'شامل كليًا (All Inclusive)', label_en: 'All inclusive' },
]

const emptyAccommodation: Partial<Accommodation> = {
  name_ar: '',
  name_en: '',
  type: 'hotel',
  tier: 'standard',
  price_per_night: 0,
  price_4day: 0,
  price_5day: 0,
  price_double_room: 0,
  price_single_room: 0,
  price_triple_room: 0,
  meal_plans: [],
  rating: 0,
  location_ar: '',
  location_en: '',
  amenities_ar: [],
  amenities_en: [],
  description_ar: '',
  description_en: '',
  image_url: '',
  images: [],
  latitude: 28.5092,
  longitude: 34.5185,
}

export function AccommodationManager() {
  const locale = useLocale()
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<Accommodation | null>(null)
  const [form, setForm] = useState<Partial<Accommodation>>({})
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mealPlanFor = (key: MealPlanKey): MealPlan | undefined =>
    ((form.meal_plans as MealPlan[]) || []).find(m => m.key === key)

  const toggleMealPlan = (key: MealPlanKey, label_ar: string, label_en: string) => {
    const current = ((form.meal_plans as MealPlan[]) || []).slice()
    const idx = current.findIndex(m => m.key === key)
    if (idx >= 0) {
      current[idx] = { ...current[idx], is_active: !current[idx].is_active }
    } else {
      current.push({ key, label_ar, label_en, price_per_person_per_night: 0, is_active: true })
    }
    updateField('meal_plans', current)
  }

  const updateMealPlanPrice = (key: MealPlanKey, label_ar: string, label_en: string, price: number) => {
    const current = ((form.meal_plans as MealPlan[]) || []).slice()
    const idx = current.findIndex(m => m.key === key)
    if (idx >= 0) {
      current[idx] = { ...current[idx], price_per_person_per_night: price }
    } else {
      current.push({ key, label_ar, label_en, price_per_person_per_night: price, is_active: true })
    }
    updateField('meal_plans', current)
  }

  const handleImageUpload = async (files: FileList) => {
    setUploading(true)
    setUploadError('')
    try {
      const currentImages = ((form.images as string[]) || []).slice()
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        currentImages.push(data.url)
      }
      updateField('images', currentImages)
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

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const current = ((form.images as string[]) || []).slice()
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= current.length) return
    const temp = current[index]
    current[index] = current[targetIndex]
    current[targetIndex] = temp
    updateField('images', current)
  }

  const loadAccommodations = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/accommodations')
      if (res.status === 401) {
        window.location.href = `/${locale}/admin`
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setAccommodations(data.accommodations || [])
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch, not a synchronous state computation
    loadAccommodations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = accommodations.filter(a => {
    const matchesSearch = !search || a.name_ar.includes(search) || a.name_en.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || a.type === filterType
    return matchesSearch && matchesType
  })

  const handleEdit = (acc: Accommodation) => {
    setEditing(acc)
    const images = acc.images && acc.images.length > 0
      ? acc.images
      : acc.image_url ? [acc.image_url] : []
    setForm({ ...acc, images })
    setShowForm(true)
  }

  const handleAdd = () => {
    setEditing(null)
    setForm({ ...emptyAccommodation })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name_ar || !form.name_en) return
    setSaving(true)
    try {
      const payload = {
        name_ar: form.name_ar || '',
        name_en: form.name_en || '',
        type: form.type || 'hotel',
        tier: form.tier || 'standard',
        description_ar: form.description_ar || '',
        description_en: form.description_en || '',
        image_url: (form.images as string[])?.[0] || form.image_url || '',
        images: (form.images as string[]) || [],
        rating: form.rating || 0,
        location_ar: form.location_ar || '',
        location_en: form.location_en || '',
        latitude: form.latitude ?? 28.5092,
        longitude: form.longitude ?? 34.5185,
        amenities_ar: (form.amenities_ar as string[]) || [],
        amenities_en: (form.amenities_en as string[]) || [],
        price_per_night: form.price_per_night || 0,
        price_4day: form.price_4day || 0,
        price_5day: form.price_5day || 0,
        price_double_room: form.price_double_room || 0,
        price_single_room: form.price_single_room || 0,
        price_triple_room: form.price_triple_room || 0,
        meal_plans: (form.meal_plans as MealPlan[]) || [],
        is_active: form.is_active ?? true,
      }
      const res = editing
        ? await fetch(`/api/admin/accommodations/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/accommodations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (res.status === 401) {
        window.location.href = `/${locale}/admin`
        return
      }
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || (locale === 'ar' ? 'فشل الحفظ' : 'Save failed'))
        return
      }
      await loadAccommodations()
      setShowForm(false)
      setEditing(null)
      setForm({})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(locale === 'ar' ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/accommodations/${id}`, { method: 'DELETE' })
    if (res.status === 401) {
      window.location.href = `/${locale}/admin`
      return
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || (locale === 'ar' ? 'فشل الحذف' : 'Delete failed'))
      return
    }
    setAccommodations(prev => prev.filter(a => a.id !== id))
  }

  const updateField = (field: string, value: string | number | string[] | MealPlan[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const [mapUrlInput, setMapUrlInput] = useState('')
  const [mapUrlError, setMapUrlError] = useState('')

  // Accepts a pasted Google Maps link (share link, "@lat,lng" URL, or a
  // plain "lat,lng" pair) and extracts coordinates from it — this is the
  // "link the map location" flow: paste from Google Maps, done.
  const applyMapUrl = () => {
    setMapUrlError('')
    const raw = mapUrlInput.trim()
    if (!raw) return

    // "lat,lng" typed/pasted directly
    const plainMatch = raw.match(/^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/)
    // Google Maps URLs contain "@lat,lng" or "q=lat,lng" or "3d<lat>!4d<lng>"
    const atMatch = raw.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    const qMatch = raw.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    const threeDMatch = raw.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)

    const match = plainMatch || atMatch || qMatch || threeDMatch
    if (!match) {
      setMapUrlError(
        locale === 'ar'
          ? 'مش قادر أطلع الإحداثيات من الرابط ده. انسخ رابط "مشاركة" من جوجل مابس أو حط الإحداثيات lat,lng مباشرة.'
          : 'Could not read coordinates from that link. Paste a Google Maps "Share" link or lat,lng directly.',
      )
      return
    }
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    if (Number.isNaN(lat) || Number.isNaN(lng)) return
    updateField('latitude', lat)
    updateField('longitude', lng)
    setMapUrlInput('')
  }

  const addAmenity = (lang: 'ar' | 'en') => {
    const key = lang === 'ar' ? 'amenities_ar' : 'amenities_en'
    const current = (form[key] as string[]) || []
    const input = document.getElementById(`amenity-${lang}-input`) as HTMLInputElement
    if (input?.value?.trim()) {
      updateField(key, [...current, input.value.trim()])
      input.value = ''
    }
  }

  const removeAmenity = (lang: 'ar' | 'en', index: number) => {
    const key = lang === 'ar' ? 'amenities_ar' : 'amenities_en'
    updateField(key, ((form[key] as string[]) || []).filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={locale === 'ar' ? 'بحث...' : 'Search...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={locale === 'ar' ? 'النوع' : 'Type'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'ar' ? 'الكل' : 'All'}</SelectItem>
              <SelectItem value="hotel">{locale === 'ar' ? '🏨 فندق' : '🏨 Hotel'}</SelectItem>
              <SelectItem value="chalet">{locale === 'ar' ? '🏖️ شاليه' : '🏖️ Chalet'}</SelectItem>
              <SelectItem value="camp">{locale === 'ar' ? '🏕️ كامب' : '🏕️ Camp'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'إضافة مكان إقامة' : 'Add Accommodation'}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{locale === 'ar' ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{locale === 'ar' ? 'التقييم' : 'Rating'}</TableHead>
                <TableHead>{locale === 'ar' ? 'السعر/ليلة' : 'Price/Night'}</TableHead>
                <TableHead>{locale === 'ar' ? '4 أيام' : '4 Days'}</TableHead>
                <TableHead>{locale === 'ar' ? '5 أيام' : '5 Days'}</TableHead>
                <TableHead className="text-right">{locale === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-red-500 py-8">{loadError}</TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{locale === 'ar' ? acc.name_ar : acc.name_en}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      'border-brand-blue/30 text-brand-blue',
                      acc.type === 'chalet' && 'border-green-500/30 text-green-600',
                      acc.type === 'camp' && 'border-orange-500/30 text-orange-600'
                    )}>
                      {acc.type === 'hotel' ? '🏨' : acc.type === 'chalet' ? '🏖️' : '🏕️'}
                      {' '}{TYPES.find(t => t.value === acc.type)?.[locale === 'ar' ? 'label_ar' : 'label_en']?.replace(/[🏨🏖️🏕️] /, '')}
                    </Badge>
                  </TableCell>
                  <TableCell>⭐ {acc.rating}</TableCell>
                  <TableCell>{acc.price_per_night?.toLocaleString()} ج.م</TableCell>
                  <TableCell>{acc.price_4day?.toLocaleString()} ج.م</TableCell>
                  <TableCell>{acc.price_5day?.toLocaleString()} ج.م</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(acc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    {locale === 'ar' ? 'لا توجد أماكن إقامة' : 'No accommodations found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editing
                    ? (locale === 'ar' ? 'تعديل مكان الإقامة' : 'Edit Accommodation')
                    : (locale === 'ar' ? 'إضافة مكان إقامة جديد' : 'Add New Accommodation')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditing(null) }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>


              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{locale === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
                  <Input value={form.name_ar || ''} onChange={e => updateField('name_ar', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                  <Input value={form.name_en || ''} onChange={e => updateField('name_en', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'النوع' : 'Type'}</Label>
                  <Select value={form.type || 'hotel'} onValueChange={v => v && updateField('type', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{locale === 'ar' ? t.label_ar : t.label_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'الفئة' : 'Tier'}</Label>
                  <Select value={form.tier || 'standard'} onValueChange={v => v && updateField('tier', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIERS.map(t => <SelectItem key={t.value} value={t.value}>{locale === 'ar' ? t.label_ar : t.label_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>⭐ {locale === 'ar' ? 'التقييم' : 'Rating'}</Label>
                  <Input type="number" min={0} max={5} step={0.1} value={form.rating || 0} onChange={e => updateField('rating', parseFloat(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'الموقع' : 'Location'}</Label>
                  <Input value={form.location_en || ''} onChange={e => updateField('location_en', e.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label>{locale === 'ar' ? 'صور الإقامة' : 'Accommodation Photos'}</Label>
                  <div className="mt-1 space-y-3">
                    {/* Image gallery grid */}
                    {((form.images as string[]) || []).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {((form.images as string[]) || []).map((url, index) => (
                          <div key={index} className="relative group rounded-xl overflow-hidden border border-sand-300 bg-sand-100 aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            {index === 0 && (
                              <Badge className="absolute top-1.5 left-1.5 bg-brand-blue text-white text-[10px] px-1.5 py-0.5">
                                {locale === 'ar' ? 'صورة رئيسية' : 'Main photo'}
                              </Badge>
                            )}
                            <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="rounded-full bg-black/50 p-1 text-white hover:bg-red-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => moveImage(index, 'up')}
                                  className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {index < ((form.images as string[]) || []).length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => moveImage(index, 'down')}
                                  className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Upload button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const files = e.target.files
                        if (files && files.length > 0) handleImageUpload(files)
                        e.target.value = ''
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {locale === 'ar' ? 'رفع صور' : 'Upload photos'}
                      </Button>
                      <span className="text-xs text-gray-400 self-center">
                        {locale === 'ar'
                          ? `${((form.images as string[]) || []).length} صور مرفوعة`
                          : `${((form.images as string[]) || []).length} photo(s) uploaded`}
                      </span>
                    </div>
                    {uploadError && (
                      <p className="text-xs text-red-500">{uploadError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Map Location */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-brand-orange" />
                  {locale === 'ar' ? 'الموقع على الخريطة' : 'Map Location'}
                </Label>

                <div className="space-y-3 rounded-xl border p-4 bg-gray-50">
                  {/* Paste a Google Maps link */}
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">
                      {locale === 'ar'
                        ? 'الصق رابط "مشاركة" من جوجل مابس (أسهل طريقة)'
                        : 'Paste a Google Maps "Share" link (easiest way)'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={mapUrlInput}
                        onChange={e => setMapUrlInput(e.target.value)}
                        placeholder={locale === 'ar' ? 'https://maps.app.goo.gl/... أو lat,lng' : 'https://maps.app.goo.gl/... or lat,lng'}
                        dir="ltr"
                        className="flex-1 text-sm"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={applyMapUrl} className="gap-1.5 shrink-0">
                        <Link2 className="h-3.5 w-3.5" />
                        {locale === 'ar' ? 'ربط' : 'Link'}
                      </Button>
                    </div>
                    {mapUrlError && <p className="text-xs text-red-500 mt-1">{mapUrlError}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {locale === 'ar'
                        ? 'في جوجل مابس: افتح المكان → مشاركة → نسخ الرابط، والصقه هنا.'
                        : 'In Google Maps: open the place → Share → Copy link, then paste it here.'}
                    </p>
                  </div>

                  {/* Manual lat/lng */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs">{locale === 'ar' ? 'خط العرض (Lat)' : 'Latitude'}</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={form.latitude ?? ''}
                        onChange={e => updateField('latitude', parseFloat(e.target.value))}
                        className="mt-1 text-sm"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{locale === 'ar' ? 'خط الطول (Lng)' : 'Longitude'}</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={form.longitude ?? ''}
                        onChange={e => updateField('longitude', parseFloat(e.target.value))}
                        className="mt-1 text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Preview link */}
                  {typeof form.latitude === 'number' && typeof form.longitude === 'number' && (
                    <a
                      href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {locale === 'ar' ? 'افتح الموقع الحالي في جوجل مابس' : 'Preview this location on Google Maps'}
                    </a>
                  )}
                </div>
              </div>

              {/* Room pricing — drives the booking form's price calc */}
              <div>
                <Label className="font-bold text-gray-900 mb-1 block">
                  {locale === 'ar' ? 'أسعار الغرف (بالجنيه المصري)' : 'Room Prices (EGP)'}
                </Label>
                <p className="text-xs text-gray-500 mb-3">
                  {locale === 'ar'
                    ? 'السعر هنا هو سعر الغرفة كاملة لليلة — سعر الفرد بيتحسب تلقائيًا (دبل ÷ 2، تريبل ÷ 3).'
                    : 'Each price is the TOTAL room price per night — per-person is derived (double ÷ 2, triple ÷ 3).'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><BedSingle className="h-3.5 w-3.5 text-gray-400" />{locale === 'ar' ? 'سينجل (فرد — لليلة)' : 'Single (1 — per night)'}</Label>
                    <Input type="number" min={0} value={form.price_single_room || 0} onChange={e => updateField('price_single_room', parseInt(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-gray-400" />{locale === 'ar' ? 'دبل (فردين — لليلة)' : 'Double (2 — per night)'}</Label>
                    <Input type="number" min={0} value={form.price_double_room || 0} onChange={e => updateField('price_double_room', parseInt(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-gray-400" />{locale === 'ar' ? 'تريبل (3 أفراد — لليلة)' : 'Triple (3 — per night)'}</Label>
                    <Input
                      type="number" min={0}
                      value={form.price_triple_room || 0}
                      placeholder={form.price_double_room ? String(Math.round(Number(form.price_double_room) * 1.5)) : ''}
                      onChange={e => updateField('price_triple_room', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                    {!form.price_triple_room && !!form.price_double_room && (
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-brand-blue hover:underline"
                        onClick={() => updateField('price_triple_room', Math.round(Number(form.price_double_room) * 1.5))}
                      >
                        {locale === 'ar'
                          ? `اقتراح: ${Math.round(Number(form.price_double_room) * 1.5).toLocaleString()} (الدبل × 1.5)`
                          : `Suggest: ${Math.round(Number(form.price_double_room) * 1.5).toLocaleString()} (double × 1.5)`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Seasonal pricing periods — only when editing (needs a saved id) */}
              {editing?.id ? (
                <SeasonalRatesEditor accommodationId={editing.id} locale={locale} />
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-gray-400">
                  {locale === 'ar'
                    ? 'احفظ المكان الأول، وبعدين تقدر تضيف فترات أسعار موسمية (زي الكريسماس ورأس السنة).'
                    : 'Save the accommodation first, then you can add seasonal pricing periods (e.g. Christmas / New Year).'}
                </p>
              )}

              {/* Meal plans */}
              <div>
                <Label className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  <UtensilsCrossed className="h-4 w-4 text-gray-400" />
                  {locale === 'ar' ? 'أنواع الإقامة (نوع الوجبات)' : 'Meal Plans'}
                </Label>
                <p className="text-xs text-gray-500 mb-3">
                  {locale === 'ar'
                    ? 'فعّل الخيارات المتاحة في المكان ده وحط سعرها للفرد في الليلة — العميل يختار واحد منها وقت الحجز.'
                    : 'Enable what this property offers and price it per person, per night — the customer picks one at booking.'}
                </p>
                <div className="space-y-2">
                  {MEAL_PLAN_PRESETS.map(preset => {
                    const plan = mealPlanFor(preset.key)
                    const active = plan?.is_active ?? false
                    return (
                      <div key={preset.key} className={cn('flex items-center gap-3 rounded-lg border p-2.5', active ? 'border-brand-blue/30 bg-brand-blue/5' : 'border-gray-200')}>
                        <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleMealPlan(preset.key, preset.label_ar, preset.label_en)}
                            className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                          />
                          {locale === 'ar' ? preset.label_ar : preset.label_en}
                        </label>
                        {active && (
                          <Input
                            type="number"
                            min={0}
                            value={plan?.price_per_person_per_night || 0}
                            onChange={e => updateMealPlanPrice(preset.key, preset.label_ar, preset.label_en, parseInt(e.target.value) || 0)}
                            placeholder={locale === 'ar' ? 'إضافة للفرد/لليلة' : 'Add-on per person/night'}
                            className="w-40 h-8 text-sm"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legacy flat prices — kept as a fallback where room prices aren't set yet */}
              <div>
                <Label className="font-bold text-gray-900 mb-1 block">{locale === 'ar' ? 'أسعار احتياطية قديمة (اختياري)' : 'Legacy Fallback Prices (optional)'}</Label>
                <p className="text-xs text-gray-500 mb-3">
                  {locale === 'ar'
                    ? 'تستخدم بس لو مفيش سعر غرف متحدد فوق. الأفضل تسيبها وتعتمد على أسعار الغرف.'
                    : "Only used if the room prices above aren't set. Prefer relying on room prices instead."}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">{locale === 'ar' ? 'سعر الليلة' : 'Per Night'}</Label>
                    <Input type="number" min={0} value={form.price_per_night || 0} onChange={e => updateField('price_per_night', parseInt(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">{locale === 'ar' ? 'باكدج 4 أيام' : '4-Day Package'}</Label>
                    <Input type="number" min={0} value={form.price_4day || 0} onChange={e => updateField('price_4day', parseInt(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">{locale === 'ar' ? 'باكدج 5 أيام' : '5-Day Package'}</Label>
                    <Input type="number" min={0} value={form.price_5day || 0} onChange={e => updateField('price_5day', parseInt(e.target.value))} className="mt-1" />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div>
                <Label className="mb-2 block">{locale === 'ar' ? 'الخدمات' : 'Amenities'}</Label>
                <div className="flex gap-2 mb-2">
                  <Input id="amenity-en-input" placeholder={locale === 'ar' ? 'أضف خدمة...' : 'Add amenity...'} className="flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={() => addAmenity('en')}>+</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {((form.amenities_en as string[]) || []).map((a, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {a}
                      <button type="button" onClick={() => removeAmenity('en', i)} className="ml-1 hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="mb-2 block">{locale === 'ar' ? 'الوصف' : 'Description'}</Label>
                <Textarea rows={3} value={form.description_en || ''} onChange={e => updateField('description_en', e.target.value)} />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
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
