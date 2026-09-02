import { getTranslations } from 'next-intl/server'

export default async function Loading() {
  const t = await getTranslations('states')

  return (
    <div aria-busy="true" aria-label={t('loading')} className="container-main py-20">
      <span className="sr-only">{t('loading')}</span>
      <div className="animate-pulse">
        <div className="h-5 w-28 rounded bg-sand-300" />
        <div className="mt-5 h-11 max-w-xl rounded bg-sand-300" />
        <div className="mt-4 h-5 max-w-2xl rounded bg-sand-200" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="overflow-hidden border border-sand-300 bg-card pin-card">
              <div className="aspect-[3/2] bg-sand-300" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-2/3 rounded bg-sand-300" />
                <div className="h-4 rounded bg-sand-200" />
                <div className="h-4 w-4/5 rounded bg-sand-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
