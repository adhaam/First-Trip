import type { Experience, ExperienceCategory, ExperienceDate } from '@/lib/types'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { toPublicPartners } from '@/lib/experience-pricing'

/** Published categories only, for the public taxonomy grid / filters. */
export async function getExperienceCategories(): Promise<ExperienceCategory[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('getExperienceCategories error:', error)
    return []
  }
  return (data || []) as ExperienceCategory[]
}

const EXPERIENCE_SELECT = '*, experience_dates(id, experience_id, start_date, end_date, total_spots, status, is_open, price_override), category_info:experience_categories(slug, label_ar, label_en, description_ar, description_en, is_active, sort_order)'

type ExperienceRow = Experience & { experience_dates?: ExperienceDate[] }

function mapExperience(row: ExperienceRow): Experience {
  const dates = (row.experience_dates || []).filter((d) => d.status === 'open')
  return { ...row, dates }
}

/** Published experiences only — for the landing page grid. No partner/trip joins (kept light for a list view). */
export async function getExperiences(): Promise<Experience[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('getExperiences error:', error)
    return []
  }
  return ((data || []) as unknown as ExperienceRow[]).map(mapExperience)
}

/** Full detail for one published experience — includes public-safe partner credit and linked trip names. */
export async function getExperienceBySlug(slug: string): Promise<Experience | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error || !data) return null

  const experience = mapExperience(data as unknown as ExperienceRow)

  const [{ data: partnerLinks }, { data: tripLinks }] = await Promise.all([
    supabase
      .from('experience_partner_links')
      .select('sort_order, experience_partners(id, name, public_description_ar, public_description_en, public_credit_enabled)')
      .eq('experience_id', experience.id)
      .order('sort_order'),
    supabase
      .from('experience_trips')
      .select('sort_order, sinai_trips(id, name_ar, name_en, images)')
      .eq('experience_id', experience.id)
      .order('sort_order'),
  ])

  const partnerRows = (partnerLinks || [])
    .map((l) => l.experience_partners)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  experience.partners = toPublicPartners(partnerRows as unknown as Parameters<typeof toPublicPartners>[0])

  experience.trips = ((tripLinks || [])
    .map((l) => l.sinai_trips)
    .filter((t): t is NonNullable<typeof t> => Boolean(t)) as unknown) as Experience['trips']

  return experience
}
