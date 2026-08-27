'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus } from 'lucide-react'
import type { ExperienceCategory } from '@/lib/types'

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

const emptyForm = { slug: '', label_ar: '', label_en: '', description_ar: '', description_en: '' }

export function ExperienceCategoryManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()
  const [items, setItems] = useState<ExperienceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('/api/admin/experience-categories')
      setItems(data.categories || [])
    } catch { /* surfaced via empty state */ } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const create = async () => {
    setFormError('')
    if (!form.slug || !form.label_ar || !form.label_en) {
      setFormError(ar ? 'المعرف والاسم بالعربي والإنجليزي مطلوبين' : 'Slug, Arabic name, and English name are required')
      return
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setFormError(ar ? 'المعرف (slug) يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطة' : 'Slug must contain only lowercase letters, numbers, and hyphens')
      return
    }
    setSaving(true)
    try {
      await api('/api/admin/experience-categories', { method: 'POST', body: JSON.stringify(form) })
      setForm(emptyForm)
      await load()
    } catch (e) { setFormError((e as Error).message) } finally { setSaving(false) }
  }

  const toggleActive = async (c: ExperienceCategory) => {
    await api(`/api/admin/experience-categories/${c.slug}`, { method: 'PATCH', body: JSON.stringify({ is_active: !c.is_active }) })
    await load()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {ar
          ? 'تصنيفات Signature Experiences — قابلة للتعديل من غير أي تعديل في الكود.'
          : 'Signature Experiences categories — editable without code changes.'}
      </p>
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
          <Input placeholder={ar ? 'المعرف (slug)' : 'Slug'} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
          <div />
          <Input placeholder={ar ? 'الاسم بالعربي *' : 'Name (Arabic) *'} value={form.label_ar} onChange={(e) => setForm((f) => ({ ...f, label_ar: e.target.value }))} />
          <Input placeholder={ar ? 'الاسم بالإنجليزي *' : 'Name (English) *'} value={form.label_en} onChange={(e) => setForm((f) => ({ ...f, label_en: e.target.value }))} />
          <Textarea rows={2} placeholder={ar ? 'الوصف (عربي)' : 'Description (Arabic)'} value={form.description_ar} onChange={(e) => setForm((f) => ({ ...f, description_ar: e.target.value }))} />
          <Textarea rows={2} placeholder={ar ? 'الوصف (إنجليزي)' : 'Description (English)'} value={form.description_en} onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))} />
          <Button onClick={create} disabled={saving} className="sm:col-span-2"><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة تصنيف' : 'Add category'}</Button>
          {formError && <p className="sm:col-span-2 text-xs text-red-600 font-medium">{formError}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{ar ? 'مفعّل' : 'Active'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((c) => (
                <TableRow key={c.slug}>
                  <TableCell className="font-medium">{ar ? c.label_ar : c.label_en}</TableCell>
                  <TableCell dir="ltr">{c.slug}</TableCell>
                  <TableCell><Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} /></TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-8">{ar ? 'لا توجد تصنيفات بعد' : 'No categories yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
