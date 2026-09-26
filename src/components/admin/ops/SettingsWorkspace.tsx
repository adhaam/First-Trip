'use client'

import { useTranslations } from 'next-intl'
import { WorkspaceTabs, type WorkspaceTab } from '@/components/admin/ops/WorkspaceTabs'
import { SiteSettingsManager } from '@/components/admin/SiteSettingsManager'
import { StaffManager } from '@/components/admin/config/StaffManager'
import { AuditLogViewer } from '@/components/admin/config/AuditLogViewer'
import { MyAccountView } from '@/components/admin/ops/MyAccountView'
import type { StaffCapabilities } from '@/components/admin/ops/StaffContext'

export function SettingsWorkspace({
  defaultTab, capabilities, role,
}: { defaultTab: string; capabilities: StaffCapabilities; role: string | undefined }) {
  const t = useTranslations('ops.nav.items')

  const tabs: WorkspaceTab[] = [
    { id: 'site-settings', label: t('settingsTabSiteSettings'), content: <SiteSettingsManager /> },
  ]
  if (capabilities.manageStaff) {
    tabs.push({ id: 'staff', label: t('settingsTabStaff'), content: <StaffManager /> })
  }
  if (role !== 'operations') {
    tabs.push({ id: 'audit', label: t('settingsTabAudit'), content: <AuditLogViewer /> })
  }
  tabs.push({ id: 'my-account', label: t('settingsTabMyAccount'), content: <MyAccountView /> })

  return <WorkspaceTabs section="settings" tabs={tabs} defaultTab={defaultTab} />
}
