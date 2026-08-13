'use client'

import { useState, useEffect } from 'react'
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
import { Plus, Pencil, Trash2, MapPin, Upload, X, Search, Loader2 } from 'lucide-react'
import { Accommodation } from '@/lib/types'
import { cn } from '@/lib/utils'

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

const emptyAccommodation: Partial<Accommodation> = {
  name_ar: '',
  name_en: '',
  type: 'hotel',
  tier: 'standard',
  price_per_night: 0,
  price_4day: 0,
  price_5day: 0,
  rating: 0,
  location_ar: '',
  location_en: '',
  amenities_ar: [],
  amenities_en: [],
  description_ar: '',
  description_en: '',
  image_url: '',
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
    setForm({ ...acc })
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
      const res = editing
        ? await fetch(`/api/admin/accommodations/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await fetch('/api/admin/accommodations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
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

  const updateField = (field: string, value: string | number | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
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
        <CardContent className="p-0">
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
                  <Label>{locale === 'ar' ? 'الموقع (عربي)' : 'Location (Arabic)'}</Label>
                  <Input value={form.location_ar || ''} onChange={e => updateField('location_ar', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'الموقع (إنجليزي)' : 'Location (English)'}</Label>
                  <Input value={form.location_en || ''} onChange={e => updateField('location_en', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{locale === 'ar' ? 'رابط الصورة' : 'Image URL'}</Label>
                  <Input value={form.image_url || ''} onChange={e => updateField('image_url', e.target.value)} className="mt-1" placeholder="https://..." />
                </div>
              </div>

              {/* Map Preview */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-brand-orange" />
                  {locale === 'ar' ? 'الموقع على الخريطة' : 'Map Location'}
                </Label>
                <div className="border rounded-xl overflow-hidden bg-gray-100 h-[200px] flex items-center justify-center text-gray-400 text-sm">
                  🗺️ {locale === 'ar' ? 'خريطة تفاعلية — سيتم ربطها بـ Leaflet' : 'Interactive map — will be connected to Leaflet'}
                  <br />
                  <span className="text-xs mt-1 block">Lat: {form.latitude} | Lng: {form.longitude}</span>
                </div>
              </div>

              {/* Prices */}
              <div>
                <Label className="font-bold text-gray-900 mb-3 block">{locale === 'ar' ? 'الأسعار (بالجنيه المصري)' : 'Prices (EGP)'}</Label>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">{locale === 'ar' ? 'الخدمات (عربي)' : 'Amenities (Arabic)'}</Label>
                  <div className="flex gap-2 mb-2">
                    <Input id="amenity-ar-input" placeholder={locale === 'ar' ? 'أضف خدمة...' : 'Add amenity...'} className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => addAmenity('ar')}>+</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((form.amenities_ar as string[]) || []).map((a, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {a}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeAmenity('ar', i)} />
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">{locale === 'ar' ? 'الخدمات (إنجليزي)' : 'Amenities (English)'}</Label>
                  <div className="flex gap-2 mb-2">
                    <Input id="amenity-en-input" placeholder={locale === 'ar' ? 'أضف خدمة...' : 'Add amenity...'} className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => addAmenity('en')}>+</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {((form.amenities_en as string[]) || []).map((a, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {a}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeAmenity('en', i)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <Label className="mb-2 block">{locale === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea rows={3} value={form.description_ar || ''} onChange={e => updateField('description_ar', e.target.value)} />
              </div>
              <div>
                <Label className="mb-2 block">{locale === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
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