-- 016_trip_categories.sql
-- Controlled Sinai Trip taxonomy. Additive only:
--   * new `trip_categories` table (6 seeded categories)
--   * new nullable `sinai_trips.trip_category_id` FK (ON DELETE SET NULL)
--   * existing `sinai_trips.category_ar` / `category_en` free-text columns are
--     kept untouched — several read paths still consume them directly, and the
--     admin trip editor will keep auto-populating them from the selected
--     category going forward (see SinaiTripManager.tsx).
--
-- The data-migration UPDATE below maps each of the 13 existing trips (as of
-- this migration's authoring) to the new taxonomy by explicit trip ID rather
-- than a blind keyword UPDATE, because a pure keyword pass produced one wrong
-- result worth recording:
--   "Sharm Night - Farsha Café & Old Market" contains "Night", which a naive
--   bedouin/night keyword rule would route to Bedouin & Night — but this trip
--   is urban Sharm nightlife (a café + old market visit), not a desert/bedouin
--   experience. It is manually mapped to City & Night Out instead. Every other
--   trip's mapping matched what keyword priority would have produced anyway.
-- Any Sinai Trip created after this migration starts out with
-- trip_category_id = NULL and must be assigned a category from the admin
-- dropdown (see SinaiTripManager.tsx) — there is no ongoing keyword fallback.

CREATE TABLE IF NOT EXISTS public.trip_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_categories_active ON public.trip_categories (is_active, sort_order);

ALTER TABLE public.trip_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trip_categories_public_read" ON public.trip_categories;
CREATE POLICY "trip_categories_public_read" ON public.trip_categories
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "trip_categories_service_role_all" ON public.trip_categories;
CREATE POLICY "trip_categories_service_role_all" ON public.trip_categories
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_trip_categories_updated_at ON public.trip_categories;
CREATE TRIGGER update_trip_categories_updated_at BEFORE UPDATE ON public.trip_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.trip_categories (slug, name_ar, name_en, sort_order) VALUES
  ('sea-snorkeling',   'البحر والسنوركلينج',              'Sea & Snorkeling',    0),
  ('desert-safari',    'الصحراء والسفاري',                'Desert & Safari',     1),
  ('mountains-hiking', 'الجبال والهايكنج',                'Mountains & Hiking',  2),
  ('bedouin-night',    'السهرات والتجارب البدوية',        'Bedouin & Night',     3),
  ('day-escapes',      'رحلات اليوم الواحد',              'Day Escapes',         4),
  ('city-night-out',   'جولات المدن والسهرات',            'City & Night Out',    5)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.sinai_trips
  ADD COLUMN IF NOT EXISTS trip_category_id UUID REFERENCES public.trip_categories(id) ON DELETE SET NULL;

-- ─── One-time data migration: map existing trips to the new taxonomy ───
DO $$
DECLARE
  sea_id      UUID := (SELECT id FROM public.trip_categories WHERE slug = 'sea-snorkeling');
  desert_id   UUID := (SELECT id FROM public.trip_categories WHERE slug = 'desert-safari');
  mountain_id UUID := (SELECT id FROM public.trip_categories WHERE slug = 'mountains-hiking');
  bedouin_id  UUID := (SELECT id FROM public.trip_categories WHERE slug = 'bedouin-night');
  day_id      UUID := (SELECT id FROM public.trip_categories WHERE slug = 'day-escapes');
  city_id     UUID := (SELECT id FROM public.trip_categories WHERE slug = 'city-night-out');
BEGIN
  -- Sea & Snorkeling
  UPDATE public.sinai_trips SET trip_category_id = sea_id
    WHERE id IN (
      '1fa8b6cd-5d4e-46f0-900f-e89fdde62f3e', -- Blue Hole, Ras Abu Galum & Blue Lagoon
      '1acaa6b6-220d-4526-8a93-399be830c68b', -- Evening Yacht Trip
      '5901179a-1c6e-4817-abd2-e20bbda5370a', -- Taba Full-Day Yacht Trip
      'eda327fa-4f5a-4973-9d45-a9f43c34260e', -- Morning Yacht Trip
      '5b26f7b0-4da7-4f8a-ba4a-556965efd55e'  -- Snorkeling at ThreePools
    ) AND trip_category_id IS NULL;

  -- Desert & Safari
  UPDATE public.sinai_trips SET trip_category_id = desert_id
    WHERE id IN (
      '16c71b36-e03f-41ce-bf2d-d6defb467b20', -- Sunrise Panorama Beach Buggy Safari
      '5d2a5b27-8bc8-44f7-a321-63d72c71160b'  -- Sunset Safari - Wadi Gnai & Three Pools
    ) AND trip_category_id IS NULL;

  -- Mountains & Hiking
  UPDATE public.sinai_trips SET trip_category_id = mountain_id
    WHERE id IN (
      '83e5c927-c892-4cf0-a45b-f903fe6c86e1'  -- Mount Sinai Sunrise Hike & St. Catherine
    ) AND trip_category_id IS NULL;

  -- Bedouin & Night
  UPDATE public.sinai_trips SET trip_category_id = bedouin_id
    WHERE id IN (
      'd7badef4-1737-4265-904a-fe36e1343f0d', -- Laguna Bonfire Night
      'b644169a-3a40-4d68-af8d-bd4287397c75', -- Wadi Ghazala Stargazing Night
      '2f6d2a6d-fdcc-4382-871d-66a47b63a452'  -- Jabal Al-Tawilat Night
    ) AND trip_category_id IS NULL;

  -- Day Escapes
  UPDATE public.sinai_trips SET trip_category_id = day_id
    WHERE id IN (
      '5d7995c2-6cc4-43c0-a866-1c7f697c3b96'  -- Wadi El Weshwash - Nuweiba Day Escape
    ) AND trip_category_id IS NULL;

  -- City & Night Out (manual override — see header comment)
  UPDATE public.sinai_trips SET trip_category_id = city_id
    WHERE id IN (
      'bded31f3-b639-4a69-9778-5d09a764f28b'  -- Sharm Night - Farsha Café & Old Market
    ) AND trip_category_id IS NULL;
END $$;
