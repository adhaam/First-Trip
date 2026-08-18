'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Bus, Truck, Plus, Trash2, X, Loader2, Save, Info } from 'lucide-react'
import type { TransferGovernoratePrice, TransferSettings, TransferType } from '@/lib/types'

const TYPES: { type: TransferType; icon: typeof Bus }[] = [
  { type: 'package_bus', icon: Bus },
  { type: 'hiace', icon: Truck },
]

interface NewGovForm {
  transfer_type: TransferType
  governorate_code: string
  name_ar: string
  name_en: string
  price_surcharge: string
}

const emptyGov = (type: TransferType): NewGovForm => ({
  transfer_type: type,
  governorate_code: '',
  name_ar: '',
  name_en: '',
  price_surcharge: '0',
})

export function TransferPricingManager() {
  const locale = useLocale()
  const ar = locale === 'ar'

  const [settings, setSettings] = useState<TransferSettings[]>([])
  const [governorates, setGovernorates] = useState<TransferGovernoratePrice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [showForm, setShowForm] = useState<NewGovForm | null>(null)

  // local draft values so typing doesn't fire a request per keystroke
  const [baseDraft, setBaseDraft] = useState<Record<string, string>>({})
  const [surchargeDraft, setSurchargeDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/transfer-pricing')
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSettings(data.settings || [])
      setGovernorates(data.governorates || [])
      setBaseDraft(
        Object.fromEntries(
          (data.settings || []).map((s: TransferSettings) => [s.transfer_type, String(s.base_price)]),
        ),
      )
      setSurchargeDraft(
        Object.fromEntries(
          (data.governorates || []).map((g: TransferGovernoratePrice) => [g.id, String(g.price_surcharge)]),
        ),
      )
    } catch {
      setLoadError(ar ? 'تعذر تحميل أسعار النقل' : 'Failed to load transfer pricing')
    } finally {
      setLoading(false)
    }
  }, [locale, ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const label = (s: TransferSettings) => (ar ? s.name_ar : s.name_en)
  const vehicle = (s: TransferSettings) => (ar ? s.vehicle_ar : s.vehicle_en)

  // ─── base price ───
  const saveBase = async (type: TransferType) => {
    const value = Number(baseDraft[type])
    if (!Number.isFinite(value) || value < 0) return
    setSavingKey(type)
    try {
      const res = await fetch('/api/admin/transfer-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_type: type, base_price: value }),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (ar ? 'فشل الحفظ' : 'Save failed')); return }
      setSettings(prev => prev.map(s => (s.transfer_type === type ? { ...s, base_price: value } : s)))
    } finally {
      setSavingKey(null)
    }
  }

  // ─── surcharge ───
  const saveSurcharge = async (gov: TransferGovernoratePrice) => {
    const value = Number(surchargeDraft[gov.id])
    if (!Number.isFinite(value) || value < 0) return
    setSavingKey(gov.id)
    try {
      const res = await fetch(`/api/admin/transfer-pricing/governorates/${gov.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_surcharge: value }),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || (ar ? 'فشل الحفظ' : 'Save failed'))
        setSurchargeDraft(prev => ({ ...prev, [gov.id]: String(gov.price_surcharge) }))
        return
      }
      setGovernorates(prev =>
        prev.map(g => (g.id === gov.id ? { ...g, price_surcharge: value } : g)),
      )
    } finally {
      setSavingKey(null)
    }
  }

  const toggleActive = async (gov: TransferGovernoratePrice) => {
    const res = await fetch(`/api/admin/transfer-pricing/governorates/${gov.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !gov.is_active }),
    })
    if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || (ar ? 'فشل التحديث' : 'Update failed'))
      return
    }
    setGovernorates(prev =>
      prev.map(g => (g.id === gov.id ? { ...g, is_active: !g.is_active } : g)),
    )
  }

  const remove = async (gov: TransferGovernoratePrice) => {
    if (!confirm(ar ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/transfer-pricing/governorates/${gov.id}`, { method: 'DELETE' })
    if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || (ar ? 'فشل الحذف' : 'Delete failed'))
      return
    }
    setGovernorates(prev => prev.filter(g => g.id !== gov.id))
  }

  const createGov = async () => {
    if (!showForm) return
    const payload = {
      transfer_type: showForm.transfer_type,
      governorate_code: showForm.governorate_code.trim().toLowerCase(),
      name_ar: showForm.name_ar.trim(),
      name_en: showForm.name_en.trim(),
      price_surcharge: Number(showForm.price_surcharge) || 0,
      sort_order: governorates.filter(g => g.transfer_type === showForm.transfer_type).length,
    }
    if (!payload.governorate_code || !payload.name_ar || !payload.name_en) return

    setSavingKey('new')
    try {
      const res = await fetch('/api/admin/transfer-pricing/governorates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (ar ? 'فشل الإضافة' : 'Create failed')); return }
      await load()
      setShowForm(null)
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {ar ? 'جاري التحميل...' : 'Loading...'}
      </div>
    )
  }

  if (loadError) {
    return <div className="py-20 text-center text-red-500">{loadError}</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {ar ? 'أسعار النقل' : 'Transfer Pricing'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {ar
            ? 'الأسعار دي هي المصدر الوحيد لأسعار الانتقالات في الموقع كله — مفيش أي رقم مكتوب في الكود.'
            : 'These values are the single source of truth for every transfer price on the site — nothing is hardcoded.'}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">
            {ar ? 'إزاي بيتحسب السعر؟' : 'How the price is calculated'}
          </p>
          <p className="leading-relaxed">
            {ar
              ? 'سعر الفرد للرحلة الواحدة = سعر القاهرة الأساسي + زيادة المحافظة. لو العميل اختار ذهاب وعودة، الرقم ده بيتضرب في 2.'
              : 'Per person, one direction = Cairo base price + governorate surcharge. If the customer picks a round trip, that number is doubled.'}
          </p>
        </div>
      </div>

      {TYPES.map(({ type, icon: Icon }) => {
        const setting = settings.find(s => s.transfer_type === type)
        if (!setting) return null
        const rows = governorates
          .filter(g => g.transfer_type === type)
          .sort((a, b) => a.sort_order - b.sort_order)
        const base = Number(setting.base_price)
        const baseDirty = baseDraft[type] !== String(setting.base_price)

        return (
          <Card key={type} className="overflow-hidden">
            <CardContent className="space-y-6 p-6">
              {/* header */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{label(setting)}</h3>
                    <p className="text-sm text-gray-500">
                      {vehicle(setting)}
                      {' · '}
                      {type === 'package_bus'
                        ? (ar ? 'ذهاب: أحد أو خميس — عودة: اثنين أو جمعة' : 'Out: Sun/Thu — Back: Mon/Fri')
                        : (ar ? 'متاح كل يوم' : 'Available any day')}
                    </p>
                  </div>
                </div>

                {/* base price */}
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="text-xs text-gray-500">
                      {ar ? 'سعر القاهرة (فرد / رحلة واحدة)' : 'Cairo base (per person, one way)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="mt-1 w-40"
                      value={baseDraft[type] ?? ''}
                      onChange={e => setBaseDraft(prev => ({ ...prev, [type]: e.target.value }))}
                    />
                  </div>
                  <Button
                    onClick={() => saveBase(type)}
                    disabled={!baseDirty || savingKey === type}
                    className="bg-brand-blue hover:bg-brand-blue-dark"
                  >
                    {savingKey === type
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* governorate table */}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{ar ? 'المحافظة' : 'Governorate'}</TableHead>
                      <TableHead className="w-40">{ar ? 'الزيادة' : 'Surcharge'}</TableHead>
                      <TableHead>{ar ? 'رحلة واحدة' : 'One way'}</TableHead>
                      <TableHead>{ar ? 'ذهاب وعودة' : 'Round trip'}</TableHead>
                      <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-right">{ar ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(gov => {
                      const isCairo = gov.governorate_code === 'cairo'
                      const surcharge = Number(surchargeDraft[gov.id] ?? gov.price_surcharge) || 0
                      const oneWay = base + Number(gov.price_surcharge)
                      const dirty = surchargeDraft[gov.id] !== String(gov.price_surcharge)

                      return (
                        <TableRow key={gov.id} className={gov.is_active ? '' : 'opacity-50'}>
                          <TableCell>
                            <div className="font-medium text-gray-900">
                              {ar ? gov.name_ar : gov.name_en}
                            </div>
                            <div className="font-mono text-xs text-gray-400">
                              {gov.governorate_code}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isCairo ? (
                              <span className="text-sm text-gray-400">
                                {ar ? '— الأساس' : '— base'}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  className="w-24"
                                  value={surchargeDraft[gov.id] ?? ''}
                                  onChange={e =>
                                    setSurchargeDraft(prev => ({ ...prev, [gov.id]: e.target.value }))
                                  }
                                />
                                {dirty && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => saveSurcharge(gov)}
                                    disabled={savingKey === gov.id}
                                    className="text-brand-blue"
                                  >
                                    {savingKey === gov.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Save className="h-4 w-4" />}
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-gray-900">
                            {(base + (isCairo ? 0 : surcharge)).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-semibold text-brand-orange">
                            {(oneWay * 2).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleActive(gov)}>
                              <Badge
                                variant={gov.is_active ? 'default' : 'outline'}
                                className={gov.is_active
                                  ? 'cursor-pointer bg-green-100 text-green-700'
                                  : 'cursor-pointer'}
                              >
                                {gov.is_active ? (ar ? 'متاح' : 'Active') : (ar ? 'مخفي' : 'Hidden')}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            {!isCairo && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(gov)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-gray-400">
                          {ar ? 'مفيش محافظات لسه' : 'No governorates yet'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Button variant="outline" onClick={() => setShowForm(emptyGov(type))}>
                <Plus className="mr-2 h-4 w-4" />
                {ar ? 'إضافة محافظة' : 'Add governorate'}
              </Button>
            </CardContent>
          </Card>
        )
      })}

      {/* add governorate modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <Card className="my-8 w-full max-w-md">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {ar ? 'إضافة محافظة' : 'Add governorate'}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div>
                <Label>{ar ? 'الكود (إنجليزي بدون مسافات)' : 'Code (lowercase, no spaces)'}</Label>
                <Input
                  dir="ltr"
                  placeholder="tanta"
                  className="mt-1"
                  value={showForm.governorate_code}
                  onChange={e => setShowForm({ ...showForm, governorate_code: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{ar ? 'الاسم بالعربي' : 'Arabic name'}</Label>
                  <Input
                    className="mt-1"
                    value={showForm.name_ar}
                    onChange={e => setShowForm({ ...showForm, name_ar: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{ar ? 'الاسم بالإنجليزي' : 'English name'}</Label>
                  <Input
                    dir="ltr"
                    className="mt-1"
                    value={showForm.name_en}
                    onChange={e => setShowForm({ ...showForm, name_en: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{ar ? 'الزيادة فوق سعر القاهرة' : 'Surcharge above Cairo'}</Label>
                <Input
                  type="number"
                  min="0"
                  className="mt-1"
                  value={showForm.price_surcharge}
                  onChange={e => setShowForm({ ...showForm, price_surcharge: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 border-t pt-2">
                <Button variant="outline" onClick={() => setShowForm(null)}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={createGov}
                  disabled={savingKey === 'new'}
                  className="bg-brand-blue hover:bg-brand-blue-dark"
                >
                  {savingKey === 'new'
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Plus className="mr-2 h-4 w-4" />}
                  {ar ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
