'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Link2, Loader2, Trash2 } from 'lucide-react'
import type { CommunityLinkedTarget, CommunityLinkTargetType } from '@/lib/types'

const TARGET_TYPE_LABELS: Record<CommunityLinkTargetType, { ar: string; en: string }> = {
  stay: { ar: 'إقامة', en: 'Stay' },
  trip: { ar: 'رحلة سيناء', en: 'Sinai Trip' },
  trip_package: { ar: 'باقة رحلات', en: 'Trip Package' },
  signature_experience: { ar: 'تجربة سيجنتشر', en: 'Signature Experience' },
}

// Endpoint + array key for each catalog this editor lets an admin pick from.
// These are the SAME admin list endpoints the Stays / Sinai Trips / Trip
// Packages / Signature Experiences managers already use — read-only here.
const CATALOG_SOURCES: Record<CommunityLinkTargetType, { url: string; key: string }> = {
  stay: { url: '/api/admin/accommodations', key: 'accommodations' },
  trip: { url: '/api/admin/sinai-trips', key: 'trips' },
  trip_package: { url: '/api/admin/trip-packages', key: 'packages' },
  signature_experience: { url: '/api/admin/experiences', key: 'experiences' },
}

interface CatalogOption { id: string; name_ar: string; name_en: string }

function toOptions(payload: unknown, key: string): CatalogOption[] {
  const list = (payload as Record<string, unknown>)?.[key]
  if (!Array.isArray(list)) return []
  return list.map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      name_ar: String(r.name_ar ?? r.title_ar ?? r.id),
      name_en: String(r.name_en ?? r.title_en ?? r.id),
    }
  })
}

export function LinkedTargetsEditor({ postId, locale }: { postId: string; locale: string }) {
  const ar = locale === 'ar'
  const [links, setLinks] = useState<CommunityLinkedTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [targetType, setTargetType] = useState<CommunityLinkTargetType>('trip')
  const [options, setOptions] = useState<CatalogOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadLinks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/community-posts/${postId}/links`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) setLinks(data.links || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch for the new target_type
    setOptionsLoading(true)
    setSelectedId('')
    const { url, key } = CATALOG_SOURCES[targetType]
    fetch(url)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setOptions(toOptions(data, key)) })
      .catch(() => { if (!cancelled) setOptions([]) })
      .finally(() => { if (!cancelled) setOptionsLoading(false) })
    return () => { cancelled = true }
  }, [targetType])

  const handleAdd = async () => {
    if (!selectedId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/community-posts/${postId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: selectedId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || (ar ? 'فشل الربط' : 'Failed to link')); return }
      setSelectedId('')
      await loadLinks()
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (linkId: string) => {
    await fetch(`/api/admin/community-posts/${postId}/links/${linkId}`, { method: 'DELETE' })
    setLinks((prev) => prev.filter((l) => l.id !== linkId))
  }

  return (
    <div className="rounded-md border border-gray-200 p-4 space-y-3">
      <Label className="flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        {ar ? 'إقامات / رحلات / باقات مرتبطة' : 'Linked stays / trips / packages'}
      </Label>
      <p className="text-xs text-gray-500">
        {ar
          ? 'تظهر هذه الروابط في "خطط رحلتك مع WEEMAP" أسفل المقال، وفي "أدلة محلية" على صفحة العنصر نفسه.'
          : 'These links power "Plan it with WEEMAP" under the article, and "Local guides" on the linked item\'s own page.'}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />{ar ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : (
        <ul className="space-y-1">
          {links.length === 0 && <li className="text-sm text-gray-400">{ar ? 'لا توجد روابط بعد' : 'No links yet'}</li>}
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-3 py-1.5 text-sm">
              <span>
                <span className="text-gray-400 mr-2">{TARGET_TYPE_LABELS[link.target_type][ar ? 'ar' : 'en']}</span>
                {ar ? link.title_ar : link.title_en}
              </span>
              <Button variant="ghost" size="icon" onClick={() => handleRemove(link.id)} className="text-red-500 hover:text-red-700 h-7 w-7">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
        <Select value={targetType} onValueChange={(v) => v && setTargetType(v as CommunityLinkTargetType)}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TARGET_TYPE_LABELS) as CommunityLinkTargetType[]).map((type) => (
              <SelectItem key={type} value={type}>{TARGET_TYPE_LABELS[type][ar ? 'ar' : 'en']}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedId} onValueChange={(v) => v && setSelectedId(v)} disabled={optionsLoading || options.length === 0}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={optionsLoading ? (ar ? 'جاري التحميل...' : 'Loading...') : (ar ? 'اختر عنصرًا' : 'Choose an item')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>{ar ? opt.name_ar : opt.name_en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={handleAdd} disabled={!selectedId || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (ar ? 'ربط' : 'Link')}
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
