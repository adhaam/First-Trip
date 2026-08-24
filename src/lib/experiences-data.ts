// ─── Signature Experiences: server-side data layer ───
// Service-role reads, same contract as `src/lib/data.ts` (never import from a
// 'use client' file). Availability is always derived from bookings — the
// number of taken spots is never stored on the date row.

import 'server-only'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase'
import {
  DEFAULT_EXPERIENCE_CATEGORIES,
  withAvailability,
  type Experience,
  type ExperienceCategory,
  type ExperienceDate,
  type ExperienceDateWithAvailability,
  type ExperienceWithDates,
} from './experiences'

function normalizeExperience(row: Record<string, unknown>): Experience {
  return {
    ...(row as unknown as Experience),
    // NUMERIC comes back from PostgREST as a string.
    price: Number(row.price ?? 0),
    itinerary: Array.isArray(row.itinerary) ? (row.itinerary as Experience['itinerary']) : [],
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
    included_ar: Array.isArray(row.included_ar) ? (row.included_ar as string[]) : [],
    included_en: Array.isArray(row.included_en) ? (row.included_en as string[]) : [],
    not_included_ar: Array.isArray(row.not_included_ar) ? (row.not_included_ar as string[]) : [],
    not_included_en: Array.isArray(row.not_included_en) ? (row.not_included_en as string[]) : [],
  }
}

function normalizeDate(row: Record<string, unknown>): ExperienceDate {
  return {
    ...(row as unknown as ExperienceDate),
    total_spots: Number(row.total_spots ?? 0),
    price_override: row.price_override == null ? null : Number(row.price_override),
  }
}

export async function getExperienceCategories(): Promise<ExperienceCategory[]> {
  if (!isSupabaseConfigured()) return DEFAULT_EXPERIENCE_CATEGORIES
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('getExperienceCategories error:', error)
    return DEFAULT_EXPERIENCE_CATEGORIES
  }
  return (data ?? []) as ExperienceCategory[]
}

/**
 * Spots taken per date, aggregated from non-cancelled bookings.
 * One query for all the ids we care about, so listing pages stay at O(1) round
 * trips regardless of how many experiences are published.
 */
async function getSpotsTakenByDate(dateIds: string[]): Promise<Map<string, number>> {
  const taken = new Map<string, number>()
  if (!dateIds.length) return taken
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_bookings')
    .select('experience_date_id, spots_requested, status')
    .in('experience_date_id', dateIds)
    .neq('status', 'cancelled')
  if (error) {
    console.error('getSpotsTakenByDate error:', error)
    return taken
  }
  for (const row of data ?? []) {
    const id = String(row.experience_date_id)
    taken.set(id, (taken.get(id) ?? 0) + Number(row.spots_requested ?? 0))
  }
  return taken
}

async function attachDates(experiences: Experience[]): Promise<ExperienceWithDates[]> {
  if (!experiences.length) return []
  const supabase = getSupabaseAdmin()
  const ids = experiences.map((e) => e.id)
  const { data, error } = await supabase
    .from('experience_dates')
    .select('*')
    .in('experience_id', ids)
    .order('start_date', { ascending: true })

  if (error) {
    console.error('attachDates error:', error)
    return experiences.map((e) => ({ ...e, dates: [] }))
  }

  const rawDates = (data ?? []).map((row) => normalizeDate(row as Record<string, unknown>))
  const taken = await getSpotsTakenByDate(rawDates.map((d) => d.id))
  const now = new Date()

  const byExperience = new Map<string, ExperienceDateWithAvailability[]>()
  for (const date of rawDates) {
    const enriched = withAvailability(date, taken.get(date.id) ?? 0, now)
    const list = byExperience.get(date.experience_id) ?? []
    list.push(enriched)
    byExperience.set(date.experience_id, list)
  }

  return experiences.map((e) => ({ ...e, dates: byExperience.get(e.id) ?? [] }))
}

/** Published experiences for the public listing page, with availability. */
export async function getPublishedExperiences(): Promise<ExperienceWithDates[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experiences')
    .select('*')
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getPublishedExperiences error:', error)
    return []
  }
  return attachDates((data ?? []).map((row) => normalizeExperience(row as Record<string, unknown>)))
}

export async function getExperienceBySlug(slug: string): Promise<ExperienceWithDates | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experiences')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('getExperienceBySlug error:', error)
    return null
  }
  if (!data) return null
  const [withDates] = await attachDates([normalizeExperience(data as Record<string, unknown>)])
  return withDates ?? null
}

/** Every experience (drafts included) for the admin dashboard. */
export async function getAllExperiences(): Promise<ExperienceWithDates[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experiences')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getAllExperiences error:', error)
    return []
  }
  return attachDates((data ?? []).map((row) => normalizeExperience(row as Record<string, unknown>)))
}

/** Availability for a single date — used by the booking endpoint. */
export async function getDateAvailability(
  dateId: string,
): Promise<ExperienceDateWithAvailability | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_dates')
    .select('*')
    .eq('id', dateId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('getDateAvailability error:', error)
    return null
  }
  const date = normalizeDate(data as Record<string, unknown>)
  const taken = await getSpotsTakenByDate([date.id])
  return withAvailability(date, taken.get(date.id) ?? 0)
}

export { normalizeExperience, normalizeDate, getSpotsTakenByDate }
