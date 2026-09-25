'use client'

// Panel A — TRANSPORT OPERATING SCHEDULE (when services run). Never mixes in what
// WEEMAP sells (that is TransportStayPatterns, panel B). docs/m3/OPS_API_CONTRACT.md.

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDateShort } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Plus, Ban, CalendarOff, CalendarPlus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeTransportError,
  WEEKDAYS, type TransportData, type TransportService, type WeeklyRule, type TransportException,
  type RuleDirection, type ExceptionDirection, type ExceptionKind,
} from './transport-types'

type Api = (url: string, init?: RequestInit) => Promise<Record<string, unknown>>

const RULE_DIRECTIONS: RuleDirection[] = ['outbound', 'return']
const NO_GOVERNORATE = '__any__'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransportOperatingSchedule({
  data, canWrite, api, onRefetch,
}: {
  data: TransportData
  canWrite: boolean
  api: Api
  onRefetch: () => Promise<void>
}) {
  const t = useTranslations('opsConfig.transport.schedule')
  const tCommon = useTranslations('opsConfig.common')
  const tWeekday = useTranslations('opsConfig.transport.weekdays')
  const locale = useLocale()
  const tTransport = useTranslations('opsConfig.transport')
  const describeError = (e: unknown) => describeTransportError(e, data, locale, tTransport)
  const ar = locale === 'ar'

  const [modeTarget, setModeTarget] = useState<TransportService | null>(null)
  const [modeSaving, setModeSaving] = useState(false)

  const [ruleDialog, setRuleDialog] = useState<{
    service: TransportService; direction: RuleDirection; weekday: number; rule: WeeklyRule | null
  } | null>(null)
  const [ruleForm, setRuleForm] = useState({ origin: NO_GOVERNORATE, validFrom: '', validTo: '', notes: '', isActive: true })
  const [ruleSaving, setRuleSaving] = useState(false)
  const [ruleError, setRuleError] = useState('')

  const [exceptionDialog, setExceptionDialog] = useState<{ kind: ExceptionKind } | null>(null)
  const [exceptionForm, setExceptionForm] = useState({
    transfer_type: data.services[0]?.transfer_type || '', direction: 'both' as ExceptionDirection,
    service_date: '', origin: NO_GOVERNORATE, reason_ar: '', reason_en: '',
  })
  const [exceptionSaving, setExceptionSaving] = useState(false)
  const [exceptionError, setExceptionError] = useState('')

  const rulesFor = (transferType: string, direction: RuleDirection, weekday: number) => (
    data.weekly_rules.filter((r) => r.transfer_type === transferType && r.direction === direction && r.weekday === weekday)
  )

  const governorateName = (code: string | null) => {
    if (!code) return t('originAny')
    const gov = data.governorates.find((g) => g.code === code)
    return gov ? (ar ? gov.name_ar : gov.name_en) : code
  }

  const changeMode = async () => {
    if (!modeTarget) return
    setModeSaving(true)
    try {
      const nextMode = modeTarget.schedule_mode === 'scheduled' ? 'on_demand' : 'scheduled'
      await api(`/api/admin/transport/services/${modeTarget.transfer_type}`, {
        method: 'PATCH', body: JSON.stringify({ schedule_mode: nextMode }),
      })
      await onRefetch()
      setModeTarget(null)
    } catch (e) {
      window.alert(describeError(e))
    } finally {
      setModeSaving(false)
    }
  }

  const openRuleDialog = (service: TransportService, direction: RuleDirection, weekday: number, rule: WeeklyRule | null) => {
    setRuleError('')
    setRuleForm({
      origin: rule?.origin_governorate_code || NO_GOVERNORATE,
      validFrom: rule?.valid_from || '',
      validTo: rule?.valid_to || '',
      notes: rule?.notes || '',
      isActive: rule?.is_active ?? true,
    })
    setRuleDialog({ service, direction, weekday, rule })
  }

  const submitRule = async () => {
    if (!ruleDialog) return
    setRuleError('')
    setRuleSaving(true)
    try {
      // Service, direction and weekday identify a rule; an edit may only change the rest.
      const editable = {
        origin_governorate_code: ruleForm.origin === NO_GOVERNORATE ? null : ruleForm.origin,
        valid_from: ruleForm.validFrom || null,
        valid_to: ruleForm.validTo || null,
        is_active: ruleForm.isActive,
        notes: ruleForm.notes,
      }
      if (ruleDialog.rule) {
        await api(`/api/admin/transport/weekly-rules/${ruleDialog.rule.id}`, {
          method: 'PATCH',
          body: JSON.stringify(editable),
        })
      } else {
        await api('/api/admin/transport/weekly-rules', {
          method: 'POST',
          body: JSON.stringify({
            transfer_type: ruleDialog.service.transfer_type,
            direction: ruleDialog.direction,
            weekday: ruleDialog.weekday,
            ...editable,
          }),
        })
      }
      await onRefetch()
      setRuleDialog(null)
    } catch (e) {
      setRuleError(describeError(e))
    } finally {
      setRuleSaving(false)
    }
  }

  const sortedExceptions = useMemo(() => (
    [...data.exceptions].sort((a, b) => a.service_date.localeCompare(b.service_date))
  ), [data.exceptions])

  const openExceptionDialog = (kind: ExceptionKind) => {
    setExceptionError('')
    setExceptionForm({
      transfer_type: data.services[0]?.transfer_type || '', direction: 'both', service_date: '',
      origin: NO_GOVERNORATE, reason_ar: '', reason_en: '',
    })
    setExceptionDialog({ kind })
  }

  const submitException = async () => {
    if (!exceptionDialog) return
    setExceptionError('')
    if (exceptionForm.service_date < todayIso()) {
      setExceptionError(t('exceptionDateError'))
      return
    }
    setExceptionSaving(true)
    try {
      await api('/api/admin/transport/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          transfer_type: exceptionForm.transfer_type,
          direction: exceptionForm.direction,
          service_date: exceptionForm.service_date,
          kind: exceptionDialog.kind,
          origin_governorate_code: exceptionForm.origin === NO_GOVERNORATE ? null : exceptionForm.origin,
          reason_ar: exceptionForm.reason_ar,
          reason_en: exceptionForm.reason_en,
          is_active: true,
        }),
      })
      await onRefetch()
      setExceptionDialog(null)
    } catch (e) {
      setExceptionError(describeError(e))
    } finally {
      setExceptionSaving(false)
    }
  }

  const toggleExceptionActive = async (exception: TransportException) => {
    try {
      await api(`/api/admin/transport/exceptions/${exception.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !exception.is_active }) })
      await onRefetch()
    } catch (e) {
      window.alert(describeError(e))
    }
  }

  const deleteException = async (exception: TransportException) => {
    if (!window.confirm(tCommon('confirm'))) return
    try {
      await api(`/api/admin/transport/exceptions/${exception.id}`, { method: 'DELETE' })
      await onRefetch()
    } catch (e) {
      window.alert(describeError(e))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t('title')}</h2>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
        {!canWrite && <p className="mt-1 text-xs text-amber-700">{tCommon('readOnlyNotice')}</p>}
      </div>

      {/* ─── Services + weekly rule grids ─── */}
      {data.services.map((service) => (
        <Card key={service.transfer_type}>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{ar ? service.name_ar : service.name_en}</h3>
                {!service.is_active && <Badge variant="outline" className="text-gray-500">{tCommon('inactive')}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={service.schedule_mode === 'scheduled' ? 'bg-sea-900/10 text-sea-900' : 'bg-weemap-orange/10 text-weemap-orange'}>
                  {service.schedule_mode === 'scheduled' ? t('modeScheduled') : t('modeOnDemand')}
                </Badge>
                {canWrite && (
                  <Button variant="outline" size="sm" onClick={() => setModeTarget(service)}>
                    {t('modeLabel')}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">{t('weeklyRulesTitle')}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className="w-20 text-start text-xs font-medium text-gray-500" />
                      <th scope="col" className="text-start text-xs font-medium text-gray-500">{t('directionOutbound')}</th>
                      <th scope="col" className="text-start text-xs font-medium text-gray-500">{t('directionReturn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAYS.map((weekday) => (
                      <tr key={weekday}>
                        <th scope="row" className="text-start text-xs font-medium text-gray-600">{tWeekday(String(weekday))}</th>
                        {RULE_DIRECTIONS.map((direction) => {
                          const rules = rulesFor(service.transfer_type, direction, weekday)
                          return (
                            <td key={direction} className="align-top rounded-md bg-gray-50/70 p-1.5">
                              <div className="flex flex-wrap items-center gap-1">
                                {rules.map((rule) => (
                                  <button
                                    key={rule.id}
                                    type="button"
                                    onClick={() => canWrite && openRuleDialog(service, direction, weekday, rule)}
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[11px]',
                                      rule.is_active ? 'bg-white text-gray-800 ring-1 ring-gray-200' : 'bg-gray-100 text-gray-400 line-through',
                                    )}
                                    title={rule.notes || undefined}
                                  >
                                    {governorateName(rule.origin_governorate_code)}
                                  </button>
                                ))}
                                {canWrite && (
                                  <button
                                    type="button"
                                    onClick={() => openRuleDialog(service, direction, weekday, null)}
                                    className="rounded px-1 py-0.5 text-gray-400 hover:bg-white hover:text-gray-700"
                                    aria-label={t('addRule')}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── 4-week operating preview for this service ─── */}
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">{t('previewTitle')}</div>
              <p className="mb-2 text-[11px] text-gray-400">{t('previewSubtitle')}</p>
              {RULE_DIRECTIONS.map((direction) => {
                const entry = data.preview.find((p) => p.transfer_type === service.transfer_type && p.direction === direction)
                return (
                  <div key={direction} className="mb-2">
                    <div className="mb-1 text-[11px] font-medium text-gray-500">
                      {direction === 'outbound' ? t('directionOutbound') : t('directionReturn')}
                    </div>
                    {entry && entry.dates.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {entry.dates.map((date) => (
                          <span key={date} className="rounded bg-sea-900/5 px-1.5 py-0.5 text-[11px] text-sea-900">
                            {formatDateShort(date, locale)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400">{t('previewEmpty')}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* ─── Date exceptions ─── */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{t('exceptionsTitle')}</h3>
              <p className="text-xs text-gray-500">{t('exceptionsSubtitle')}</p>
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openExceptionDialog('blackout')}>
                  <CalendarOff className="h-3.5 w-3.5" />
                  {t('addBlackout')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openExceptionDialog('extra')}>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {t('addExtraDeparture')}
                </Button>
              </div>
            )}
          </div>

          {sortedExceptions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t('noExceptions')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedExceptions.map((exception) => {
                const service = data.services.find((s) => s.transfer_type === exception.transfer_type)
                return (
                  <li key={exception.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span dir="ltr" className="text-sm font-medium text-gray-900">{exception.service_date}</span>
                        <Badge className={exception.kind === 'blackout' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                          {exception.kind === 'blackout' ? t('exceptionKindBlackout') : t('exceptionKindExtra')}
                        </Badge>
                        {!exception.is_active && <Badge variant="outline" className="text-gray-400">{tCommon('inactive')}</Badge>}
                        <span className="text-xs text-gray-500">{service ? (ar ? service.name_ar : service.name_en) : exception.transfer_type}</span>
                        <span className="text-xs text-gray-400">
                          {exception.direction === 'outbound' ? t('directionOutbound') : exception.direction === 'return' ? t('directionReturn') : t('directionBoth')}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{ar ? exception.reason_ar : exception.reason_en}</p>
                    </div>
                    {canWrite && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => toggleExceptionActive(exception)} title={exception.is_active ? tCommon('deactivate') : tCommon('activate')}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-red-500 hover:bg-red-50" onClick={() => deleteException(exception)} title={tCommon('delete')}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ─── Mode change confirmation ─── */}
      <Dialog open={Boolean(modeTarget)} onOpenChange={(open) => !open && setModeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {modeTarget && (
            <>
              <DialogTitle>{t('modeChangeTitle', { service: ar ? modeTarget.name_ar : modeTarget.name_en })}</DialogTitle>
              <p className="text-sm text-gray-600">{t('modeChangeBody')}</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModeTarget(null)}>{tCommon('cancel')}</Button>
                <Button onClick={changeMode} disabled={modeSaving} className="gap-1.5">
                  {modeSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('modeChangeConfirm')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Weekly rule add/edit ─── */}
      <Dialog open={Boolean(ruleDialog)} onOpenChange={(open) => !open && setRuleDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {ruleDialog && (
            <>
              <DialogTitle>{ruleDialog.rule ? t('editRule') : t('addRule')}</DialogTitle>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="rule-origin">{t('originLabel')}</Label>
                  <Select value={ruleForm.origin} onValueChange={(v) => v && setRuleForm((f) => ({ ...f, origin: v }))}>
                    <SelectTrigger id="rule-origin" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_GOVERNORATE}>{t('originAny')}</SelectItem>
                      {data.governorates.map((gov) => (
                        <SelectItem key={gov.code} value={gov.code}>{ar ? gov.name_ar : gov.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rule-valid-from">{t('validFromLabel')}</Label>
                    <Input id="rule-valid-from" type="date" className="mt-1" value={ruleForm.validFrom} onChange={(e) => setRuleForm((f) => ({ ...f, validFrom: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="rule-valid-to">{t('validToLabel')}</Label>
                    <Input id="rule-valid-to" type="date" className="mt-1" value={ruleForm.validTo} onChange={(e) => setRuleForm((f) => ({ ...f, validTo: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rule-notes">{t('notesLabel')}</Label>
                  <Textarea id="rule-notes" className="mt-1" rows={2} value={ruleForm.notes} onChange={(e) => setRuleForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4" />
                  {t('ruleActive')}
                </label>
                {ruleError && <p className="text-sm text-red-600">{ruleError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRuleDialog(null)}>{tCommon('cancel')}</Button>
                <Button onClick={submitRule} disabled={ruleSaving} className="gap-1.5">
                  {ruleSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tCommon('save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Exception add ─── */}
      <Dialog open={Boolean(exceptionDialog)} onOpenChange={(open) => !open && setExceptionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {exceptionDialog && (
            <>
              <DialogTitle>{exceptionDialog.kind === 'blackout' ? t('addBlackout') : t('addExtraDeparture')}</DialogTitle>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="exc-service">{t('exceptionServiceLabel')}</Label>
                  <Select value={exceptionForm.transfer_type} onValueChange={(v) => v && setExceptionForm((f) => ({ ...f, transfer_type: v }))}>
                    <SelectTrigger id="exc-service" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {data.services.map((service) => (
                        <SelectItem key={service.transfer_type} value={service.transfer_type}>{ar ? service.name_ar : service.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exc-direction">{t('exceptionDirectionLabel')}</Label>
                  <Select value={exceptionForm.direction} onValueChange={(v) => v && setExceptionForm((f) => ({ ...f, direction: v as ExceptionDirection }))}>
                    <SelectTrigger id="exc-direction" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">{t('directionOutbound')}</SelectItem>
                      <SelectItem value="return">{t('directionReturn')}</SelectItem>
                      <SelectItem value="both">{t('directionBoth')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exc-date">{t('exceptionDateLabel')}</Label>
                  <Input id="exc-date" type="date" min={todayIso()} className="mt-1" value={exceptionForm.service_date} onChange={(e) => setExceptionForm((f) => ({ ...f, service_date: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="exc-origin">{t('exceptionOriginLabel')}</Label>
                  <Select value={exceptionForm.origin} onValueChange={(v) => v && setExceptionForm((f) => ({ ...f, origin: v }))}>
                    <SelectTrigger id="exc-origin" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_GOVERNORATE}>{t('originAny')}</SelectItem>
                      {data.governorates.map((gov) => (
                        <SelectItem key={gov.code} value={gov.code}>{ar ? gov.name_ar : gov.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exc-reason-ar">{t('exceptionReasonArLabel')}</Label>
                  <Input id="exc-reason-ar" dir="rtl" className="mt-1" value={exceptionForm.reason_ar} onChange={(e) => setExceptionForm((f) => ({ ...f, reason_ar: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="exc-reason-en">{t('exceptionReasonEnLabel')}</Label>
                  <Input id="exc-reason-en" dir="ltr" className="mt-1" value={exceptionForm.reason_en} onChange={(e) => setExceptionForm((f) => ({ ...f, reason_en: e.target.value }))} />
                </div>
                {exceptionError && <p className="text-sm text-red-600">{exceptionError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExceptionDialog(null)}>{tCommon('cancel')}</Button>
                <Button onClick={submitException} disabled={exceptionSaving} className="gap-1.5">
                  {exceptionSaving && <Loader2 className="h-4 w-4 animate-spin" />}
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
