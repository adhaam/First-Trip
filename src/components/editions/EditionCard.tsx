import { useTranslations } from 'next-intl'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import type { PublicEdition } from '@/lib/editions'
import { ctaIntentFor } from '@/lib/editions'
import { NEUTRAL_MEDIA } from '@/lib/media'
import { EditionStatusBadge } from '@/components/editions/EditionStatusBadge'

type Props = {
  edition: PublicEdition
  locale: 'en' | 'ar'
}

/**
 * A Coming Soon card shows only hero, category, title, short description,
 * status and the "Tell me when it opens" CTA — never price/date/partner/
 * capacity, regardless of whether those columns happen to be set.
 */
export function EditionCard({ edition, locale }: Props) {
  const t = useTranslations('editions')
  const ar = locale === 'ar'
  const title = ar ? edition.title_ar : edition.title_en
  const short = ar ? edition.short_description_ar : edition.short_description_en
  const isComingSoon = edition.status === 'COMING_SOON'
  const intent = ctaIntentFor(edition.status)

  return (
    <Link
      href={`/editions/${edition.slug}`}
      className={[
        'group flex flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white',
        'shadow-sm transition-shadow hover:shadow-md',
      ].join(' ')}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-sand-100">
        <Image
          src={edition.hero_image_url || NEUTRAL_MEDIA}
          alt={title}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <EditionStatusBadge status={edition.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-sea-600">
          {t(`filters.${edition.category}`)}
        </span>
        <h3 className="font-display text-xl font-bold text-sea-900">{title}</h3>
        {short && <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{short}</p>}

        {!isComingSoon && edition.price_per_person_egp !== null && (
          <p className="mt-1 text-sm font-semibold text-sea-900">
            {t('card.from')} {edition.price_per_person_egp} {t('card.perPerson')}
          </p>
        )}

        <span className="mt-3 inline-flex text-sm font-semibold text-sun-600">
          {isComingSoon
            ? t('card.notifyEdition')
            : intent === 'ASK'
              ? t('card.askEdition')
              : intent === 'JOIN'
                ? t('card.joinEdition')
                : t('card.viewEdition')}
        </span>
      </div>
    </Link>
  )
}
