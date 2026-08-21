'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Upload, X, ChevronLeft, Wand2 } from 'lucide-react'

type AdminFetch = (url: string, init?: RequestInit) => Promise<Record<string, unknown> & { error?: string }>

interface CategoryLite { id: string; name_ar: string; name_en: string }
interface CollectionLite { id: string; name_ar: string; name_en: string }

interface OptionValue { id: string; value_ar: string; value_en: string }
interface ProductOption { id: string; name_ar: string; name_en: string; commerce_product_option_values: OptionValue[] }
interface Variant {
  id: string; sku: string | null; option_value_ids: string[]; price_override: number | null
  inventory_quantity: number; is_active: boolean; image_url: string
}
interface RentalTier {
  id: string; variant_id: string | null; duration_days: number; label_ar: string; label_en: string; price: number; is_active: boolean
}

interface ProductFull {
  id: string; product_type: 'sale' | 'rental'; slug: string; name_ar: string; name_en: string
  description_ar: string; description_en: string; images: string[]; base_price: number
  compare_at_price: number | null; badge_text: string; sku: string | null; track_inventory: boolean
  requires_delivery: boolean; pickup_enabled: boolean; delivery_enabled: boolean; deposit_amount: number
  rental_requirements: string[]; pickup_instructions_ar: string; pickup_instructions_en: string
  is_active: boolean; is_featured: boolean; sort_order: number; category_id: string | null
  seo_title?: string; seo_description_ar?: string; seo_description_en?: string
}

const REQUIREMENT_OPTIONS = ['id_required', 'license_required', 'deposit_required']

function emptyProduct(type: 'sale' | 'rental'): ProductFull {
  return {
    id: '', product_type: type, slug: '', name_ar: '', name_en: '', description_ar: '', description_en: '',
    images: [], base_price: 0, compare_at_price: null, badge_text: '', sku: '', track_inventory: true,
    requires_delivery: true, pickup_enabled: true, delivery_enabled: true, deposit_amount: 0,
    rental_requirements: [], pickup_instructions_ar: '', pickup_instructions_en: '', is_active: true,
    is_featured: false, sort_order: 0, category_id: null, seo_title: '', seo_description_ar: '', seo_description_en: '',
  }
}

export function ProductEditor({ api, productId, categories, collections, onClose, onSaved }: {
  api: AdminFetch
  productId: string | null
  categories: CategoryLite[]
  collections: CollectionLite[]
  onClose: () => void
  onSaved: () => void
}) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [product, setProduct] = useState<ProductFull>(emptyProduct('sale'))
  const [options, setOptions] = useState<ProductOption[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [tiers, setTiers] = useState<RentalTier[]>([])
  const [collectionIds, setCollectionIds] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(productId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const isNew = !productId && !product.id

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const data = await api(`/api/admin/commerce/products/${productId}`)
      setProduct(data.product as ProductFull)
      setOptions((data.options as ProductOption[]) || [])
      setVariants((data.variants as Variant[]) || [])
      setTiers((data.rentalTiers as RentalTier[]) || [])
      setCollectionIds((data.collectionIds as string[]) || [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, productId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const set = <K extends keyof ProductFull>(key: K, value: ProductFull[K]) => setProduct((p) => ({ ...p, [key]: value }))

  const saveBasics = async () => {
    if (!product.slug || !product.name_ar || !product.name_en) {
      setError(ar ? 'المعرف والاسم بالعربي والإنجليزي مطلوبين' : 'Slug, Arabic name, and English name are required')
      return null
    }
    setSaving(true)
    setError('')
    try {
      const payload = { ...product }
      if (product.id) {
        const data = await api(`/api/admin/commerce/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        return data.product as ProductFull
      }
      const data = await api('/api/admin/commerce/products', { method: 'POST', body: JSON.stringify(payload) })
      const created = data.product as ProductFull
      setProduct(created)
      return created
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveAndStay = async () => { const saved = await saveBasics(); if (saved) onSaved() }
  const saveAndClose = async () => { const saved = await saveBasics(); if (saved) { onSaved(); onClose() } }

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'commerce')
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      set('images', [...product.images, data.url])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const toggleCollection = async (collectionId: string) => {
    if (!product.id) return
    const next = collectionIds.includes(collectionId) ? collectionIds.filter((c) => c !== collectionId) : [...collectionIds, collectionId]
    setCollectionIds(next)
    await api(`/api/admin/commerce/products/${product.id}/collections`, { method: 'PUT', body: JSON.stringify({ collection_ids: next }) })
  }

  // ── Options ──
  const [newOption, setNewOption] = useState({ name_ar: '', name_en: '', valuesText: '' })
  const addOption = async () => {
    if (!product.id || !newOption.name_ar || !newOption.name_en || !newOption.valuesText.trim()) return
    const pairs = newOption.valuesText.split(',').map((v) => v.trim()).filter(Boolean)
    const values = pairs.map((v) => ({ value_ar: v, value_en: v }))
    try {
      const data = await api(`/api/admin/commerce/products/${product.id}/options`, {
        method: 'POST',
        body: JSON.stringify({ name_ar: newOption.name_ar, name_en: newOption.name_en, values }),
      })
      setOptions((prev) => [...prev, data.option as ProductOption])
      setNewOption({ name_ar: '', name_en: '', valuesText: '' })
    } catch (e) { setError((e as Error).message) }
  }

  // ── Variants ──
  const generateVariants = async () => {
    if (!product.id || options.length === 0) return
    const combos: string[][] = options.reduce<string[][]>((acc, opt) => {
      const ids = opt.commerce_product_option_values.map((v) => v.id)
      if (acc.length === 0) return ids.map((id) => [id])
      const next: string[][] = []
      for (const combo of acc) for (const id of ids) next.push([...combo, id])
      return next
    }, [])
    const existingKeys = new Set(variants.map((v) => [...v.option_value_ids].sort().join('|')))
    for (const combo of combos) {
      const key = [...combo].sort().join('|')
      if (existingKeys.has(key)) continue
      try {
        const data = await api(`/api/admin/commerce/products/${product.id}/variants`, {
          method: 'POST',
          body: JSON.stringify({ option_value_ids: combo, inventory_quantity: 0, is_active: true }),
        })
        setVariants((prev) => [...prev, data.variant as Variant])
      } catch { /* skip duplicates */ }
    }
  }

  const addSimpleVariant = async () => {
    if (!product.id) return
    try {
      const data = await api(`/api/admin/commerce/products/${product.id}/variants`, {
        method: 'POST',
        body: JSON.stringify({ option_value_ids: [], inventory_quantity: 0, is_active: true }),
      })
      setVariants((prev) => [...prev, data.variant as Variant])
    } catch (e) { setError((e as Error).message) }
  }

  const updateVariant = async (id: string, patch: Partial<Variant>) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    await api(`/api/admin/commerce/variants/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  }
  const removeVariant = async (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id))
    await api(`/api/admin/commerce/variants/${id}`, { method: 'DELETE' })
  }

  const valueLabel = (valueId: string) => {
    for (const opt of options) {
      const v = opt.commerce_product_option_values.find((x) => x.id === valueId)
      if (v) return ar ? v.value_ar : v.value_en
    }
    return valueId
  }

  // ── Rental tiers ──
  const [newTier, setNewTier] = useState({ variant_id: '', duration_days: 1, label_ar: '', label_en: '', price: 0 })
  const addTier = async () => {
    if (!product.id || !newTier.duration_days || newTier.price < 0) return
    try {
      const data = await api(`/api/admin/commerce/products/${product.id}/rental-tiers`, {
        method: 'POST',
        body: JSON.stringify({
          variant_id: newTier.variant_id || null,
          duration_days: newTier.duration_days,
          label_ar: newTier.label_ar,
          label_en: newTier.label_en,
          price: newTier.price,
        }),
      })
      setTiers((prev) => [...prev, data.tier as RentalTier])
      setNewTier({ variant_id: '', duration_days: 1, label_ar: '', label_en: '', price: 0 })
    } catch (e) { setError((e as Error).message) }
  }
  const removeTier = async (id: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== id))
    await api(`/api/admin/commerce/rental-tiers/${id}`, { method: 'DELETE' })
  }

  if (loading) return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose}><ChevronLeft className="h-4 w-4 mr-1" />{ar ? 'رجوع للقائمة' : 'Back to list'}</Button>
        {!isNew && (
          <Badge className={product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
            {product.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'غير نشط' : 'Inactive')}
          </Badge>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Basics */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-sm font-semibold">{ar ? 'النوع' : 'Type'}</Label>
            <div className="flex gap-2">
              {(['sale', 'rental'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={!isNew}
                  onClick={() => set('product_type', t)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium ${product.product_type === t ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300 text-gray-600'} disabled:opacity-60`}
                >
                  {t === 'sale' ? (ar ? 'بيع' : 'Sale') : (ar ? 'إيجار' : 'Rental')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">{ar ? 'المعرف (slug)' : 'Slug'}</Label><Input value={product.slug} onChange={(e) => set('slug', e.target.value)} dir="ltr" /></div>
            <div><Label className="text-xs">SKU</Label><Input value={product.sku || ''} onChange={(e) => set('sku', e.target.value)} dir="ltr" /></div>
            <div><Label className="text-xs">{ar ? 'الاسم (عربي)' : 'Name (AR)'}</Label><Input value={product.name_ar} onChange={(e) => set('name_ar', e.target.value)} dir="rtl" /></div>
            <div><Label className="text-xs">{ar ? 'الاسم (إنجليزي)' : 'Name (EN)'}</Label><Input value={product.name_en} onChange={(e) => set('name_en', e.target.value)} /></div>
            <div>
              <Label className="text-xs">{ar ? 'التصنيف' : 'Category'}</Label>
              <Select value={product.category_id || 'none'} onValueChange={(v) => set('category_id', !v || v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{ar ? 'بدون' : 'None'}</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{ar ? c.name_ar : c.name_en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{ar ? 'شارة (اختياري)' : 'Badge (optional)'}</Label><Input value={product.badge_text} onChange={(e) => set('badge_text', e.target.value)} placeholder={ar ? 'مثال: جديد' : 'e.g. New'} /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">{ar ? 'الوصف (عربي)' : 'Description (AR)'}</Label><textarea value={product.description_ar} onChange={(e) => set('description_ar', e.target.value)} dir="rtl" rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            <div><Label className="text-xs">{ar ? 'الوصف (إنجليزي)' : 'Description (EN)'}</Label><textarea value={product.description_en} onChange={(e) => set('description_en', e.target.value)} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div><Label className="text-xs">{ar ? 'السعر الأساسي' : 'Base price'}</Label><Input type="number" value={product.base_price} onChange={(e) => set('base_price', Number(e.target.value))} /></div>
            {product.product_type === 'sale' && (
              <div><Label className="text-xs">{ar ? 'السعر قبل الخصم' : 'Compare-at price'}</Label><Input type="number" value={product.compare_at_price ?? ''} onChange={(e) => set('compare_at_price', e.target.value ? Number(e.target.value) : null)} /></div>
            )}
            <div><Label className="text-xs">{ar ? 'الترتيب' : 'Sort order'}</Label><Input type="number" value={product.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} /></div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2"><Switch checked={product.is_active} onCheckedChange={(v) => set('is_active', v)} /><Label className="text-sm">{ar ? 'نشط' : 'Active'}</Label></div>
            <div className="flex items-center gap-2"><Switch checked={product.is_featured} onCheckedChange={(v) => set('is_featured', v)} /><Label className="text-sm">{ar ? 'مميز' : 'Featured'}</Label></div>
            {product.product_type === 'sale' && (
              <div className="flex items-center gap-2"><Switch checked={product.track_inventory} onCheckedChange={(v) => set('track_inventory', v)} /><Label className="text-sm">{ar ? 'تتبع المخزون' : 'Track inventory'}</Label></div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">{ar ? 'الصور' : 'Images'}</Label>
          <div className="flex flex-wrap gap-3">
            {product.images.map((img, i) => (
              <div key={img + i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-white">{ar ? 'أساسية' : 'Primary'}</span>}
                <button type="button" onClick={() => set('images', product.images.filter((_, idx) => idx !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-brand-blue hover:text-brand-blue">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="text-[10px]">{ar ? 'رفع' : 'Upload'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Rental-only settings */}
      {product.product_type === 'rental' && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <Label className="text-sm font-semibold">{ar ? 'إعدادات الإيجار' : 'Rental settings'}</Label>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2"><Switch checked={product.pickup_enabled} onCheckedChange={(v) => set('pickup_enabled', v)} /><Label className="text-sm">{ar ? 'الاستلام من المكان' : 'Pickup'}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={product.delivery_enabled} onCheckedChange={(v) => set('delivery_enabled', v)} /><Label className="text-sm">{ar ? 'التوصيل' : 'Delivery'}</Label></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">{ar ? 'تأمين قابل للاسترداد' : 'Refundable deposit'}</Label><Input type="number" value={product.deposit_amount} onChange={(e) => set('deposit_amount', Number(e.target.value))} /></div>
              <div>
                <Label className="text-xs">{ar ? 'المتطلبات' : 'Requirements'}</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {REQUIREMENT_OPTIONS.map((req) => (
                    <button
                      key={req}
                      type="button"
                      onClick={() => set('rental_requirements', product.rental_requirements.includes(req) ? product.rental_requirements.filter((r) => r !== req) : [...product.rental_requirements, req])}
                      className={`h-8 rounded-md border px-2.5 text-xs font-medium ${product.rental_requirements.includes(req) ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-300 text-gray-500'}`}
                    >
                      {req.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">{ar ? 'تعليمات الاستلام (عربي)' : 'Pickup instructions (AR)'}</Label><textarea value={product.pickup_instructions_ar} onChange={(e) => set('pickup_instructions_ar', e.target.value)} dir="rtl" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><Label className="text-xs">{ar ? 'تعليمات الاستلام (إنجليزي)' : 'Pickup instructions (EN)'}</Label><textarea value={product.pickup_instructions_en} onChange={(e) => set('pickup_instructions_en', e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {isNew && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {ar ? 'احفظ المنتج أولاً لإضافة خيارات، متغيرات، أو شرائح تسعير.' : 'Save the product first to add options, variants, or pricing tiers.'}
        </p>
      )}

      {/* Options + Variants (both product types) */}
      {!isNew && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <Label className="text-sm font-semibold">{ar ? 'الخيارات (مقاس، لون...)' : 'Options (Size, Color…)'}</Label>
            <div className="space-y-2">
              {options.map((opt) => (
                <div key={opt.id} className="rounded-md border border-gray-200 p-2 text-sm">
                  <span className="font-medium">{ar ? opt.name_ar : opt.name_en}:</span>{' '}
                  {opt.commerce_product_option_values.map((v) => ar ? v.value_ar : v.value_en).join(', ')}
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input placeholder={ar ? 'اسم الخيار (عربي)' : 'Option name (AR)'} value={newOption.name_ar} onChange={(e) => setNewOption((n) => ({ ...n, name_ar: e.target.value }))} />
              <Input placeholder={ar ? 'اسم الخيار (إنجليزي)' : 'Option name (EN)'} value={newOption.name_en} onChange={(e) => setNewOption((n) => ({ ...n, name_en: e.target.value }))} />
              <Input placeholder={ar ? 'القيم (بفاصلة): S,M,L' : 'Values (comma sep): S,M,L'} value={newOption.valuesText} onChange={(e) => setNewOption((n) => ({ ...n, valuesText: e.target.value }))} className="sm:col-span-1" />
              <Button variant="outline" onClick={addOption}><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة خيار' : 'Add option'}</Button>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <Label className="text-sm font-semibold">{ar ? 'المتغيرات' : 'Variants'}</Label>
              <div className="flex gap-2">
                {options.length > 0 && <Button size="sm" variant="outline" onClick={generateVariants}><Wand2 className="h-3.5 w-3.5 mr-1" />{ar ? 'توليد المتغيرات' : 'Generate variants'}</Button>}
                {options.length === 0 && variants.length === 0 && <Button size="sm" variant="outline" onClick={addSimpleVariant}><Plus className="h-3.5 w-3.5 mr-1" />{ar ? 'إضافة نسخة واحدة' : 'Add single variant'}</Button>}
              </div>
            </div>
            <div className="space-y-2">
              {variants.map((v) => (
                <div key={v.id} className="grid grid-cols-2 items-center gap-2 rounded-md border border-gray-200 p-2 sm:grid-cols-6">
                  <span className="col-span-2 text-xs font-medium text-gray-600 sm:col-span-2">
                    {v.option_value_ids.length ? v.option_value_ids.map(valueLabel).join(' / ') : (ar ? 'افتراضي' : 'Default')}
                  </span>
                  <Input type="number" placeholder={ar ? 'سعر مخصص' : 'Price override'} value={v.price_override ?? ''} onChange={(e) => updateVariant(v.id, { price_override: e.target.value ? Number(e.target.value) : null })} className="h-8 text-xs" />
                  <Input type="number" placeholder={ar ? 'المخزون' : 'Stock'} value={v.inventory_quantity} onChange={(e) => updateVariant(v.id, { inventory_quantity: Number(e.target.value) })} className="h-8 text-xs" />
                  <div className="flex items-center gap-1.5">
                    <Switch checked={v.is_active} onCheckedChange={(active) => updateVariant(v.id, { is_active: active })} />
                    <span className="text-[11px] text-gray-500">{v.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Off')}</span>
                  </div>
                  <button type="button" onClick={() => removeVariant(v.id)} className="justify-self-end text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {variants.length === 0 && <p className="text-xs text-gray-400">{ar ? 'لا توجد متغيرات بعد' : 'No variants yet'}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rental pricing tiers */}
      {!isNew && product.product_type === 'rental' && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">{ar ? 'شرائح تسعير الإيجار' : 'Rental pricing tiers'}</Label>
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-gray-200 p-2 text-sm">
                  <span>
                    {t.variant_id ? valueLabel(t.variant_id) + ' — ' : ''}
                    {ar ? (t.label_ar || `${t.duration_days} يوم`) : (t.label_en || `${t.duration_days}d`)} = {t.price} {ar ? 'ج.م' : 'EGP'}
                  </span>
                  <button type="button" onClick={() => removeTier(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {tiers.length === 0 && <p className="text-xs text-gray-400">{ar ? 'لا توجد شرائح بعد' : 'No tiers yet'}</p>}
            </div>
            <div className="grid gap-2 sm:grid-cols-6">
              {variants.length > 0 && (
                <Select value={newTier.variant_id || 'product'} onValueChange={(v) => setNewTier((n) => ({ ...n, variant_id: v && v !== 'product' ? v : '' }))}>
                  <SelectTrigger className="sm:col-span-2"><SelectValue placeholder={ar ? 'كل المنتج' : 'Whole product'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{ar ? 'كل المنتج' : 'Whole product'}</SelectItem>
                    {variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.option_value_ids.map(valueLabel).join(' / ') || v.id.slice(0, 6)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input type="number" placeholder={ar ? 'الأيام' : 'Days'} value={newTier.duration_days} onChange={(e) => setNewTier((n) => ({ ...n, duration_days: Number(e.target.value) }))} />
              <Input placeholder={ar ? 'تسمية (عربي)' : 'Label (AR)'} value={newTier.label_ar} onChange={(e) => setNewTier((n) => ({ ...n, label_ar: e.target.value }))} />
              <Input placeholder={ar ? 'تسمية (إنجليزي)' : 'Label (EN)'} value={newTier.label_en} onChange={(e) => setNewTier((n) => ({ ...n, label_en: e.target.value }))} />
              <Input type="number" placeholder={ar ? 'السعر' : 'Price'} value={newTier.price} onChange={(e) => setNewTier((n) => ({ ...n, price: Number(e.target.value) }))} />
              <Button variant="outline" onClick={addTier}><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة' : 'Add'}</Button>
            </div>
            {options.length > 0 && !newTier.variant_id && (
              <p className="text-xs text-amber-600">
                {ar
                  ? 'المنتج ده عنده خيارات — "كل المنتج" مش هيظهر للعميل. لازم تضيف شريحة لكل متغير على حدة.'
                  : 'This product has options — a "Whole product" tier will not show to customers. Add a tier for each variant instead.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Collections */}
      {!isNew && collections.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">{ar ? 'المجموعات' : 'Collections'}</Label>
            <div className="flex flex-wrap gap-2">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCollection(c.id)}
                  className={`h-8 rounded-full border px-3 text-xs font-medium ${collectionIds.includes(c.id) ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300 text-gray-500'}`}
                >
                  {ar ? c.name_ar : c.name_en}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button>
        {!isNew && <Button variant="outline" onClick={saveAndStay} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{ar ? 'حفظ' : 'Save'}</Button>}
        <Button onClick={saveAndClose} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark text-white">
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{isNew ? (ar ? 'إنشاء المنتج' : 'Create product') : (ar ? 'حفظ وإغلاق' : 'Save & close')}
        </Button>
      </div>
    </div>
  )
}
