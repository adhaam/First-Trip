import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'
import { V2_NAMESPACES } from '../messages/namespaces'

async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  const base = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>
  const namespaces = await Promise.all(
    V2_NAMESPACES.map(async (ns) => [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const),
  )
  const messages: Record<string, unknown> = { ...base }
  for (const [ns, value] of namespaces) {
    if (ns in base) throw new Error(`Message namespace "${ns}" collides with a legacy key in ${locale}.json`)
    messages[ns] = value
  }
  return messages
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'ar' | 'en')) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: await loadMessages(locale),
  }
})
