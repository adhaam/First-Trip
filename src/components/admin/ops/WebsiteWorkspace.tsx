'use client'

import { useTranslations } from 'next-intl'
import { WorkspaceTabs, type WorkspaceTab } from '@/components/admin/ops/WorkspaceTabs'
import { WebsiteManager } from '@/components/admin/website/WebsiteManager'
import { CommunityPostManager } from '@/components/admin/CommunityPostManager'
import { TestimonialsManager } from '@/components/admin/TestimonialsManager'
import { NewsletterManager } from '@/components/admin/NewsletterManager'

export function WebsiteWorkspace({ defaultTab }: { defaultTab: string }) {
  const t = useTranslations('ops.nav.items')

  const tabs: WorkspaceTab[] = [
    { id: 'website-manager', label: t('websiteTabManager'), content: <WebsiteManager /> },
    { id: 'community', label: t('websiteTabCommunity'), content: <CommunityPostManager /> },
    { id: 'testimonials', label: t('websiteTabTestimonials'), content: <TestimonialsManager /> },
    { id: 'newsletter', label: t('websiteTabNewsletter'), content: <NewsletterManager /> },
  ]

  return <WorkspaceTabs section="website" tabs={tabs} defaultTab={defaultTab} />
}
