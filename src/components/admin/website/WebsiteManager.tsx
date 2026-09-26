'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Save, CheckCircle2, Upload, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { Accommodation, SinaiTrip, SiteSettings } from '@/lib/types'
import type { PageKey, SitePage } from '@/lib/site-pages-core'
import { PAGE_FIELDS, PAGE_KEYS } from '@/lib/site-pages-core'

type SitePageDraft = Partial<SitePage> & { page_key: PageKey }

const EMPTY_PAGE = (page_key: PageKey): SitePageDraft => ({
  page_key,
  hero_image_url: null,
  hero_image_alt_en: null,
  hero_image_alt_ar: null,
  eyebrow_en: null,
  eyebrow_ar: null,
  title_en: null,
  title_ar: null,
  body_en: null,
  body_ar: null,
})

/**
 * Website admin workspace — Pages (hero + copy overrides per landing),
 * Homepage merchandising (moved from Site Settings), SEO (global defaults,
 * moved from Site Settings), and a read-only Navigation & footer explainer.
 * Prop-less, like every other admin manager (see AccommodationManager,
 * SinaiTripManager) — wired at section="website" on the admin dashboard.
 */
export function WebsiteManager() {
  const locale = useLocale()
  const t = useTranslations('website')

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="font-bold text-gray-900 text-lg">{t('title')}</h2>
      <Tabs defaultValue="pages">
        <TabsList variant="line">
          <TabsTrigger value="pages">{t('tabs.pages')}</TabsTrigger>
          <TabsTrigger value="homepage">{t('tabs.homepage')}</TabsTrigger>
          <TabsTrigger value="seo">{t('tabs.seo')}</TabsTrigger>
          <TabsTrigger value="navigation">{t('tabs.navigation')}</TabsTrigger>
        </TabsList>
        <TabsContent value="pages"><PagesTab /></TabsContent>
        <TabsContent value="homepage"><HomepageTab /></TabsContent>
        <TabsContent value="seo"><SeoTab /></TabsContent>
        <TabsContent value="navigation"><NavigationTab locale={locale} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Pages tab ───

function PagesTab() {
  const locale = useLocale()
  const t = useTranslations('website.pages')
  const [pages, setPages] = useState<Record<PageKey, SitePageDraft>>(() => {
    const base = {} as Record<PageKey, SitePageDraft>
    for (const key of PAGE_KEYS) base[key] = EMPTY_PAGE(key)
    return base
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [openKey, setOpenKey] = useState<PageKey | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch('/api/admin/site-pages')
        if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (cancelled) return
        setPages((prev) => {
          const next = { ...prev }
          for (const row of (data.pages || []) as SitePage[]) {
            next[row.page_key] = row
          }
          return next
        })
      } catch {
        if (!cancelled) setLoadError(t('loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [locale, t])

  if (loading) {
    return <div className="text-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /></div>
  }
  if (loadError) {
    return <div className="text-center py-12 text-red-500">{loadError}</div>
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-xs text-gray-500">{t('intro')}</p>
      <div className="space-y-2">
        {PAGE_KEYS.map((key) => (
          <div key={key} className="rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setOpenKey(openKey === key ? null : key)}
              className="flex w-full items-center justify-between gap-3 p-3 text-start"
            >
              <span className="flex items-center gap-3">
                {pages[key].hero_image_url
                  ? <img src={pages[key].hero_image_url || ''} alt="" className="h-10 w-16 rounded object-cover" />
                  : <span className="flex h-10 w-16 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">—</span>}
                <span className="font-medium text-gray-900">{t(`pageKeys.${key}`)}</span>
              </span>
              <span className="text-xs text-brand-blue">{openKey === key ? t('closeEditor') : t('openEditor')}</span>
            </button>
            {openKey === key && (
              <div className="border-t border-gray-100 p-4">
                <SitePageEditor
                  key={`${key}-${pages[key].updated_at ?? 'new'}`}
                  pageKey={key}
                  draft={pages[key]}
                  onSaved={(row) => setPages((p) => ({ ...p, [key]: row }))}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SitePageEditor({
  pageKey,
  draft,
  onSaved,
}: {
  pageKey: PageKey
  draft: SitePageDraft
  onSaved: (row: SitePage) => void
}) {
  const locale = useLocale()
  const t = useTranslations('website.pages')
  const [form, setForm] = useState<SitePageDraft>(draft)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fields = PAGE_FIELDS[pageKey]

  const update = (field: keyof SitePageDraft, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'website')
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error)
      update('hero_image_url', data.url)
    } catch {
      setUploadError(t('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/admin/site-pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, page_key: pageKey }),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || t('saveError')); return }
      onSaved(data.page)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {fields.image && (
        <>
          <div>
        <Label className="font-semibold">{t('heroImage')}</Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            dir="ltr"
            value={form.hero_image_url || ''}
            onChange={(e) => update('hero_image_url', e.target.value || null)}
            placeholder="/media/... or https://..."
            className="min-h-10 flex-1"
          />
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-medium text-white transition-colors hover:bg-brand-blue-dark">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t('upload')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
                e.target.value = ''
              }}
            />
          </label>
          {form.hero_image_url && (
            <Button type="button" variant="outline" className="min-h-10 px-3" onClick={() => update('hero_image_url', null)}>
              <X className="h-4 w-4" />{t('clear')}
            </Button>
          )}
        </div>
        {uploadError && <p className="mt-2 text-xs text-red-600" role="alert">{uploadError}</p>}
        {!form.hero_image_url && <p className="mt-2 text-xs text-gray-500">{t('noImageSet')}</p>}
        {form.hero_image_url && (
          <img src={form.hero_image_url} alt="" className="mt-3 h-32 w-full rounded-lg object-cover" />
        )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <CopyInput
              label={t('heroImageAltEn')}
              value={form.hero_image_alt_en}
              dir="ltr"
              onChange={(value) => update('hero_image_alt_en', value)}
            />
            <CopyInput
              label={t('heroImageAltAr')}
              value={form.hero_image_alt_ar}
              onChange={(value) => update('hero_image_alt_ar', value)}
            />
          </div>
        </>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-4">
        <Label className="font-semibold">{t('copyOverrides')}</Label>
        <p className="text-xs text-gray-500">{t('copyOverridesHint')}</p>
        {pageKey === 'home' && (
          <p className="text-xs text-gray-500">{t('homeHeadlineFixed')}</p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fields.eyebrow && (
            <CopyInput
              label={t('eyebrowEn')}
              value={form.eyebrow_en}
              dir="ltr"
              onChange={(value) => update('eyebrow_en', value)}
            />
          )}
          {fields.eyebrow && (
            <CopyInput
              label={t('eyebrowAr')}
              value={form.eyebrow_ar}
              onChange={(value) => update('eyebrow_ar', value)}
            />
          )}
          {fields.title && (
            <CopyInput
              label={t('titleEn')}
              value={form.title_en}
              dir="ltr"
              onChange={(value) => update('title_en', value)}
            />
          )}
          {fields.title && (
            <CopyInput
              label={t('titleAr')}
              value={form.title_ar}
              onChange={(value) => update('title_ar', value)}
            />
          )}
          {fields.body && (
            <CopyTextarea
              label={t('bodyEn')}
              value={form.body_en}
              dir="ltr"
              onChange={(value) => update('body_en', value)}
            />
          )}
          {fields.body && (
            <CopyTextarea
              label={t('bodyAr')}
              value={form.body_ar}
              onChange={(value) => update('body_ar', value)}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('save')}
        </Button>
        {saved && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{t('saved')}</span>}
        {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
      </div>
    </div>
  )
}

// ─── Homepage merchandising tab (moved from SiteSettingsManager) ───

function CopyInput({
  label,
  value,
  dir,
  onChange,
}: {
  label: string
  value?: string | null
  dir?: 'ltr'
  onChange: (value: string | null) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        dir={dir}
        value={value || ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="mt-1"
      />
    </div>
  )
}

function CopyTextarea({
  label,
  value,
  dir,
  onChange,
}: {
  label: string
  value?: string | null
  dir?: 'ltr'
  onChange: (value: string | null) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        dir={dir}
        rows={3}
        value={value || ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="mt-1"
      />
    </div>
  )
}

function HomepageTab() {
  const locale = useLocale()
  const t = useTranslations('website.homepage')
  const [settings, setSettings] = useState<Partial<SiteSettings>>({})
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const [sRes, tRes, aRes] = await Promise.all([
          fetch('/api/admin/site-settings'),
          fetch('/api/admin/sinai-trips'),
          fetch('/api/admin/accommodations'),
        ])
        if (sRes.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
        const sData = await sRes.json()
        if (!sRes.ok) throw new Error(sData.error)
        if (cancelled) return
        setSettings(sData.settings || {})
        if (tRes.ok) setTrips((await tRes.json()).trips || [])
        if (aRes.ok) setAccommodations((await aRes.json()).accommodations || [])
      } catch {
        if (!cancelled) setLoadError(t('loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [locale, t])

  const toggleInList = (field: 'featured_trip_ids' | 'featured_accommodation_ids', id: string) => {
    const current = (settings[field] as string[] | undefined) || []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setSettings((prev) => ({ ...prev, [field]: next }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featured_trip_ids: settings.featured_trip_ids || [],
          featured_accommodation_ids: settings.featured_accommodation_ids || [],
        }),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || t('saveError')); return }
      setSettings(data.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /></div>
  if (loadError) return <div className="text-center py-12 text-red-500">{loadError}</div>

  return (
    <div className="space-y-4 pt-4">
      <p className="text-xs text-gray-500">{t('intro')}</p>
      <Card>
        <CardContent className="p-4 space-y-1 text-xs text-gray-600">
          <p className="font-semibold text-gray-800">{t('autoRuleTitle')}</p>
          <p>{t('autoRuleStays')}</p>
          <p>{t('autoRuleTrips')}</p>
        </CardContent>
      </Card>

      <div>
        <Label className="font-semibold">{t('featuredStays')}</Label>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {accommodations.filter((a) => a.is_active).map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={(settings.featured_accommodation_ids || []).includes(a.id)}
                onChange={() => toggleInList('featured_accommodation_ids', a.id)}
                className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
              />
              <span className="flex-1 truncate">{locale === 'ar' ? a.name_ar : a.name_en}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-semibold">{t('featuredTrips')}</Label>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {trips.filter((tr) => tr.is_active).map((tr) => (
            <label key={tr.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={(settings.featured_trip_ids || []).includes(tr.id)}
                onChange={() => toggleInList('featured_trip_ids', tr.id)}
                className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
              />
              <span className="flex-1 truncate">{locale === 'ar' ? tr.name_ar : tr.name_en}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('save')}
        </Button>
        {saved && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{t('saved')}</span>}
        {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
      </div>
    </div>
  )
}

// ─── Global SEO tab (moved from SiteSettingsManager) ───

function SeoTab() {
  const locale = useLocale()
  const t = useTranslations('website.seo')
  const [settings, setSettings] = useState<Partial<SiteSettings>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch('/api/admin/site-settings')
        if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (!cancelled) setSettings(data.settings || {})
      } catch {
        if (!cancelled) setLoadError(t('loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [locale, t])

  const update = (field: string, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seo_title: settings.seo_title || '',
          seo_description_ar: settings.seo_description_ar || '',
          seo_description_en: settings.seo_description_en || '',
          social_share_image: settings.social_share_image || '',
        }),
      })
      if (res.status === 401) { window.location.href = locale === 'en' ? '/en/admin' : '/admin'; return }
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || t('saveError')); return }
      setSettings(data.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /></div>
  if (loadError) return <div className="text-center py-12 text-red-500">{loadError}</div>

  return (
    <div className="space-y-4 pt-4">
      <p className="text-xs text-gray-500">{t('intro')}</p>
      <p className="text-xs text-gray-500">{t('derivedNote')}</p>
      <div className="grid grid-cols-1 gap-4">
        <div><Label>{t('siteTitle')}</Label><Input dir="ltr" value={settings.seo_title || ''} onChange={(e) => update('seo_title', e.target.value)} className="mt-1" /></div>
        <div><Label>{t('descriptionEn')}</Label><Textarea dir="ltr" rows={2} value={settings.seo_description_en || ''} onChange={(e) => update('seo_description_en', e.target.value)} className="mt-1" /></div>
        <div><Label>{t('descriptionAr')}</Label><Textarea rows={2} value={settings.seo_description_ar || ''} onChange={(e) => update('seo_description_ar', e.target.value)} className="mt-1" /></div>
        <div><Label>{t('shareImage')}</Label><Input dir="ltr" value={settings.social_share_image || ''} onChange={(e) => update('social_share_image', e.target.value)} className="mt-1" /></div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('save')}
        </Button>
        {saved && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{t('saved')}</span>}
        {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
      </div>
    </div>
  )
}

// ─── Navigation & footer tab (read-only explainer) ───

function NavigationTab({ locale }: { locale: string }) {
  const t = useTranslations('website.navigation')
  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardContent className="p-4 space-y-3 text-sm text-gray-600">
          <p>{t('navExplainer')}</p>
          <p>{t('footerExplainer')}</p>
          <a
            href={locale === 'en' ? '/en/admin/dashboard?section=settings' : '/admin/dashboard?section=settings'}
            className="inline-flex items-center gap-1 text-brand-blue hover:underline"
          >
            {t('footerLink')}<ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
