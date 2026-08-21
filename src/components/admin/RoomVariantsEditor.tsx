'use client'

/**
 * RoomUpgradesEditor — manages optional room upgrade tiers per accommodation.
 * e.g. Sea View +1000, Deluxe +500.
 *
 * The upgrade extra_price_per_night is a fixed supplement added on top of the
 * base single/double/triple room price — NOT an independent room price.
 *
 * Migration-safe: shows a "migration required" notice if the DB table does not
 * exist yet. DO NOT apply Migration 011 without explicit approval.
 *
 * NOTE: This file is intentionally kept at the RoomVariantsEditor path so the
 * existing AccommodationManager import continues to work. The export is named
 * RoomUpgradesEditor; AccommodationManager imports it by that name.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Pencil, Plus, X, AlertTriangle, ArrowUp } from 'lucide-react'

interface RoomUpgrade {
  id: string
  accommodation_id: string
  name_ar: string
  name_en: string
  extra_price_per_night: number
  sort_order: number
  is_active: boolean
  created_at: string
}

interface Draft {
  id?: string
  name_ar: string
  name_en: string
  extra_price_per_night: number
  sort_order: number
  is_active: boolean
}

const emptyDraft = (): Draft => ({
  name_ar: '',
  name_en: '',
  extra_price_per_night: 0,
  sort_order: 0,
  is_active: true,
})

export function RoomUpgradesEditor({ accommodationId, locale }: {
  accommodationId: string
  locale: string
}) {
  const ar = locale === 'ar'
  const [upgrades, setUpgrades] = useState<RoomUpgrade[]>([])
  // loading starts true — first fetch is already in-flight when the component mounts
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [migrationPending, setMigrationPending] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Called from event handlers (not effects) — safe to set state here
  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    // No synchronous setState here — loading/error were already set by the
    // caller (refresh or initial mount via useState defaults).
    let cancelled = false
    async function run() {
      try {
        const res = await fetch(`/api/admin/room-upgrades?accommodation_id=${accommodationId}`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data.migrationPending) { setMigrationPending(true); return }
        if (res.ok) {
          setUpgrades(data.upgrades || [])
          setError('')
        } else {
          setError(data.error || (ar ? 'تعذر التحميل' : 'Failed to load'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [accommodationId, ar, refreshKey])

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
      const url = isEdit ? `/api/admin/room-upgrades/${draft.id}` : '/api/admin/room-upgrades'
      const payload = isEdit ? { ...draft } : { ...draft, accommodation_id: accommodationId }
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (data.migrationPending) { setMigrationPending(true); return }
      if (!res.ok) { setError(data.error || (ar ? 'فشل الحفظ' : 'Save failed')); return }
      refresh()
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (upgrade: RoomUpgrade) => {
    const res = await fetch(`/api/admin/room-upgrades/${upgrade.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !upgrade.is_active }),
    })
    if (res.ok) setUpgrades(prev => prev.map(u => u.id === upgrade.id ? { ...u, is_active: !u.is_active } : u))
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || (ar ? 'فشل التحديث' : 'Update failed'))
    }
  }

  const updateDraft = (field: keyof Draft, value: string | number | boolean) =>
    setDraft(prev => prev ? { ...prev, [field]: value } : prev)

  if (migrationPending) {
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              {ar ? 'تطبيق Migration 011 مطلوب' : 'Migration 011 Required'}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {ar
                ? 'جدول ترقيات الغرف غير موجود بعد. يرجى تطبيق Migration 011 أولاً.'
                : 'The room upgrades table does not exist yet. Apply Migration 011 first.'}
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
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ArrowUp className="h-4 w-4" />
            {ar ? 'ترقيات الغرف (اختياري)' : 'Room Upgrades (optional)'}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {ar
              ? 'مثال: سي فيو +١٠٠٠ ج.م، ديلوكس +٥٠٠ ج.م. المبلغ يُضاف على سعر الغرفة الأساسي (سينجل/دبل/تريبل) لكل غرفة لكل ليلة.'
              : 'e.g. Sea View +1000, Deluxe +500. Extra is added per room per night on top of the base single/double/triple rate.'}
          </p>
        </div>
        {!draft && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { setDraft(emptyDraft()); setError('') }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {ar ? 'إضافة ترقية' : 'Add upgrade'}
          </Button>
        )}
      </div>

      {loading && (
        <div className="py-4 text-center text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
          {ar ? 'جاري التحميل...' : 'Loading...'}
        </div>
      )}

      {!loading && upgrades.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {upgrades.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 bg-white px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    {ar ? u.name_ar : u.name_en}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {ar ? u.name_en : u.name_ar}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-sea-700">
                  {u.extra_price_per_night === 0
                    ? (ar ? 'بدون إضافة' : '+0')
                    : `+${Number(u.extra_price_per_night).toLocaleString()} ${ar ? 'ج.م' : 'EGP'}`}
                </span>
                <Badge
                  className={u.is_active
                    ? 'cursor-pointer bg-green-100 text-green-700 text-xs hover:bg-green-200'
                    : 'cursor-pointer bg-gray-100 text-gray-500 text-xs hover:bg-gray-200'}
                  onClick={() => handleToggleActive(u)}
                >
                  {u.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Off')}
                </Badge>
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => { setDraft({ ...u }); setError('') }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && upgrades.length === 0 && !draft && (
        <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
          {ar
            ? 'لا توجد ترقيات. الفندق يستخدم الأسعار الأساسية فقط.'
            : 'No upgrades. Hotel uses base room pricing only.'}
        </div>
      )}

      {/* Inline add/edit form */}
      {draft && (
        <div className="rounded-lg border border-sea-200 bg-sea-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {draft.id ? (ar ? 'تعديل الترقية' : 'Edit upgrade') : (ar ? 'ترقية جديدة' : 'New upgrade')}
            </p>
            <button type="button" onClick={() => { setDraft(null); setError('') }}>
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">{ar ? 'الاسم (عربي)' : 'Name (AR)'}</Label>
              <Input
                value={draft.name_ar}
                onChange={e => updateDraft('name_ar', e.target.value)}
                className="mt-1 h-8 text-xs"
                placeholder={ar ? 'مثال: سي فيو' : 'e.g. سي فيو'}
                dir="rtl"
              />
            </div>
            <div>
              <Label className="text-xs">{ar ? 'الاسم (إنجليزي)' : 'Name (EN)'}</Label>
              <Input
                value={draft.name_en}
                onChange={e => updateDraft('name_en', e.target.value)}
                className="mt-1 h-8 text-xs"
                placeholder="e.g. Sea View"
              />
            </div>
            <div>
              <Label className="text-xs">{ar ? 'إضافة/ليلة/غرفة (ج.م)' : 'Extra/night/room (EGP)'}</Label>
              <Input
                type="number"
                min={0}
                step={50}
                value={draft.extra_price_per_night}
                onChange={e => updateDraft('extra_price_per_night', parseFloat(e.target.value) || 0)}
                className="mt-1 h-8 text-xs"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">{ar ? 'الترتيب' : 'Sort order'}</Label>
              <Input
                type="number"
                min={0}
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
            <span className="text-xs text-gray-700">{ar ? 'نشط (يظهر في نموذج الحجز)' : 'Active (shown in booking form)'}</span>
          </label>

          {draft.extra_price_per_night === 0 && (
            <p className="text-[11px] text-gray-400">
              {ar
                ? '٠ ج.م = خيار "ستاندرد / بدون ترقية". مفيد لو عايز تعطي العميل خيار اسمي.'
                : '0 EGP = "Standard / No upgrade" named option. Useful for explicit labeling.'}
            </p>
          )}

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

// Keep backward compat alias so AccommodationManager import doesn't break
export { RoomUpgradesEditor as RoomVariantsEditor }
