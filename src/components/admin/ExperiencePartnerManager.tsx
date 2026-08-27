'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Plus, Pencil, X, Loader2, Eye, Lock } from 'lucide-react'
import type { ExperiencePartner } from '@/lib/types'
import { cn } from '@/lib/utils'

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

const emptyForm: Partial<ExperiencePartner> = {
  name: '', service_category: '',
  public_description_ar: '', public_description_en: '',
  contact_name: '', contact_phone: '', contact_email: '', internal_notes: '',
  public_credit_enabled: false, is_active: true,
}

export function ExperiencePartnerManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()
  const [partners, setPartners] = useState<ExperiencePartner[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<ExperiencePartner>>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await api('/api/admin/experience-partners')
      setPartners(data.partners || [])
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

  const updateField = <K extends keyof ExperiencePartner>(field: K, value: ExperiencePartner[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAdd = () => { setEditingId(null); setForm(emptyForm); setSaveError(''); setShowForm(true) }
  const handleEdit = (p: ExperiencePartner) => { setEditingId(p.id); setForm({ ...p }); setSaveError(''); setShowForm(true) }

  const handleSave = async () => {
    if (!form.name) { setSaveError(ar ? 'اسم الشريك مطلوب' : 'Partner name is required'); return }
    setSaving(true)
    try {
      if (editingId) {
        await api(`/api/admin/experience-partners/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await api('/api/admin/experience-partners', { method: 'POST', body: JSON.stringify(form) })
      }
      await load()
      setShowForm(false)
    } catch (e) { setSaveError((e as Error).message) } finally { setSaving(false) }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm(ar ? 'متأكد من إلغاء تفعيل الشريك؟' : 'Deactivate this partner?')) return
    await api(`/api/admin/experience-partners/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 max-w-lg">
          {ar
            ? 'بيانات التواصل مع الشركاء داخلية بالكامل ومتعرضش أبدًا في أي صفحة عامة. الاسم والوصف العام بيظهروا بس لو "إظهار الاسم للعملاء" مفعّل.'
            : "Partner contact info is fully internal and never appears on any public page. Name and public description only show when 'Public credit' is enabled."}
        </p>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark shrink-0">
          <Plus className="h-4 w-4 mr-2" />{ar ? 'إضافة شريك' : 'Add Partner'}
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{ar ? 'النوع' : 'Service'}</TableHead>
                <TableHead>{ar ? 'إظهار للعملاء' : 'Public credit'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{ar ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && loadError && <TableRow><TableCell colSpan={5} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>}
              {!loading && !loadError && partners.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{ar ? 'لا يوجد شركاء بعد' : 'No partners yet'}</TableCell></TableRow>
              )}
              {!loading && partners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-gray-500">{p.service_category}</TableCell>
                  <TableCell>
                    {p.public_credit_enabled
                      ? <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300"><Eye className="h-3 w-3" />{ar ? 'ظاهر' : 'Shown'}</Badge>
                      : <Badge variant="outline" className="gap-1 text-gray-500"><Lock className="h-3 w-3" />{ar ? 'مخفي' : 'Hidden'}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? 'default' : 'outline'} className={p.is_active ? 'bg-green-100 text-green-700' : ''}>
                      {p.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeactivate(p.id)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></Button>
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
          <Card className="w-full max-w-2xl my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? (ar ? 'تعديل الشريك' : 'Edit Partner') : (ar ? 'شريك جديد' : 'New Partner')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button>
              </div>

              {/* ─── PUBLIC INFORMATION ─── */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                  <Eye className="h-4 w-4" />{ar ? 'معلومات عامة (ممكن تظهر للعملاء)' : 'PUBLIC INFORMATION (may be shown to customers)'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>{ar ? 'اسم الشريك' : 'Partner name'}</Label><Input value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'النوع/الخدمة' : 'Service / category'}</Label><Input value={form.service_category || ''} onChange={(e) => updateField('service_category', e.target.value)} className="mt-1" placeholder={ar ? 'مركز غوص، مدرسة كايت سيرف...' : 'Diving center, kite school...'} /></div>
                  <div><Label>{ar ? 'وصف عام (عربي)' : 'Public description (Arabic)'}</Label><Textarea rows={2} value={form.public_description_ar || ''} onChange={(e) => updateField('public_description_ar', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'وصف عام (إنجليزي)' : 'Public description (English)'}</Label><Textarea rows={2} value={form.public_description_en || ''} onChange={(e) => updateField('public_description_en', e.target.value)} className="mt-1" /></div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input type="checkbox" checked={form.public_credit_enabled ?? false} onChange={(e) => updateField('public_credit_enabled', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm font-medium text-emerald-800">{ar ? 'إظهار اسم الشريك للعملاء' : 'Show this partner\'s name to customers'}</span>
                </label>
              </div>

              {/* ─── INTERNAL / PRIVATE INFORMATION ─── */}
              <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4 space-y-3">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-red-800">
                  <Lock className="h-4 w-4" />{ar ? 'معلومات داخلية/خاصة (مش بتظهر أبدًا للعملاء)' : 'INTERNAL / PRIVATE INFORMATION (never shown to customers)'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>{ar ? 'اسم المسؤول' : 'Contact name'}</Label><Input value={form.contact_name || ''} onChange={(e) => updateField('contact_name', e.target.value)} className="mt-1" /></div>
                  <div><Label>{ar ? 'رقم الهاتف' : 'Contact phone'}</Label><Input dir="ltr" value={form.contact_phone || ''} onChange={(e) => updateField('contact_phone', e.target.value)} className="mt-1" /></div>
                  <div className="sm:col-span-2"><Label>{ar ? 'البريد الإلكتروني' : 'Contact email'}</Label><Input dir="ltr" value={form.contact_email || ''} onChange={(e) => updateField('contact_email', e.target.value)} className="mt-1" /></div>
                  <div className="sm:col-span-2"><Label>{ar ? 'ملاحظات داخلية' : 'Internal notes'}</Label><Textarea rows={3} value={form.internal_notes || ''} onChange={(e) => updateField('internal_notes', e.target.value)} className="mt-1" /></div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => updateField('is_active', e.target.checked)} className="h-4 w-4" />
                <span className="text-sm text-gray-700">{ar ? 'نشط' : 'Active'}</span>
              </label>

              {saveError && <p className="text-sm text-red-600 font-medium">{saveError}</p>}

              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => setShowForm(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
                <Button onClick={handleSave} disabled={saving} className={cn('bg-brand-blue hover:bg-brand-blue-dark')}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
