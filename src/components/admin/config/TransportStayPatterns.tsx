'use client'

// Panel B — COMMERCIAL STAY PATTERNS (what WEEMAP sells). Never mixes in when
// transport actually runs (that is TransportOperatingSchedule, panel A).
// docs/m3/OPS_API_CONTRACT.md — POST/PATCH /transport/stay-patterns.

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Plus, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WEEKDAYS, describeTransportError, type TransportData, type StayPattern } from './transport-types'

type Api = (url: string, init?: RequestInit) => Promise<Record<string, unknown>>
type ApiError = Error & { code?: string; details?: unknown }

const ALL_SERVICES = '__all__'

function emptyForm(defaultOrder: number) {
  return {
    code: '', transfer_type: ALL_SERVICES, name_ar: '', name_en: '',
    duration_days: 4, nights: 3, return_offset_days: 3,
    weekdays: new Set<number>(), anyDay: true,
    is_active: true, sort_order: defaultOrder,
  }
}

export function TransportStayPatterns({
  data, canWrite, api, onRefetch,
}: {
  data: TransportData
  canWrite: boolean
  api: Api
  onRefetch: () => Promise<void>
}) {
  const t = useTranslations('opsConfig.transport.patterns')
  const tCommon = useTranslations('opsConfig.common')
  const tWeekday = useTranslations('opsConfig.transport.weekdays')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [dialogPattern, setDialogPattern] = useState<StayPattern | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm(data.stay_patterns.length))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const serviceName = (transferType: string | null) => {
    if (!transferType) return t('allServices')
    const service = data.services.find((s) => s.transfer_type === transferType)
    return service ? (ar ? service.name_ar : service.name_en) : transferType
  }

  const openCreate = () => {
    setFormError('')
    setForm(emptyForm(data.stay_patterns.length))
    setDialogPattern('new')
  }

  const openEdit = (pattern: StayPattern) => {
    setFormError('')
    setForm({
      code: pattern.code,
      transfer_type: pattern.transfer_type || ALL_SERVICES,
      name_ar: pattern.name_ar,
      name_en: pattern.name_en,
      duration_days: pattern.duration_days,
      nights: pattern.nights,
      return_offset_days: pattern.return_offset_days,
      weekdays: new Set(pattern.departure_weekdays || []),
      anyDay: !pattern.departure_weekdays || pattern.departure_weekdays.length === 0,
      is_active: pattern.is_active,
      sort_order: pattern.sort_order,
    })
    setDialogPattern(pattern)
  }

  const toggleWeekday = (day: number) => {
    setForm((f) => {
      const next = new Set(f.weekdays)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return { ...f, weekdays: next }
    })
  }

  const tTransport = useTranslations('opsConfig.transport')
  const errorMessage = (e: ApiError): string => describeTransportError(e, data, locale, tTransport)

  const submit = async () => {
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        transfer_type: form.transfer_type === ALL_SERVICES ? null : form.transfer_type,
        name_ar: form.name_ar,
        name_en: form.name_en,
        duration_days: Number(form.duration_days),
        nights: Number(form.nights),
        return_offset_days: Number(form.return_offset_days),
        departure_weekdays: form.anyDay ? null : Array.from(form.weekdays).sort(),
        is_active: form.is_active,
        sort_order: Number(form.sort_order),
      }
      if (dialogPattern === 'new') {
        await api('/api/admin/transport/stay-patterns', { method: 'POST', body: JSON.stringify({ ...payload, code: form.code }) })
      } else if (dialogPattern) {
        await api(`/api/admin/transport/stay-patterns/${dialogPattern.code}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      await onRefetch()
      setDialogPattern(null)
    } catch (e) {
      setFormError(errorMessage(e as ApiError))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (pattern: StayPattern) => {
    try {
      await api(`/api/admin/transport/stay-patterns/${pattern.code}`, { method: 'PATCH', body: JSON.stringify({ is_active: !pattern.is_active }) })
      await onRefetch()
    } catch (e) {
      window.alert(errorMessage(e as ApiError))
    }
  }

  const sorted = [...data.stay_patterns].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
          {!canWrite && <p className="mt-1 text-xs text-amber-700">{tCommon('readOnlyNotice')}</p>}
        </div>
        {canWrite && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t('add')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('table.code')}</TableHead>
                <TableHead scope="col">{t('table.service')}</TableHead>
                <TableHead scope="col">{t('table.name')}</TableHead>
                <TableHead scope="col">{t('table.duration')}</TableHead>
                <TableHead scope="col">{t('table.returnOffset')}</TableHead>
                <TableHead scope="col">{t('table.departureWeekdays')}</TableHead>
                <TableHead scope="col">{t('table.status')}</TableHead>
                <TableHead scope="col">{t('table.order')}</TableHead>
                {canWrite && <TableHead scope="col">{t('table.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-gray-400">—</TableCell></TableRow>
              )}
              {sorted.map((pattern) => (
                <TableRow key={pattern.code}>
                  <TableCell dir="ltr" className="font-medium">{pattern.code}</TableCell>
                  <TableCell className="text-sm">{serviceName(pattern.transfer_type)}</TableCell>
                  <TableCell className="text-sm">{ar ? pattern.name_ar : pattern.name_en}</TableCell>
                  <TableCell className="text-sm">
                    {pattern.duration_days} {t('daysSuffix')} / {pattern.nights} {t('nightsSuffix')}
                  </TableCell>
                  <TableCell className="text-sm">+{pattern.return_offset_days} {t('offsetSuffix')}</TableCell>
                  <TableCell className="text-xs">
                    {!pattern.departure_weekdays || pattern.departure_weekdays.length === 0
                      ? t('anyOperatingDay')
                      : pattern.departure_weekdays.map((d) => tWeekday(String(d))).join(', ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pattern.is_active ? 'default' : 'outline'} className={cn(!pattern.is_active && 'text-gray-500')}>
                      {pattern.is_active ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{pattern.sort_order}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(pattern)} title={t('edit')}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleActive(pattern)}>
                          {pattern.is_active ? tCommon('deactivate') : tCommon('activate')}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialogPattern)} onOpenChange={(open) => !open && setDialogPattern(null)}>
        <DialogContent className="sm:max-w-lg">
          {dialogPattern && (
            <>
              <DialogTitle>{dialogPattern === 'new' ? t('add') : t('edit')}</DialogTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pattern-code">{t('codeLabel')}</Label>
                  <Input
                    id="pattern-code" dir="ltr" className="mt-1" disabled={dialogPattern !== 'new'}
                    value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="pattern-service">{t('serviceLabel')}</Label>
                  <Select value={form.transfer_type} onValueChange={(v) => v && setForm((f) => ({ ...f, transfer_type: v }))}>
                    <SelectTrigger id="pattern-service" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_SERVICES}>{t('allServices')}</SelectItem>
                      {data.services.map((service) => (
                        <SelectItem key={service.transfer_type} value={service.transfer_type}>{ar ? service.name_ar : service.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pattern-name-ar">{t('nameArLabel')}</Label>
                  <Input id="pattern-name-ar" dir="rtl" className="mt-1" value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="pattern-name-en">{t('nameEnLabel')}</Label>
                  <Input id="pattern-name-en" dir="ltr" className="mt-1" value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="pattern-duration">{t('durationDaysLabel')}</Label>
                  <Input id="pattern-duration" type="number" min={1} className="mt-1" value={form.duration_days} onChange={(e) => setForm((f) => ({ ...f, duration_days: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="pattern-nights">{t('nightsLabel')}</Label>
                  <Input id="pattern-nights" type="number" min={0} className="mt-1" value={form.nights} onChange={(e) => setForm((f) => ({ ...f, nights: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="pattern-offset">{t('returnOffsetLabel')}</Label>
                  <Input id="pattern-offset" type="number" min={0} className="mt-1" value={form.return_offset_days} onChange={(e) => setForm((f) => ({ ...f, return_offset_days: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="pattern-sort">{t('sortOrderLabel')}</Label>
                  <Input id="pattern-sort" type="number" min={0} className="mt-1" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t('departureWeekdaysLabel')}</Label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" checked={form.anyDay} onChange={(e) => setForm((f) => ({ ...f, anyDay: e.target.checked }))} className="h-4 w-4" />
                      {t('anyOperatingDay')}
                    </label>
                    {!form.anyDay && WEEKDAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs',
                          form.weekdays.has(day) ? 'border-sea-900 bg-sea-900 text-white' : 'border-gray-300 text-gray-600',
                        )}
                      >
                        {tWeekday(String(day))}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 sm:col-span-2">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="h-4 w-4" />
                  {t('activeLabel')}
                </label>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogPattern(null)}>{tCommon('cancel')}</Button>
                <Button onClick={submit} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tCommon('save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
