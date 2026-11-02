import { revalidatePath } from 'next/cache'

/**
 * Admin saves used to wait out the 60s ISR window on every public surface
 * that shows hotels. Call this after a successful create/update/delete.
 *
 * `revalidatePath` works on the route FILE structure, so the `[locale]`
 * segment is part of the pattern: one call covers Arabic (served unprefixed,
 * `localePrefix: 'as-needed'`) and English (`/en/...`). In a Route Handler it
 * only marks the entries stale; they re-render on the next visit.
 */
export function revalidateAccommodationSurfaces(id?: string) {
  try {
    revalidatePath('/[locale]', 'page') // home - featured stays lineup
    revalidatePath('/[locale]/book-dahab', 'page') // Dahab stays list
    revalidatePath('/[locale]/book-dahab/[id]', 'page') // every hotel detail (covers `id`)
    revalidatePath('/[locale]/plan', 'page') // Build Your Trip catalogue
    if (id) {
      // Also hit this hotel's literal route (internal /ar prefix = the unprefixed Arabic URL) in both locales.
      revalidatePath(`/ar/book-dahab/${id}`)
      revalidatePath(`/en/book-dahab/${id}`)
    }
  } catch (err) {
    // Never fail a successful DB write because the cache purge hiccuped;
    // the 60s ISR window still brings the public pages up to date.
    console.error('revalidate accommodation surfaces failed:', err)
  }
}
