'use client'

import type { Dispatch } from 'react'
import { useTranslations } from 'next-intl'
import type { BuilderAction } from '@/lib/trip-builder/state'
import { transportOutboundWeekdayNames } from '@/lib/trip-builder/summaries'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import type { TransportMode } from '@/lib/trip-requests/schema'
import { ChoiceCard, handleRadioGroupKeyDown } from './controls'
import { useTransportCopy } from './useTransportCopy'

/** Section 1 — "From & how": transport mode, then (for transport modes) the origin. */
export function TransportStep({
  state,
  catalog,
  locale,
  dispatch,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  dispatch: Dispatch<BuilderAction>
}) {
  const t = useTranslations('builder')
  const mode = state.transport_mode
  const origins = mode && mode !== 'stay_only' ? catalog.governorates.filter((item) => item.transfer_types.includes(mode)) : []

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label={t('stepTransportTitle')} onKeyDown={handleRadioGroupKeyDown} className="grid gap-3 sm:grid-cols-3">
        {catalog.transferServices
          .filter((service) => service.is_active)
          .map((service) => (
            <TransferServiceCard
              key={service.type}
              type={service.type}
              vehicle={locale === 'ar' ? service.vehicle_ar : service.vehicle_en}
              active={mode === service.type}
              schedule={catalog.schedule}
              locale={locale}
              onClick={() => dispatch({ type: 'setMode', mode: service.type, catalog })}
            />
          ))}
        <ChoiceCard
          active={mode === 'stay_only'}
          title={t('transportStayOnlyTitle')}
          detail={t('transportStayOnlyDescription')}
          onClick={() => dispatch({ type: 'setMode', mode: 'stay_only', catalog })}
        />
      </div>

      {mode && mode !== 'stay_only' && (
        <div>
          <p className="mb-2.5 text-sm font-semibold text-sea-900">{t('transportOrigin')}</p>
          {origins.length ? (
            <div role="radiogroup" aria-label={t('transportOrigin')} onKeyDown={handleRadioGroupKeyDown} className="grid gap-2.5 sm:grid-cols-3">
              {origins.map((origin) => (
                <ChoiceCard
                  key={origin.code}
                  active={state.origin_governorate_code === origin.code}
                  title={locale === 'ar' ? origin.name_ar : origin.name_en}
                  onClick={() => dispatch({ type: 'setOrigin', origin: origin.code, catalog })}
                  className="min-h-14 p-3.5"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">{t('transportNoOrigins')}</p>
          )}
        </div>
      )}
    </div>
  )
}

function TransferServiceCard({
  type,
  vehicle,
  active,
  schedule,
  locale,
  onClick,
}: {
  type: TransportMode
  vehicle: string
  active: boolean
  schedule: BuilderCatalog['schedule']
  locale: 'ar' | 'en'
  onClick: () => void
}) {
  const t = useTranslations('builder')
  const copy = useTransportCopy(type)
  const days = transportOutboundWeekdayNames(schedule, type, locale)
  const scheduleHint = days ? t('transportScheduleOutbound', { days }) : t('transportOnDemand')
  return (
    <ChoiceCard
      active={active}
      title={copy.title}
      detail={copy.description}
      meta={[vehicle, scheduleHint].filter(Boolean).join(' · ')}
      onClick={onClick}
    />
  )
}
