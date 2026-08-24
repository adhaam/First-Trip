'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExperienceEditor, EMPTY_EXPERIENCE, type ExperienceDraft } from './experiences/ExperienceEditor'
import { ExperienceDatesPanel } from './experiences/ExperienceDatesPanel'
import { ExperienceBookingsTable } from './experiences/ExperienceBookingsTable'
import {
  DEFAULT_EXPERIENCE_CATEGORIES,
  categoryLabel,
  formatPrice,
  type ExperienceCategory,
  type ExperienceWithDates,
} from '@/lib/experiences'

type Tab = 'list' | 'bookings' | 'tags'

export function ExperiencesManager() {
  const locale = useLocale()
  const [experiences, setExperiences] = useState<ExperienceWithDates[]>([])
  const [categories, setCategories] = useState<ExperienceCategory[]>(DEFAULT_EXPERIENCE_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('list')
  const [search, setSearch] = useState('')

  const [draft, setDraft] = useState<ExperienceDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bookingsFilter, setBookingsFilter] = useState<{ experienceId?: string; dateId?: string }>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [expRes, catRes] = await Promise.all([
        fetch('/api/admin/experiences'),
        fetch('/api/admin/experience-categories'),
      ])
      if (expRes.status === 401) {
        window.location.href = locale === 'en' ? '/en/admin' : '/admin'
        return
      }
      const expData = await expRes.json()
      if (!expRes.ok) throw new Error(expData.error)
      setExperiences(expData.experiences || [])
      if (catRes.ok) {
        const catData = await catRes.json()
        setCategories(catData.categories?.length ? catData.categories : DEFAULT_EXPERIENCE_CATEGORIES)
      }
    } catch {
      setLoadError('Failed to load experiences')
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const save = async () => {
    if (!draft) return
    if (!draft.title_ar?.trim() || !draft.title_en?.trim()) {
      setSaveError('Both Arabic and English titles are required')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      // `slug` is only sent when the admin typed one — the API derives it otherwise.
      const { id, created_at, updated_at, ...payload } = draft as ExperienceDraft & Record<string, unknown>
      void created_at
      void updated_at
      if (!payload.slug) delete payload.slug

      const res = await fetch(id ? `/api/admin/experiences/${id}` : '/api/admin/experiences', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save experience')
        return
      }
      setDraft(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (experience: ExperienceWithDates) => {
    if (!confirm(`Delete "${experience.title_en || experience.title_ar}"? Its dates and bookings go with it.`)) return
    const res = await fetch(`/api/admin/experiences/${experience.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 409 && confirm(`${data.error}. Delete anyway?`)) {
        await fetch(`/api/admin/experiences/${experience.id}?force=true`, { method: 'DELETE' })
      } else {
        setLoadError(data.error || 'Failed to delete experience')
        return
      }
    }
    await load()
  }

  const togglePublish = async (experience: ExperienceWithDates) => {
    await fetch(`/api/admin/experiences/${experience.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: experience.status === 'published' ? 'draft' : 'published' }),
    })
    await load()
  }

  const filtered = experiences.filter(
    (e) =>
      !search ||
      e.title_en.toLowerCase().includes(search.toLowerCase()) ||
      e.title_ar.includes(search) ||
      e.partner_name.toLowerCase().includes(search.toLowerCase()),
  )

  if (draft) {
    return (
      <ExperienceEditor
        value={draft}
        categories={categories}
        saving={saving}
        error={saveError}
        onChange={setDraft}
        onSave={save}
        onCancel={() => { setDraft(null); setSaveError('') }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Signature Experiences</h2>
          <p className="text-sm text-gray-500">Curated small-group trips run with partners.</p>
        </div>
        <Button onClick={() => { setDraft({ ...EMPTY_EXPERIENCE }); setSaveError('') }}>
          <Plus className="mr-2 h-4 w-4" />
          New experience
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        {([
          ['list', 'Experiences'],
          ['bookings', 'All bookings'],
          ['tags', 'Tags'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); if (key === 'bookings') setBookingsFilter({}) }}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === key
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : tab === 'tags' ? (
        <CategoryManager categories={categories} onChanged={load} />
      ) : tab === 'bookings' ? (
        <ExperienceBookingsTable
          experienceId={bookingsFilter.experienceId}
          dateId={bookingsFilter.dateId}
          onStatusChanged={load}
        />
      ) : (
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or partner…"
            className="max-w-sm"
          />

          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed py-16 text-center text-gray-500">
              No experiences yet. Create the first one.
            </p>
          )}

          {filtered.map((experience) => {
            const upcoming = experience.dates.filter((d) => d.status !== 'cancelled')
            const totalRemaining = upcoming.reduce((sum, d) => sum + d.spots_remaining, 0)
            const expanded = expandedId === experience.id
            return (
              <div key={experience.id} className="rounded-xl border bg-white">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {experience.title_en || experience.title_ar}
                      </h3>
                      <Badge variant={experience.status === 'published' ? 'default' : 'secondary'}>
                        {experience.status}
                      </Badge>
                      <Badge variant="outline">{categoryLabel(experience.category, categories, 'en')}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {experience.partner_name || 'No partner'} ·{' '}
                      {formatPrice(experience.price, experience.currency, 'en')} per person ·{' '}
                      {upcoming.length} date(s) · {totalRemaining} spots left
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setExpandedId(expanded ? null : experience.id)}>
                      {expanded ? 'Hide dates' : 'Dates & bookings'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => togglePublish(experience)}>
                      {experience.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDraft({ ...experience }); setSaveError('') }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(experience)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-6 border-t bg-gray-50 p-4">
                    <ExperienceDatesPanel
                      experience={experience}
                      onChanged={load}
                      onViewBookings={(dateId) => {
                        setBookingsFilter({ experienceId: experience.id, dateId })
                        setTab('bookings')
                      }}
                    />
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-gray-700">Bookings for this experience</h4>
                      <ExperienceBookingsTable experienceId={experience.id} onStatusChanged={load} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CategoryManager({
  categories, onChanged,
}: { categories: ExperienceCategory[]; onChanged: () => void | Promise<void> }) {
  const [labelEn, setLabelEn] = useState('')
  const [labelAr, setLabelAr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    if (!labelEn.trim() || !labelAr.trim()) {
      setError('Both labels are required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/experience-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_en: labelEn.trim(), label_ar: labelAr.trim(), sort_order: 100 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to add tag')
        return
      }
      setLabelEn('')
      setLabelAr('')
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (slug: string) => {
    const res = await fetch(`/api/admin/experience-categories?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Failed to delete tag')
      return
    }
    await onChanged()
  }

  return (
    <div className="max-w-2xl space-y-5">
      <ul className="divide-y rounded-lg border bg-white">
        {categories.map((category) => (
          <li key={category.slug} className="flex items-center gap-3 px-4 py-3">
            <Tag className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-sm">
              <span className="font-medium text-gray-900">{category.label_en}</span>
              <span className="text-gray-500"> — {category.label_ar}</span>
              <code className="ml-2 text-xs text-gray-400">{category.slug}</code>
            </span>
            {category.slug !== 'other' && (
              <button
                type="button"
                onClick={() => remove(category.slug)}
                aria-label={`Delete ${category.label_en}`}
                className="text-gray-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg border bg-gray-50 p-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-700">Add a custom tag</h4>
        <div className="flex flex-wrap items-end gap-3">
          <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="English label" className="w-48" />
          <Input dir="rtl" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} placeholder="الاسم بالعربي" className="w-48" />
          <Button onClick={add} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add tag
          </Button>
        </div>
      </div>
    </div>
  )
}
