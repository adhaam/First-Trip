'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, X, Loader2, Upload, Pencil, Star, Info } from 'lucide-react'
import type { Testimonial } from '@/lib/types'

interface Form {
  id?: string
  name: string
  text_ar: string
  text_en: string
  rating: number
  avatar_url: string
  trip_ar: string
  trip_en: string
  source: string
  source_url: string
  sort_order: number
  is_published: boolean
}

const empty: Form = {
  name: '',
  text_ar: '',
  text_en: '',
  rating: 5,
  avatar_url: '',
  trip_ar: '',
  trip_en: '',
  source: 'facebook',
  source_url: '',
  sort_order: 0,
  is_published: true,
}

export function TestimonialsManager() {
  const locale = useLocale()
  const ar = locale === 'ar'

  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Form | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/testimonials')
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.testimonials || [])
    } catch {
      setLoadError(ar ? 'تعذر تحميل الآراء' : 'Failed to load testimonials')
    } finally {
      setLoading(false)
    }
  }, [locale, ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const openNew = () => setForm({ ...empty, sort_order: items.length })

  const openEdit = (t: Testimonial) =>
    setForm({
      id: t.id,
      name: t.name,
      text_ar: t.text_ar,
      text_en: t.text_en,
      rating: t.rating,
      avatar_url: t.avatar_url || '',
      trip_ar: t.trip_ar || '',
      trip_en: t.trip_en || '',
      source: t.source || 'facebook',
      source_url: t.source_url || '',
      sort_order: t.sort_order,
      is_published: t.is_published,
    })

  const save = async () => {
    if (!form) return
    if (form.name.trim().length < 2) return
    if (!form.text_ar.trim() && !form.text_en.trim()) {
      alert(ar ? 'اكتب نص الرأي بلغة واحدة على الأقل' : 'Write the review text in at least one language')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        text_ar: form.text_ar.trim(),
        text_en: form.text_en.trim(),
        rating: form.rating,
        avatar_url: form.avatar_url.trim() || null,
        trip_ar: form.trip_ar.trim(),
        trip_en: form.trip_en.trim(),
        source: form.source,
        source_url: form.source_url.trim() || null,
        sort_order: form.sort_order,
        is_published: form.is_published,
      }
      const res = await fetch(
        form.id ? `/api/admin/testimonials/${form.id}` : '/api/admin/testimonials',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (ar ? 'فشل الحفظ' : 'Save failed')); return }
      await load()
      setForm(null)
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (t: Testimonial) => {
    const res = await fetch(`/api/admin/testimonials/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !t.is_published }),
    })
    if (res.status === 401) { window.location.assign(locale === 'en' ? '/en/admin' : '/admin'); return }
    if (!res.ok) return
    setItems(prev => prev.map(x => (x.id === t.id ? { ...x, is_published: !x.is_published } : x)))
  }

  const remove = async (id: string) => {
    if (!confirm(ar ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' })
    if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
    if (!res.ok) return
    setItems(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {ar ? 'آراء العملاء' : 'Testimonials'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {ar
              ? 'الآراء اللي بتظهر في الصفحة الرئيسية.'
              : 'The reviews shown on the home page.'}
          </p>
        </div>
        <Button onClick={openNew} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="mr-2 h-4 w-4" />
          {ar ? 'إضافة رأي' : 'Add testimonial'}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="leading-relaxed">
          {ar
            ? 'انسخ التعليقات الحقيقية من صفحة الفيسبوك وحطها هنا باسم صاحبها ولينك البوست الأصلي في خانة "لينك المصدر".'
            : 'Copy the real reviews from the Facebook page and add them here with the reviewer name and a link to the original post.'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {ar ? 'جاري التحميل...' : 'Loading...'}
        </div>
      )}
      {!loading && loadError && <div className="py-16 text-center text-red-500">{loadError}</div>}

      {!loading && !loadError && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(t => (
            <Card key={t.id} className={t.is_published ? '' : 'opacity-60'}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-900">{t.name}</div>
                    <div className="mt-0.5 flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <button onClick={() => togglePublished(t)}>
                    <Badge
                      variant={t.is_published ? 'default' : 'outline'}
                      className={t.is_published
                        ? 'cursor-pointer bg-green-100 text-green-700'
                        : 'cursor-pointer'}
                    >
                      {t.is_published ? (ar ? 'منشور' : 'Live') : (ar ? 'مخفي' : 'Hidden')}
                    </Badge>
                  </button>
                </div>

                <p className="line-clamp-4 text-sm leading-relaxed text-gray-600">
                  {ar ? t.text_ar || t.text_en : t.text_en || t.text_ar}
                </p>

                {(t.trip_ar || t.trip_en) && (
                  <div className="text-xs text-gray-400">
                    {ar ? t.trip_ar || t.trip_en : t.trip_en || t.trip_ar}
                  </div>
                )}

                <div className="flex justify-end gap-1 border-t pt-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(t.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {items.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-400">
              {ar ? 'مفيش آراء لسه' : 'No testimonials yet'}
            </div>
          )}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <Card className="my-8 w-full max-w-2xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {form.id
                    ? (ar ? 'تعديل رأي' : 'Edit testimonial')
                    : (ar ? 'رأي جديد' : 'New testimonial')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setForm(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{ar ? 'اسم العميل' : 'Customer name'}</Label>
                  <Input
                    className="mt-1"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">{ar ? 'التقييم' : 'Rating'}</Label>
                  <Select
                    value={String(form.rating)}
                    onValueChange={v => v && setForm({ ...form, rating: parseInt(v) })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 4, 3, 2, 1].map(n => (
                        <SelectItem key={n} value={String(n)}>
                          {'★'.repeat(n)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{ar ? 'الرأي بالعربي' : 'Review (Arabic)'}</Label>
                <Textarea
                  rows={3}
                  className="mt-1"
                  value={form.text_ar}
                  onChange={e => setForm({ ...form, text_ar: e.target.value })}
                />
              </div>
              <div>
                <Label>{ar ? 'الرأي بالإنجليزي' : 'Review (English)'}</Label>
                <Textarea
                  rows={3}
                  dir="ltr"
                  className="mt-1"
                  value={form.text_en}
                  onChange={e => setForm({ ...form, text_en: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{ar ? 'الرحلة (عربي)' : 'Trip (Arabic)'}</Label>
                  <Input
                    className="mt-1"
                    placeholder={ar ? 'باكدج 5 أيام — أكتوبر 2025' : ''}
                    value={form.trip_ar}
                    onChange={e => setForm({ ...form, trip_ar: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{ar ? 'الرحلة (إنجليزي)' : 'Trip (English)'}</Label>
                  <Input
                    dir="ltr"
                    className="mt-1"
                    value={form.trip_en}
                    onChange={e => setForm({ ...form, trip_en: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{ar ? 'لينك صورة العميل (اختياري)' : 'Avatar URL (optional)'}</Label>
                  <Input
                    dir="ltr"
                    className="mt-1"
                    value={form.avatar_url}
                    onChange={e => setForm({ ...form, avatar_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{ar ? 'لينك المصدر (اختياري)' : 'Source URL (optional)'}</Label>
                  <Input
                    dir="ltr"
                    className="mt-1"
                    placeholder="https://facebook.com/..."
                    value={form.source_url}
                    onChange={e => setForm({ ...form, source_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{ar ? 'الترتيب' : 'Sort order'}</Label>
                  <Input
                    type="number"
                    min="0"
                    className="mt-1"
                    value={form.sort_order}
                    onChange={e =>
                      setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <label className="flex cursor-pointer items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={e => setForm({ ...form, is_published: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">
                    {ar ? 'منشور على الموقع' : 'Published on the site'}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t pt-2">
                <Button variant="outline" onClick={() => setForm(null)}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={save}
                  disabled={saving}
                  className="bg-brand-blue hover:bg-brand-blue-dark"
                >
                  {saving
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Upload className="mr-2 h-4 w-4" />}
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
