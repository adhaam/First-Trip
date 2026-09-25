import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { SafeImage as Image } from '@/components/SafeImage'
import { MapPin, Mountain, Route, ShoppingBag, Package, BookOpen } from 'lucide-react'
import { Section, SectionHeading } from '@/components/brand'
import { pageMetadata } from '@/lib/seo'
import { runSearch } from '@/lib/discovery/search'
import type { SearchResult, SearchResultType } from '@/lib/discovery/search'
import { formatAmount, formatCount } from '@/lib/format'
import { NEUTRAL_MEDIA } from '@/lib/media'

export const revalidate = 0 // always fresh — a search query is never cached

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params
  const { q } = await searchParams
  const t = await getTranslations({ locale, namespace: 'discovery' })
  const title = q ? t('search.resultsTitleFor', { query: q }) : t('search.resultsTitle')
  return pageMetadata({
    locale,
    path: '/search',
    title,
    description: t('search.metaDescription'),
    // A query-driven results page is never a stable canonical destination
    // for crawlers to index — the same content it can find already has its
    // own indexed detail/listing pages. `follow` so links out are still crawled.
    robots: { index: false, follow: true },
  })
}

const TYPE_ICON: Record<SearchResultType, typeof MapPin> = {
  accommodation: MapPin,
  trip: Mountain,
  trip_package: Route,
  merch: ShoppingBag,
  rental: Package,
  community_post: BookOpen,
}

function groupByType(results: SearchResult[]): Map<SearchResultType, SearchResult[]> {
  const order: SearchResultType[] = ['accommodation', 'trip', 'trip_package', 'merch', 'rental', 'community_post']
  const map = new Map<SearchResultType, SearchResult[]>()
  for (const type of order) map.set(type, [])
  for (const result of results) map.get(result.type)?.push(result)
  return map
}

export default async function SearchResultsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { q = '' } = await searchParams
  const ar = locale === 'ar'
  const [t, response] = await Promise.all([
    getTranslations({ locale, namespace: 'discovery' }),
    runSearch(q),
  ])
  const grouped = groupByType(response.results)

  const groupLabel = (type: SearchResultType) => t(`search.group.${type}`)

  return (
    <div>
      <Section tone="paper" size="sm">
        <h1 className="font-display text-2xl font-bold text-sea-900 md:text-3xl">
          {q ? t('search.resultsTitleFor', { query: q }) : t('search.resultsTitle')}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {q.trim().length < 2
            ? t('search.promptLonger')
            : t('search.resultsCount', { count: response.results.length, n: formatCount(response.results.length, locale) })}
        </p>
      </Section>

      {q.trim().length >= 2 && response.results.length === 0 && (
        <Section tone="sand" size="sm">
          <p className="text-sm text-ink-muted">{t('search.empty', { query: q })}</p>
          <p className="mt-1 text-xs text-ink-subtle">{t('search.emptyHint')}</p>
        </Section>
      )}

      {Array.from(grouped.entries()).map(([type, items]) => {
        if (items.length === 0) return null
        const Icon = TYPE_ICON[type]
        return (
          <Section key={type} tone="sand" size="sm">
            <SectionHeading title={groupLabel(type)} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((result) => {
                const title = ar ? result.title_ar || result.title_en : result.title_en || result.title_ar
                const description = ar
                  ? result.description_ar || result.description_en
                  : result.description_en || result.description_ar
                return (
                  <Link
                    key={`${result.type}:${result.id}`}
                    href={result.url}
                    className="flex items-center gap-3 rounded-2xl border-[1.5px] border-sand-300 bg-card p-3 transition-colors hover:border-sun-500"
                  >
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                      <Image src={result.image || NEUTRAL_MEDIA} alt={title} fill sizes="80px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-sea-900">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-sun-700" aria-hidden />
                        {title}
                      </p>
                      {description && <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{description}</p>}
                      {result.price != null && result.price > 0 && (
                        <p className="mt-1 text-xs font-semibold text-sea-700">
                          {t('search.from')} {formatAmount(result.price, locale)}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </Section>
        )
      })}
    </div>
  )
}
