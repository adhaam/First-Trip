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
import { Plus, Pencil, Trash2, X, Search, Upload, Loader2, Pin } from 'lucide-react'
import { CommunityPost } from '@/lib/types'

const CATEGORIES = [
  { value: 'blog', label_ar: 'مدونة', label_en: 'Blog' },
  { value: 'hidden-gems', label_ar: 'أماكن مخفية', label_en: 'Hidden Gems' },
  { value: 'stories', label_ar: 'قصص', label_en: 'Stories' },
  { value: 'dahab-guide', label_ar: 'دليل دهب', label_en: 'Dahab Guide' },
]

const emptyPost: Partial<CommunityPost> = {
  title_ar: '', title_en: '', content_ar: '', content_en: '',
  category: 'blog', image_url: '', sort_order: 0, is_pinned: false, is_published: true,
}

export function CommunityPostManager() {
  const locale = useLocale()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<CommunityPost | null>(null)
  const [form, setForm] = useState<Partial<CommunityPost>>({})
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/community-posts')
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPosts(data.posts || [])
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = posts.filter(p =>
    !search || p.title_ar.includes(search) || p.title_en.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (p: CommunityPost) => { setEditing(p); setForm({ ...p }); setShowForm(true) }
  const handleAdd = () => { setEditing(null); setForm({ ...emptyPost }); setShowForm(true) }
  const updateField = (field: string, value: string | number | boolean) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.title_ar || !form.title_en) return
    setSaving(true)
    try {
      const res = editing
        ? await fetch(`/api/admin/community-posts/${editing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
          })
        : await fetch('/api/admin/community-posts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
          })
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (locale === 'ar' ? 'فشل الحفظ' : 'Save failed')); return }
      await load()
      setShowForm(false); setEditing(null); setForm({})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(locale === 'ar' ? 'متأكد من الحذف؟' : 'Confirm delete?')) return
    const res = await fetch(`/api/admin/community-posts/${id}`, { method: 'DELETE' })
    if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || (locale === 'ar' ? 'فشل الحذف' : 'Delete failed')); return }
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder={locale === 'ar' ? 'بحث...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={handleAdd} className="bg-brand-blue hover:bg-brand-blue-dark">
          <Plus className="h-4 w-4 mr-2" />{locale === 'ar' ? 'إضافة منشور' : 'Add Post'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === 'ar' ? 'العنوان' : 'Title'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الفئة' : 'Category'}</TableHead>
                <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{locale === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={4} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.is_pinned && <Pin className="h-3 w-3 inline mr-1 text-brand-orange" />}
                    {locale === 'ar' ? p.title_ar : p.title_en}
                  </TableCell>
                  <TableCell>{CATEGORIES.find(c => c.value === p.category)?.[locale === 'ar' ? 'label_ar' : 'label_en']}</TableCell>
                  <TableCell>
                    <Badge className={p.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                      {p.is_published ? (locale === 'ar' ? 'منشور' : 'Published') : (locale === 'ar' ? 'مسودة' : 'Draft')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">{locale === 'ar' ? 'لا توجد منشورات' : 'No posts found'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editing ? (locale === 'ar' ? 'تعديل المنشور' : 'Edit Post') : (locale === 'ar' ? 'إضافة منشور جديد' : 'Add New Post')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditing(null) }}><X className="h-5 w-5" /></Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{locale === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label><Input value={form.title_ar || ''} onChange={e => updateField('title_ar', e.target.value)} className="mt-1" /></div>
                <div><Label>{locale === 'ar' ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label><Input value={form.title_en || ''} onChange={e => updateField('title_en', e.target.value)} className="mt-1" /></div>
                <div>
                  <Label>{locale === 'ar' ? 'الفئة' : 'Category'}</Label>
                  <Select value={form.category || 'blog'} onValueChange={v => v && updateField('category', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{locale === 'ar' ? c.label_ar : c.label_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{locale === 'ar' ? 'رابط الصورة' : 'Image URL'}</Label><Input value={form.image_url || ''} onChange={e => updateField('image_url', e.target.value)} className="mt-1" placeholder="https://..." /></div>
              </div>

              <div><Label className="mb-2 block">{locale === 'ar' ? 'المحتوى (عربي)' : 'Content (Arabic)'}</Label><Textarea rows={4} value={form.content_ar || ''} onChange={e => updateField('content_ar', e.target.value)} /></div>
              <div><Label className="mb-2 block">{locale === 'ar' ? 'المحتوى (إنجليزي)' : 'Content (English)'}</Label><Textarea rows={4} value={form.content_en || ''} onChange={e => updateField('content_en', e.target.value)} /></div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_pinned ?? false} onChange={e => updateField('is_pinned', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{locale === 'ar' ? 'مثبت' : 'Pinned'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_published ?? true} onChange={e => updateField('is_published', e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">{locale === 'ar' ? 'منشور' : 'Published'}</span>
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
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
