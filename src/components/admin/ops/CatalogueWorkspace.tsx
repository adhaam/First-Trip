'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { WorkspaceTabs, type WorkspaceTab } from '@/components/admin/ops/WorkspaceTabs'
import { AccommodationManager } from '@/components/admin/AccommodationManager'
import { SinaiTripManager } from '@/components/admin/SinaiTripManager'
import { TripPackageManager } from '@/components/admin/TripPackageManager'
import { PackageCategoryManager } from '@/components/admin/PackageCategoryManager'
import { EditionManager } from '@/components/admin/EditionManager'
import { TransferPricingManager } from '@/components/admin/TransferPricingManager'
import { TransportScheduleManager } from '@/components/admin/config/TransportScheduleManager'
import { ExperiencePartnerManager } from '@/components/admin/ExperiencePartnerManager'
import { CatalogueHealthPanel } from '@/components/admin/config/CatalogueHealthPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function PackagesTab() {
  const t = useTranslations('ops.nav.items')
  const [sub, setSub] = useState<'packages' | 'categories'>('packages')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={sub === 'packages' ? 'default' : 'outline'}
          onClick={() => setSub('packages')}
        >
          {t('catalogueTabPackages')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={sub === 'categories' ? 'default' : 'outline'}
          className={cn(sub !== 'categories' && 'text-muted-foreground')}
          onClick={() => setSub('categories')}
        >
          {t('catalogueSubTabPackageCategories')}
        </Button>
      </div>
      {sub === 'packages' ? <TripPackageManager /> : <PackageCategoryManager />}
    </div>
  )
}

function TransfersTab() {
  return (
    <div className="space-y-8">
      <TransferPricingManager />
      <TransportScheduleManager />
    </div>
  )
}

export function CatalogueWorkspace({ defaultTab }: { defaultTab: string }) {
  const t = useTranslations('ops.nav.items')

  const tabs: WorkspaceTab[] = [
    { id: 'stays', label: t('catalogueTabStays'), content: <AccommodationManager /> },
    { id: 'trips', label: t('catalogueTabTrips'), content: <SinaiTripManager /> },
    { id: 'packages', label: t('catalogueTabPackages'), content: <PackagesTab /> },
    { id: 'experiences', label: t('catalogueTabExperiences'), content: <EditionManager /> },
    { id: 'transfers', label: t('catalogueTabTransfers'), content: <TransfersTab /> },
    { id: 'partners', label: t('catalogueTabPartners'), content: <ExperiencePartnerManager /> },
    { id: 'health', label: t('catalogueTabHealth'), content: <CatalogueHealthPanel /> },
  ]

  return <WorkspaceTabs section="catalogue" tabs={tabs} defaultTab={defaultTab} />
}
