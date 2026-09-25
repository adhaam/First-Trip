-- 033_trip_category_tags.sql
-- Multi-tag trip taxonomy on top of trip_categories (WEEMAP V2 · M1).
--
-- WHY
--   V2 presents trips by intent (Sea, Desert & Safari, Mountains & Hiking,
--   Culture & Bedouin, Night Experiences, Day Escapes) and a trip may belong
--   to several (a Bedouin dinner in the desert is Culture AND Night). The
--   single trip_category_id FK (migration 016) cannot express that.
--
-- CONTRACT
--   * sinai_trips.trip_category_id stays the PRIMARY category (unchanged).
--   * sinai_trip_category_tags holds every category a trip belongs to,
--     including the primary one. Read via src/lib/trip-categories.ts.
--   * The free-text sinai_trips.category_ar / category_en columns are legacy
--     display copies; the structured category wins wherever both exist.
--   * Two V2 categories are added INACTIVE so nothing public changes until
--     operations tag trips and M2 presents the new taxonomy. Existing
--     categories and their names are left untouched.
--
-- Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.sinai_trip_category_tags (
  trip_id     UUID NOT NULL REFERENCES public.sinai_trips(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.trip_categories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_sinai_trip_category_tags_category
  ON public.sinai_trip_category_tags (category_id);

ALTER TABLE public.sinai_trip_category_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sinai_trip_category_tags_public_read" ON public.sinai_trip_category_tags;
CREATE POLICY "sinai_trip_category_tags_public_read" ON public.sinai_trip_category_tags
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "sinai_trip_category_tags_service_role_all" ON public.sinai_trip_category_tags;
CREATE POLICY "sinai_trip_category_tags_service_role_all" ON public.sinai_trip_category_tags
  FOR ALL USING (auth.role() = 'service_role');

-- Every trip's primary category is also one of its tags.
INSERT INTO public.sinai_trip_category_tags (trip_id, category_id)
SELECT id, trip_category_id FROM public.sinai_trips WHERE trip_category_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.trip_categories (slug, name_ar, name_en, sort_order, is_active) VALUES
  ('culture-bedouin',   'الثقافة والتجارب البدوية', 'Culture & Bedouin', 6, false),
  ('night-experiences', 'تجارب ليلية',              'Night Experiences', 7, false)
ON CONFLICT (slug) DO NOTHING;
