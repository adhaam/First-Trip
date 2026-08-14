'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Save, CheckCircle2, Mountain } from 'lucide-react'
import { SiteSettings, SinaiTrip } from '@/lib/types'

export function SiteSettingsManager() {
  const locale = useLocale()
  const [settings, setSettings] = useState<Partial<SiteSettings>>({})
  const [trips, setTrips] = useState<SinaiTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [sRes, tRes] = await Promise.all([
        fetch('/api/admin/site-settings'),
        fetch('/api/admin/sinai-trips'),
      ])
      if (sRes.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await sRes.json()
      if (!sRes.ok) throw new Error(data.error)
      setSettings(data.settings || {})
      if (tRes.ok) {
        const tData = await tRes.json()
        setTrips(tData.trips || [])
      }
    } catch {
      setLoadError(locale === 'ar' ? 'تعذر تحميل الإعدادات' : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateField = (field: string, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const toggleIncludedTrip = (id: string) => {
    const current = settings.package_included_trip_ids || []
    const next = current.includes(id) ? current.filter(t => t !== id) : [...current, id]
    setSettings(prev => ({ ...prev, package_included_trip_ids: next }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      })
      if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
      const data = await res.json()
      if (!res.ok) { alert(data.error || (locale === 'ar' ? 'فشل الحفظ' : 'Save failed')); return }
      setSettings(data.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin inline mr-2" />{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
  }
  if (loadError) {
    return <div className="text-center py-16 text-red-500">{loadError}</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{locale === 'ar' ? 'معلومات التواصل' : 'Contact Info'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>{locale === 'ar' ? 'رقم واتساب' : 'WhatsApp Number'}</Label><Input dir="ltr" value={settings.whatsapp_number || ''} onChange={e => updateField('whatsapp_number', e.target.value)} className="mt-1" /></div>
            <div><Label>{locale === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label><Input dir="ltr" value={settings.phone_number || ''} onChange={e => updateField('phone_number', e.target.value)} className="mt-1" /></div>
            <div><Label>{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label><Input dir="ltr" value={settings.email || ''} onChange={e => updateField('email', e.target.value)} className="mt-1" /></div>
            <div><Label>{locale === 'ar' ? 'رابط الفيسبوك' : 'Facebook URL'}</Label><Input dir="ltr" value={settings.facebook_url || ''} onChange={e => updateField('facebook_url', e.target.value)} className="mt-1" /></div>
            <div><Label>{locale === 'ar' ? 'رابط الإنستجرام' : 'Instagram URL'}</Label><Input dir="ltr" value={settings.instagram_url || ''} onChange={e => updateField('instagram_url', e.target.value)} className="mt-1" /></div>
            <div><Label>{locale === 'ar' ? 'رابط اللوجو' : 'Logo URL'}</Label><Input dir="ltr" value={settings.logo_url || ''} onChange={e => updateField('logo_url', e.target.value)} className="mt-1" /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{locale === 'ar' ? 'الصورة الرئيسية' : 'Hero Media'}</h3>
          <div><Label>{locale === 'ar' ? 'رابط صورة/فيديو الهيرو' : 'Hero Media URL'}</Label><Input dir="ltr" value={settings.hero_media_url || ''} onChange={e => updateField('hero_media_url', e.target.value)} className="mt-1" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Mountain className="h-4 w-4 text-brand-orange" />
            {locale === 'ar' ? 'الرحلات المضمّنة في كل باكدج' : 'Trips Included in Every Package'}
          </h3>
          <p className="text-xs text-gray-500">
            {locale === 'ar'
              ? 'اختار الرحلات اللي بتتضاف تلقائي لسعر أي باكدج (زي الرحلتين الداخليتين). سعرهم بيتحسب في التوتال أوتوماتيك.'
              : 'Pick the trips that get bundled into every package price automatically (like the two included day trips). Their price is added to the total automatically.'}
          </p>
          {trips.length === 0 ? (
            <p className="text-sm text-gray-400">{locale === 'ar' ? 'لا توجد رحلات مضافة بعد' : 'No trips added yet'}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {trips.map(trip => (
                <label key={trip.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={(settings.package_included_trip_ids || []).includes(trip.id)}
                    onChange={() => toggleIncludedTrip(trip.id)}
                    className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                  />
                  <span className="flex-1 truncate">{locale === 'ar' ? trip.name_ar : trip.name_en}</span>
                  <span className="text-xs text-gray-400 shrink-0">{trip.price?.toLocaleString()} ج.م</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{locale === 'ar' ? 'السياسات' : 'Policies'}</h3>
          <div><Label className="mb-2 block">{locale === 'ar' ? 'سياسة الاسترداد (عربي)' : 'Refund Policy (Arabic)'}</Label><Textarea rows={3} value={settings.refund_policy_ar || ''} onChange={e => updateField('refund_policy_ar', e.target.value)} /></div>
          <div><Label className="mb-2 block">{locale === 'ar' ? 'سياسة الاسترداد (إنجليزي)' : 'Refund Policy (English)'}</Label><Textarea rows={3} value={settings.refund_policy_en || ''} onChange={e => updateField('refund_policy_en', e.target.value)} /></div>
          <div><Label className="mb-2 block">{locale === 'ar' ? 'سياسة الخصوصية (عربي)' : 'Privacy Policy (Arabic)'}</Label><Textarea rows={3} value={settings.privacy_policy_ar || ''} onChange={e => updateField('privacy_policy_ar', e.target.value)} /></div>
          <div><Label className="mb-2 block">{locale === 'ar' ? 'سياسة الخصوصية (إنجليزي)' : 'Privacy Policy (English)'}</Label><Textarea rows={3} value={settings.privacy_policy_en || ''} onChange={e => updateField('privacy_policy_en', e.target.value)} /></div>
          <div><Label className="mb-2 block">{locale === 'ar' ? 'الشروط والأحكام (عربي)' : 'Terms (Arabic)'}</Label><Textarea rows={3} value={settings.terms_ar || ''} onChange={e => updateField('terms_ar', e.target.value)} /></div>
          <div><Label className="mb-2 block">{locale === 'ar' ? 'الشروط والأحكام (إنجليزي)' : 'Terms (English)'}</Label><Textarea rows={3} value={settings.terms_en || ''} onChange={e => updateField('terms_en', e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue-dark">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {locale === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
        </Button>
        {saved && (
          <span className="text-green-600 text-sm flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />{locale === 'ar' ? 'تم الحفظ' : 'Saved'}
          </span>
        )}
      </div>
    </div>
  )
}
