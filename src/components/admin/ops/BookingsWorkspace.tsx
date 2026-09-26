'use client'

import { useTranslations } from 'next-intl'
import { WorkspaceTabs, type WorkspaceTab } from '@/components/admin/ops/WorkspaceTabs'
import { QueueView } from '@/components/admin/ops/QueueView'
import { BookingsManager } from '@/components/admin/BookingsManager'
import { TripBookingsManager } from '@/components/admin/TripBookingsManager'
import { EditionRequestsPanel } from '@/components/admin/editions/EditionRequestsPanel'
import { PartnerInquiriesManager } from '@/components/admin/PartnerInquiriesManager'
import { ExperienceRequestsManager } from '@/components/admin/ExperienceRequestsManager'

/**
 * Bookings workspace — one sidebar entry, several kinds of "things to act on".
 * defaultTab is chosen by the dashboard page from the legacy ?section= value
 * so old links (e.g. dashboardHref('trip-bookings')) still land on the right tab.
 */
export function BookingsWorkspace({ defaultTab }: { defaultTab: string }) {
  const t = useTranslations('ops.nav.items')

  const tabs: WorkspaceTab[] = [
    {
      id: 'needs-action',
      label: t('bookingsTabNeedsAction'),
      content: <QueueView />,
      params: { view: 'needs_action' },
    },
    {
      id: 'trip-requests',
      label: t('bookingsTabTripRequests'),
      content: <QueueView />,
      params: { view: 'needs_action', type: 'trip_request' },
    },
    { id: 'stays', label: t('bookingsTabStays'), content: <BookingsManager /> },
    { id: 'trips', label: t('bookingsTabTrips'), content: <TripBookingsManager /> },
    { id: 'experience-requests', label: t('bookingsTabExperienceRequests'), content: <EditionRequestsPanel /> },
    { id: 'partner-inquiries', label: t('bookingsTabPartnerInquiries'), content: <PartnerInquiriesManager /> },
    {
      id: 'experience-requests-archive',
      label: t('bookingsTabArchive'),
      content: <ExperienceRequestsManager />,
      muted: true,
    },
  ]

  return <WorkspaceTabs section="bookings" tabs={tabs} defaultTab={defaultTab} />
}
