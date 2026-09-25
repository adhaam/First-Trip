'use client'

import { useTranslations } from 'next-intl'
import type { TransportMode } from '@/lib/trip-requests/schema'

/**
 * The designed name/description for a scheduled transfer type — "WEEMAP Bus",
 * "Private Hiace" — never the raw `transferServices[].name_ar` / `name_en`
 * from the catalog (those are operational DB labels like "Package Transfer"
 * / "Standalone Transfer"; showing them to a visitor was exactly the
 * flagged regression this rebuild fixes). Shared by `TransportStep` (the
 * choice cards) and `OverviewTimeline` ("what WEEMAP confirms next").
 *
 * A literal-key switch, not a `Record` looked up dynamically, for the same
 * reason noted in `JourneySection.tsx`.
 */
export function useTransportCopy(type: TransportMode): { title: string; description: string } {
  const t = useTranslations('builder')
  if (type === 'hiace') return { title: t('transportHiaceTitle'), description: t('transportHiaceDescription') }
  if (type === 'stay_only') return { title: t('transportStayOnlyTitle'), description: t('transportStayOnlyDescription') }
  return { title: t('transportPackageBusTitle'), description: t('transportPackageBusDescription') }
}
