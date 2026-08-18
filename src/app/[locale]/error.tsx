'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const t = useTranslations('states')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="container-main flex min-h-[65svh] items-center justify-center py-20 text-center">
      <div className="max-w-lg">
        <AlertCircle className="mx-auto h-9 w-9 text-sun-600" aria-hidden="true" />
        <h1 className="mt-5 font-display text-3xl font-bold text-sea-900">{t('unavailableTitle')}</h1>
        <p className="mt-3 leading-7 text-sea-900/65">{t('unavailableText')}</p>
        <button type="button" onClick={retry} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sun-500 px-6 font-semibold text-white hover:bg-sun-600">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('retry')}
        </button>
      </div>
    </main>
  )
}
