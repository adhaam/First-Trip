'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, ChevronUp, Trash2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'rent' | 'merch' | 'sinai_trips'

interface PromoCode {
  id: string
  code: string
  label: string
  discount_type: 'amount' | 'percentage'
  discount_value: number
  applies_to: Section[]
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
  created_at: string
}

const SECTIONS: { key: Section; label_ar: string; label_en: string }[] = [
  { key: 'rent', label_ar: 'الإيجار', label_en: 'Rent' },
  { key: 'merch', label_ar: 'المتجر', label_en: 'Merch' },
  { key: 'sinai_trips', label_ar: 'رحلات سيناء', label_en: 'Sinai Trips' },
]

const EMPTY_FORM = {
  code: '', label: '', discount_type: 'percentage' as 'amount' | 'percentage', discount_value: '',
  applies_to: [] as Section[], is_active: true, expires_at: '', max_uses: '',
}

export function PromoCodesManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/promo-codes')
      if (res.status === 401) { window.location.href = ar ? '/admin' : '/en/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCodes(data.promoCodes || [])
    } catch {
      setError(ar ? 'تعذر تحميل أكواد الخصم' : 'Failed to load promo codes')
    } finally {
      setLoading(false)
    }
  }, [ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const toggleSection = (s: Section) => {
    setForm((f) => ({
      ...f,
      applies_to: f.applies_to.includes(s) ? f.applies_to.filter((x) => x !== s) : [...f.applies_to, s],
    }))
  }

  const createCode = async () => {
    setFormError('')
    if (!form.code.trim()) { setFormError(ar ? 'أدخل الكود' : 'Enter a code'); return }
    if (!form.discount_value || Number(form.discount_value) <= 0) { setFormError(ar ? 'أدخل قيمة الخصم' : 'Enter a discount value'); return }
    if (form.applies_to.length === 0) { setFormError(ar ? 'اختر قسم واحد على الأقل' : 'Pick at least one section'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          label: form.label.trim(),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          applies_to: form.applies_to,
          is_active: form.is_active,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setCodes((prev) => [data.promoCode, ...prev])
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (c: PromoCode) => {
    setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)))
    await fetch(`/api/admin/promo-codes/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    })
  }

  const deleteCode = async (id: string) => {
    if (!confirm(ar ? 'متأكد من حذف هذا الكود؟' : 'Delete this promo code?')) return
    setCodes((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{ar ? 'أكواد الخصم' : 'Promo Codes'}</h2>
          <p className="text-sm text-gray-500">{ar ? 'أنشئ كود خصم واختر أي أقسام يُطبَّق عليها — الإيجار، المتجر، أو رحلات سيناء' : 'Create a discount code and choose which sections it applies to — rent, merch, or Sinai trips'}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="shrink-0 bg-brand-blue hover:bg-brand-blue-dark text-white">
          {showForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {ar ? 'إضافة كود' : 'Add promo code'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'الكود *' : 'Code *'}</Label>
                <Input
                  dir="ltr"
                  placeholder="SUMMER25"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="uppercase"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'وصف (اختياري)' : 'Label (optional)'}</Label>
                <Input
                  placeholder={ar ? 'عرض الصيف' : 'Summer promo'}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'نوع الخصم' : 'Discount type'}</Label>
                <Select value={form.discount_type} onValueChange={(v) => v && setForm((f) => ({ ...f, discount_type: v as 'amount' | 'percentage' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{ar ? 'نسبة %' : 'Percentage %'}</SelectItem>
                    <SelectItem value="amount">{ar ? 'مبلغ ثابت' : 'Fixed amount'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'قيمة الخصم *' : 'Discount value *'}</Label>
                <Input type="number" min={0} value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'تاريخ الانتهاء (اختياري)' : 'Expires (optional)'}</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{ar ? 'أقصى عدد استخدام (اختياري)' : 'Max uses (optional)'}</Label>
                <Input type="number" min={1} placeholder={ar ? 'بدون حد' : 'Unlimited'} value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{ar ? 'يُطبَّق على *' : 'Applies to *'}</Label>
              <div className="flex flex-wrap gap-2">
                {SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSection(s.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      form.applies_to.includes(s.key)
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <Tag className="h-3 w-3" />
                    {ar ? s.label_ar : s.label_en}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={createCode} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {ar ? 'حفظ الكود' : 'Save code'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setFormError(''); setForm(EMPTY_FORM) }}>
                {ar ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الكود' : 'Code'}</TableHead>
                <TableHead>{ar ? 'الخصم' : 'Discount'}</TableHead>
                <TableHead>{ar ? 'الأقسام' : 'Applies to'}</TableHead>
                <TableHead>{ar ? 'الاستخدام' : 'Uses'}</TableHead>
                <TableHead>{ar ? 'الانتهاء' : 'Expires'}</TableHead>
                <TableHead>{ar ? 'مفعّل' : 'Active'}</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{ar ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && error && (
                <TableRow><TableCell colSpan={7} className="text-center text-red-500 py-8">{error}</TableCell></TableRow>
              )}
              {!loading && !error && codes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono font-semibold text-sea-700" dir="ltr">{c.code}</span>
                    {c.label && <span className="block text-xs text-gray-400">{c.label}</span>}
                  </TableCell>
                  <TableCell>
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} ${ar ? 'ج.م' : 'EGP'}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.applies_to.map((s) => (
                        <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {SECTIONS.find((x) => x.key === s) ? (ar ? SECTIONS.find((x) => x.key === s)!.label_ar : SECTIONS.find((x) => x.key === s)!.label_en) : s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</TableCell>
                  <TableCell className="text-sm text-gray-600">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}
                    >
                      {c.is_active ? (ar ? 'مفعّل' : 'Active') : (ar ? 'موقوف' : 'Paused')}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => deleteCode(c.id)} className="text-gray-400 hover:text-red-600" aria-label={ar ? 'حذف' : 'Delete'}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !error && codes.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">{ar ? 'لا توجد أكواد خصم بعد' : 'No promo codes yet'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
