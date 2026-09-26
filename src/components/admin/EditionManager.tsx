'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import {
  EDITION_CATEGORIES, EDITION_STATUSES, EDITION_PAYMENT_MODES,
  type EditionAdminInput, type EditionCopyItem, type EditionProgramItem, type InternalEdition,
} from '@/lib/editions'
import { EditionCopyListEditor } from '@/components/admin/editions/EditionCopyListEditor'
import { EditionProgramEditor } from '@/components/admin/editions/EditionProgramEditor'
import { EditionWorksheetPanel } from '@/components/admin/editions/EditionWorksheetPanel'
import { editionCategoryLabel, editionStatusLabel } from '@/lib/editions-labels'
import { dashboardHref } from '@/components/admin/ops/nav'

type PartnerOption = { id: string; name: string }

type EditionFormState = Omit<EditionAdminInput, 'includes' | 'excludes' | 'program'> & {
  includes: EditionCopyItem[]
  excludes: EditionCopyItem[]
  program: EditionProgramItem[]
}

const emptyForm: EditionFormState = {
  slug: '', title_en: '', title_ar: '',
  short_description_en: '', short_description_ar: '',
  full_description_en: '', full_description_ar: '',
  category: 'LEARN', status: 'COMING_SOON', featured: false, published: false, sort_order: 0,
  hero_image_url: null, start_date: null, end_date: null,
  location_en: null, location_ar: null,
  price_per_person_egp: null, payment_mode: null, deposit_value: null, balance_due_days_before_start: null,
  min_group_size: null, max_group_size: null,
  level_en: null, level_ar: null, who_for_en: null, who_for_ar: null,
  stay_en: null, stay_ar: null, good_to_know_en: null, good_to_know_ar: null,
  includes: [], excludes: [], program: [],
  partner_id: null, partner_name: null, partner_logo_url: null,
  partner_role_en: null, partner_role_ar: null, partner_url: null,
  cost_variable_per_guest_egp: null, cost_fixed_egp: null, contingency_pct: null,
}

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

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function EditionManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()

  const [editions, setEditions] = useState<InternalEdition[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EditionFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [eData, pData] = await Promise.all([
        api('/api/admin/editions'),
        api('/api/admin/experience-partners'),
      ])
      setEditions(eData.editions || [])
      setPartners((pData.partners || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
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

  const partnersById = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners])

  const handleAdd = () => { setEditingId(null); setForm(emptyForm); setSaveError(''); setShowForm(true) }
  const handleEdit = (edition: InternalEdition) => {
    setEditingId(edition.id)
    setForm({ ...emptyForm, ...edition })
    setSaveError('')
    setShowForm(true)
  }

  const updateField = <K extends keyof EditionFormState>(field: K, value: EditionFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaveError('')
    if (!form.slug || !form.title_en || !form.title_ar) {
      setSaveError(
        ar ? 'المعرف والعنوان (إنجليزي وعربي) مطلوبون' : 'Slug and both titles are required',
      )
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await api(`/api/admin/editions/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await api('/api/admin/editions', { method: 'POST', body: JSON.stringify(form) })
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(ar ? 'حذف هذه التجربة؟' : 'Delete this Experience?')) return
    try {
      await api(`/api/admin/editions/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {ar ? 'تجارب WEEMAP المميزة' : 'WEEMAP Experiences'}
              </h2>
              <Link
                href={dashboardHref('bookings', { tab: 'experience-requests' })}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {ar
                  ? 'طلبات التجارب موجودة في الحجوزات'
                  : 'Experience requests are in Bookings'}
              </Link>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              {ar ? 'تجربة جديدة' : 'New Experience'}
            </Button>
          </div>

          {loadError && <p className="text-sm text-destructive">{loadError}</p>}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Sort</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editions.map((edition) => (
                    <TableRow key={edition.id}>
                      <TableCell>{ar ? edition.title_ar : edition.title_en}</TableCell>
                      <TableCell>{editionCategoryLabel(edition.category, locale)}</TableCell>
                      <TableCell><Badge>{editionStatusLabel(edition.status, locale)}</Badge></TableCell>
                      <TableCell>{edition.published ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{edition.sort_order}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(edition)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(edition.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {editions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {ar ? 'لا توجد تجارب بعد' : 'No Experiences yet'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <Card className="my-8 w-full max-w-3xl">
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingId ? (ar ? 'تعديل التجربة' : 'Edit Experience') : (ar ? 'تجربة جديدة' : 'New Experience')}</h3>
                <Button size="icon" variant="ghost" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {saveError && <p className="text-sm text-destructive">{saveError}</p>}

              {/* Identity */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Identity</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={form.slug}
                      onChange={(e) => updateField('slug', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => updateField('category', v as typeof form.category)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EDITION_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{editionCategoryLabel(c, locale)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="title_en">Title (EN)</Label>
                    <Input
                      id="title_en"
                      value={form.title_en}
                      onChange={(e) => updateField('title_en', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="title_ar">Title (AR)</Label>
                    <Input
                      id="title_ar"
                      dir="rtl"
                      value={form.title_ar}
                      onChange={(e) => updateField('title_ar', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => updateField('status', v as typeof form.status)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EDITION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{editionStatusLabel(s, locale)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sort_order">Sort order</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => updateField('sort_order', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="published"
                      checked={form.published}
                      onCheckedChange={(v) => updateField('published', Boolean(v))}
                    />
                    <Label htmlFor="published">Published</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="featured"
                      checked={form.featured}
                      onCheckedChange={(v) => updateField('featured', Boolean(v))}
                    />
                    <Label htmlFor="featured">Featured</Label>
                  </div>
                </div>
              </section>

              {/* Media */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Media</h4>
                <div>
                  <Label htmlFor="hero_image_url">Hero image URL</Label>
                  <Input
                    id="hero_image_url"
                    value={form.hero_image_url || ''}
                    onChange={(e) => updateField('hero_image_url', e.target.value || null)}
                    placeholder="Leave empty to use the neutral fallback"
                  />
                </div>
              </section>

              {/* Dates */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Dates</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="start_date">Start date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={form.start_date || ''}
                      onChange={(e) => updateField('start_date', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={form.end_date || ''}
                      onChange={(e) => updateField('end_date', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location_en">Location (EN)</Label>
                    <Input
                      id="location_en"
                      value={form.location_en || ''}
                      onChange={(e) => updateField('location_en', e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location_ar">Location (AR)</Label>
                    <Input
                      id="location_ar"
                      dir="rtl"
                      value={form.location_ar || ''}
                      onChange={(e) => updateField('location_ar', e.target.value || null)}
                    />
                  </div>
                </div>
              </section>

              {/* Commercial */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Commercial</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="price">Price per person (EGP)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={form.price_per_person_egp ?? ''}
                      onChange={(e) => updateField('price_per_person_egp', numberOrNull(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Payment mode</Label>
                    <Select
                      value={form.payment_mode || 'none'}
                      onValueChange={(v) => {
                        updateField('payment_mode', v === 'none' ? null : (v as typeof form.payment_mode))
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {EDITION_PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="deposit_value">
                      Deposit value ({form.payment_mode === 'FIXED_DEPOSIT' ? 'EGP' : '%'})
                    </Label>
                    <Input
                      id="deposit_value"
                      type="number"
                      value={form.deposit_value ?? ''}
                      onChange={(e) => updateField('deposit_value', numberOrNull(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="balance_due">Balance due (days before start)</Label>
                    <Input
                      id="balance_due"
                      type="number"
                      value={form.balance_due_days_before_start ?? ''}
                      onChange={(e) => updateField('balance_due_days_before_start', numberOrNull(e.target.value))}
                    />
                  </div>
                </div>
              </section>

              {/* Group */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Group (internal)</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="min_group_size">Min. group size</Label>
                    <Input
                      id="min_group_size"
                      type="number"
                      value={form.min_group_size ?? ''}
                      onChange={(e) => updateField('min_group_size', numberOrNull(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_group_size">Max. group size</Label>
                    <Input
                      id="max_group_size"
                      type="number"
                      value={form.max_group_size ?? ''}
                      onChange={(e) => updateField('max_group_size', numberOrNull(e.target.value))}
                    />
                  </div>
                </div>
              </section>

              {/* Content EN/AR */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Content</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Textarea
                    value={form.short_description_en}
                    onChange={(e) => updateField('short_description_en', e.target.value)}
                    placeholder="Short description (EN)"
                    rows={2}
                  />
                  <Textarea
                    value={form.short_description_ar}
                    onChange={(e) => updateField('short_description_ar', e.target.value)}
                    placeholder="الوصف المختصر (AR)"
                    dir="rtl"
                    rows={2}
                  />
                  <Textarea
                    value={form.full_description_en}
                    onChange={(e) => updateField('full_description_en', e.target.value)}
                    placeholder="Full description (EN)"
                    rows={4}
                  />
                  <Textarea
                    value={form.full_description_ar}
                    onChange={(e) => updateField('full_description_ar', e.target.value)}
                    placeholder="الوصف الكامل (AR)"
                    dir="rtl"
                    rows={4}
                  />
                  <Input
                    value={form.level_en || ''}
                    onChange={(e) => updateField('level_en', e.target.value || null)}
                    placeholder="Level (EN)"
                  />
                  <Input
                    value={form.level_ar || ''}
                    onChange={(e) => updateField('level_ar', e.target.value || null)}
                    placeholder="المستوى (AR)"
                    dir="rtl"
                  />
                  <Textarea
                    value={form.who_for_en || ''}
                    onChange={(e) => updateField('who_for_en', e.target.value || null)}
                    placeholder="Who it's for (EN)"
                    rows={2}
                  />
                  <Textarea
                    value={form.who_for_ar || ''}
                    onChange={(e) => updateField('who_for_ar', e.target.value || null)}
                    placeholder="مناسب لمين (AR)"
                    dir="rtl"
                    rows={2}
                  />
                  <Textarea
                    value={form.stay_en || ''}
                    onChange={(e) => updateField('stay_en', e.target.value || null)}
                    placeholder="Stay (EN)"
                    rows={2}
                  />
                  <Textarea
                    value={form.stay_ar || ''}
                    onChange={(e) => updateField('stay_ar', e.target.value || null)}
                    placeholder="الإقامة (AR)"
                    dir="rtl"
                    rows={2}
                  />
                  <Textarea
                    value={form.good_to_know_en || ''}
                    onChange={(e) => updateField('good_to_know_en', e.target.value || null)}
                    placeholder="Good to know (EN)"
                    rows={2}
                  />
                  <Textarea
                    value={form.good_to_know_ar || ''}
                    onChange={(e) => updateField('good_to_know_ar', e.target.value || null)}
                    placeholder="مهم تعرف (AR)"
                    dir="rtl"
                    rows={2}
                  />
                </div>
              </section>

              {/* Program */}
              <section>
                <EditionProgramEditor program={form.program} onChange={(v) => updateField('program', v)} />
              </section>

              {/* Includes / Excludes */}
              <section className="grid gap-4 sm:grid-cols-2">
                <EditionCopyListEditor
                  label="Includes"
                  items={form.includes}
                  onChange={(v) => updateField('includes', v)}
                />
                <EditionCopyListEditor
                  label="Excludes"
                  items={form.excludes}
                  onChange={(v) => updateField('excludes', v)}
                />
              </section>

              {/* Partner */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Partner (optional)</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Linked partner</Label>
                    <Select
                      value={form.partner_id || 'none'}
                      onValueChange={(v) => {
                        const partner = !v || v === 'none' ? null : partnersById.get(v)
                        updateField('partner_id', !v || v === 'none' ? null : v)
                        updateField('partner_name', partner?.name ?? form.partner_name)
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No partner</SelectItem>
                        {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="partner_name">Partner name (public snapshot)</Label>
                    <Input
                      id="partner_name"
                      value={form.partner_name || ''}
                      onChange={(e) => updateField('partner_name', e.target.value || null)}
                    />
                  </div>
                  <Input
                    value={form.partner_role_en || ''}
                    onChange={(e) => updateField('partner_role_en', e.target.value || null)}
                    placeholder="Partner role (EN)"
                  />
                  <Input
                    value={form.partner_role_ar || ''}
                    onChange={(e) => updateField('partner_role_ar', e.target.value || null)}
                    placeholder="دور الشريك (AR)"
                    dir="rtl"
                  />
                  <Input
                    value={form.partner_logo_url || ''}
                    onChange={(e) => updateField('partner_logo_url', e.target.value || null)}
                    placeholder="Partner logo URL"
                  />
                  <Input
                    value={form.partner_url || ''}
                    onChange={(e) => updateField('partner_url', e.target.value || null)}
                    placeholder="Partner URL"
                  />
                </div>
              </section>

              {/* Internal pricing worksheet */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Internal pricing worksheet</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    type="number"
                    value={form.cost_variable_per_guest_egp ?? ''}
                    onChange={(e) => updateField('cost_variable_per_guest_egp', numberOrNull(e.target.value))}
                    placeholder="Variable cost / guest (EGP)"
                  />
                  <Input
                    type="number"
                    value={form.cost_fixed_egp ?? ''}
                    onChange={(e) => updateField('cost_fixed_egp', numberOrNull(e.target.value))}
                    placeholder="Fixed cost (EGP)"
                  />
                  <Input
                    type="number"
                    value={form.contingency_pct ?? ''}
                    onChange={(e) => updateField('contingency_pct', numberOrNull(e.target.value))}
                    placeholder="Contingency (%)"
                  />
                </div>
                <EditionWorksheetPanel
                  min_group_size={form.min_group_size}
                  price_per_person_egp={form.price_per_person_egp}
                  cost_variable_per_guest_egp={form.cost_variable_per_guest_egp}
                  cost_fixed_egp={form.cost_fixed_egp}
                  contingency_pct={form.contingency_pct}
                />
              </section>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
