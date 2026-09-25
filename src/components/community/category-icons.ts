import { BookOpen, Compass, Gem, Landmark, MapPin, Mountain, Route, Waves } from 'lucide-react'
import type { PostCategory } from '@/lib/types'

/**
 * One glyph per PostCategory — kept exhaustive (not Partial) so a newly
 * added category can't silently fall back to a generic icon without a
 * deliberate choice being made here. Shared by the index cards, the article
 * page's category chip, and the related-posts rail.
 */
export const COMMUNITY_CATEGORY_ICONS: Record<PostCategory, typeof BookOpen> = {
  stories: BookOpen,
  'dahab-guide': MapPin,
  'sinai-guide': Compass,
  'hidden-gems': Gem,
  diving: Waves,
  freediving: Waves,
  watersports: Waves,
  climbing: Mountain,
  hiking: Mountain,
  'advanced-adventure': Mountain,
  history: Landmark,
  culture: Landmark,
  itineraries: Route,
  blog: BookOpen,
}
