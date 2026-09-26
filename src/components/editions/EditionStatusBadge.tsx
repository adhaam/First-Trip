import { useTranslations } from 'next-intl'
import type { EditionStatus } from '@/lib/editions'

/**
 * Renders the exact bilingual status label — never invents wording for a
 * status. HIDDEN never reaches a public page (see editions-data.ts), but
 * this still renders nothing rather than an invalid key if it ever did.
 */
export function EditionStatusBadge({ status }: { status: EditionStatus }) {
  const t = useTranslations('editions')
  if (status === 'HIDDEN') return null

  return (
    <span className="inline-flex items-center rounded-full bg-sea-900/90 px-3 py-1 text-xs font-semibold text-white">
      {t(`status.${status}`)}
    </span>
  )
}
