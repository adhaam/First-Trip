import { useTranslations } from 'next-intl'
import { SafeImage as Image } from '@/components/SafeImage'
import type { PublicEdition } from '@/lib/editions'

type Props = {
  edition: Pick<PublicEdition, 'partner_name' | 'partner_logo_url' | 'partner_role_en' | 'partner_role_ar'>
  locale: string
}

/** Subtle partner credit line — renders only when partner_name is set on this Edition. */
export function EditionPartnerLine({ edition, locale }: Props) {
  const t = useTranslations('editions')
  if (!edition.partner_name) return null
  const role = locale === 'ar' ? edition.partner_role_ar : edition.partner_role_en

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      {edition.partner_logo_url && (
        <Image
          src={edition.partner_logo_url}
          alt={edition.partner_name}
          width={24}
          height={24}
          className="h-6 w-6 rounded-full object-cover"
        />
      )}
      <span>
        {t('detail.inCollaborationWith')} {edition.partner_name}
        {role ? ` · ${role}` : ''}
      </span>
    </div>
  )
}
