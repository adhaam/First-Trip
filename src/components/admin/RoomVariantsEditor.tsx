'use client'

/**
 * RoomVariantsEditor — manages named room variants per accommodation.
 * e.g. Standard Double / Deluxe Double / Sea View Double at different prices.
 *
 * Migration-safe: shows a "migration required" notice if the DB table doesn't
 * exist yet. DO NOT apply Migration 011 without explicit approval.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BedDouble, Loader2, Pencil, Plus, Trash2, X, AlertTriangle } from 'lucide-react'

type RoomType = 'single' | 'double' | 'triple'

interface RoomVariant {
  id: string
  accommodation_id: string
  base_room_type: RoomType
  name_ar: string
  name_en: string
  occupancy: number
  price_per_night: number
  sort_order: number
  is_active: boolean
  created_at: string
}

interface Draft {
  id?: string
  base_room_type: RoomType
  name_ar: string
  name_en: string
  occupancy: number
  price_per_night: number
  sort_order: number
  is_active: boolean
}

const emptyDraft = (baseType: RoomType = 'double'): Draft => ({
  base_room_type: baseType,
  name_ar: '',
  name_en: '',
  occupancy: baseType === 'single' ? 1 : baseType === 'triple' ? 3 : 2,
  price_per_night: 0,
  sort_order: 0,
  is_active: true,
})

const OCCUPANCY_DEFAULTS: Record<RoomType, number> = { single: 1, double: 2, triple: 3 }

export function RoomVariantsEditor({ accommodationId, locale }: {
  accommodationId: string
  locale: string
}) {
  const ar = locale === 'ar'
  const [variants, setVariants] = useState<RoomVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [migrationPending, setMigrationPending] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/room-variants?accommodation_id=${accommodationId}`)
      const data = await res.json().catch(() => ({}))
      if (data.migrationPending) {
        setMigrationPending(true)
        return
      }
      if (res.ok) setVariants(data.variants || [])
      else setError(data.error || (ar ? 'تعذر التحميل' : 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [accommodationId, ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const handleSave = async () => {
    if (!draft) return
    if (!draft.name_ar.trim() || !draft.name_en.trim()) {
      setError(ar ? 'الاسم مطلوب بالعربي والإنجليزي' : 'Name required in both Arabic and English')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isEdit = !!draft.id
      const url = isEdit ? `/api/admin/room-variants/${draft.id}` : '/api/admin/room-variants'
      const payload = isEdit
        ? { ...draft }
        : { ...draft, accommodation_id: accommodationId }

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (data.migrationPending) { setMigrationPending(true); return }
      if (!res.ok) { setError(data.error || (ar ? 'فشل الحفظ' : 'Save failed')); return }
      await load()
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/room-variants/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || (ar ? 'فشل الحذف' : 'Delete failed'))
      return
    }
    setVariants(prev => prev.filter(v => v.id !== id))
  }

  const updateDraft = (field: keyof Draft, value: string | number | boolean) =>
    setDraft(prev => prev ? { ...prev, [field]: value } : prev)

  // ── Migration pending banner ─────────────────────────────────────────────
  if (migrationPending) {
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              {ar ? 'تطبيق Migration مطلوب' : 'Migration Required'}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {ar
                ? 'جدول room_variants غير موجود بعد. يرجى تطبيق Migration 011 أولاً.'
                : 'The room_variants table does not exist yet. Apply Migration 011 first.'}
            </p>
            <code className="mt-2 block rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
              supabase/migrations/011_room_variants_schema.sql
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <BedDouble className="h-4 w-4" />
          {ar ? 'أنواع الغرف المفصّلة (اختياري)' : 'Room Variants (optional)'}
        </h3>
        {!draft && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { setDraft(emptyDraft()); setError('') }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {ar ? 'إضافة نوع' : 'Add variant'}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        {ar
          ? 'اتركه فاضي لو الفندق ده عنده سعر واحد لكل نوع غرفة. أضف أنواع فقط لو عندك Standard / Deluxe / Sea View إلخ.'
          : 'Leave empty for hotels with a single price per room type. Add variants only for Standard / Deluxe / Sea View etc.'}
      </p>

      {loading && (
        <div className="py-4 text-center text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
          {ar ? 'جاري التحميل...' : 'Loading...'}
        </div>
      )}

      {!loading && variants.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{ar ? 'النوع الأساسي' : 'Base type'}</TableHead>
              <TableHead>{ar ? 'السعة' : 'Cap.'}</TableHead>
              <TableHead>{ar ? 'السعر/ليلة' : 'Price/night'}</TableHead>
              <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{ar ? v.name_ar : v.name_en}</TableCell>
                <TableCell className="capitalize">{v.base_room_type}</TableCell>
                <TableCell>{v.occupancy}</TableCell>
                <TableCell>{Number(v.price_per_night).toLocaleString()} ج.م</TableCell>
                <TableCell>
                  <Badge className={v.is_active ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-500 text-xs'}>
                    {v.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Off')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => setDraft({ ...v })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => handleDelete(v.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && variants.length === 0 && !draft && (
        <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
          {ar ? 'لا توجد أنواع مفصّلة. الفندق يستخدم الأسعار الأساسية.' : 'No variants. Hotel uses base room pricing.'}
        </div>
      )}

      {/* Inline form */}
      {draft && (
        <div className="rounded-lg border border-sea-200 bg-sea-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {draft.id ? (ar ? 'تعديل النوع' : 'Edit variant') : (ar ? 'نوع جديد' : 'New variant')}
            </p>
            <button type="button" onClick={() => { setDraft(null); setError('') }}>
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Base room type */}
            <div>
              <Label className="text-xs">{ar ? 'النوع الأساسي' : 'Base type'}</Label>
              <Select
                value={draft.base_room_type}
                onValueChange={v => {
                  const t = v as RoomType
                  updateDraft('base_room_type', t)
                  updateDraft('occupancy', OCCUPANCY_DEFAULTS[t])
                }}
              >
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{ar ? 'سينجل' : 'Single'}</SelectItem>
                  <SelectItem value="double">{ar ? 'دبل' : 'Double'}</SelectItem>
                  <SelectItem value="triple">{ar ? 'تريبل' : 'Triple'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name AR */}
            <div>
              <Label className="text-xs">{ar ? 'الاسم (عربي)' : 'Name (AR)'}</Label>
              <Input
                value={draft.name_ar}
                onChange={e => updateDraft('name_ar', e.target.value)}
                className="mt-1 h-8 text-xs"
                placeholder={ar ? 'مثال: دبل ستاندرد' : 'e.g. دبل ستاندرد'}
              />
            </div>

            {/* Name EN */}
            <div>
              <Label className="text-xs">{ar ? 'الاسم (إنجليزي)' : 'Name (EN)'}</Label>
              <Input
                value={draft.name_en}
                onChange={e => updateDraft('name_en', e.target.value)}
                className="mt-1 h-8 text-xs"
                placeholder="e.g. Standard Double"
              />
            </div>

            {/* Occupancy */}
            <div>
              <Label className="text-xs">{ar ? 'السعة (أشخاص)' : 'Occupancy'}</Label>
              <Input
                type="number" min={1} max={10}
                value={draft.occupancy}
                onChange={e => updateDraft('occupancy', parseInt(e.target.value) || 1)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Price */}
            <div>
              <Label className="text-xs">{ar ? 'السعر/ليلة (ج.م)' : 'Price/night (EGP)'}</Label>
              <Input
                type="number" min={0}
                value={draft.price_per_night}
                onChange={e => updateDraft('price_per_night', parseFloat(e.target.value) || 0)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Sort order */}
            <div>
              <Label className="text-xs">{ar ? 'الترتيب' : 'Sort order'}</Label>
              <Input
                type="number" min={0}
                value={draft.sort_order}
                onChange={e => updateDraft('sort_order', parseInt(e.target.value) || 0)}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={e => updateDraft('is_active', e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs text-gray-700">{ar ? 'نشط (يظهر للعملاء)' : 'Active (visible to customers)'}</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => { setDraft(null); setError('') }}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-blue hover:bg-brand-blue-dark text-white"
            >
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {ar ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
