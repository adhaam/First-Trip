-- ─── Migration 016: Signature Experiences ───
--
-- A curated, small-group product line that sits beside the existing
-- `sinai_trips` day-trip catalogue. Deliberately a separate set of tables:
--
--   * `trip_dates` already exists and means something else entirely
--     (the Sunday/Thursday departure calendar for Dahab packages), so the
--     per-experience departures live in `experience_dates`.
--   * `bookings` already exists and is the package/accommodation booking
--     record with its own pricing columns, so experience requests live in
--     `experience_bookings`.
--
-- Bilingual columns follow the project convention (`*_ar` / `*_en`) and list
-- columns use TEXT[] like `sinai_trips.includes_ar`.

-- ─── Categories (seeded defaults + admin-added custom tags) ───
CREATE TABLE IF NOT EXISTS public.experience_categories (
  slug        TEXT PRIMARY KEY,
  label_ar    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.experience_categories (slug, label_ar, label_en, sort_order) VALUES
  ('diving',        'غوص',           'Diving',           10),
  ('kite-surf',     'كايت سيرف',      'Kite Surf',        20),
  ('yoga',          'يوجا',           'Yoga',             30),
  ('photography',   'تصوير',          'Photography',      40),
  ('hiking',        'هايكنج وتخييم',  'Hiking & Camping', 50),
  ('adventure',     'مغامرة',         'Adventure',        60),
  ('solo-friendly', 'مناسب للسولو',   'Solo Friendly',    70),
  ('other',         'أخرى',           'Other',            80)
ON CONFLICT (slug) DO NOTHING;

-- ─── Experiences ───
CREATE TABLE IF NOT EXISTS public.experiences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT UNIQUE NOT NULL,
  title_ar                TEXT NOT NULL,
  title_en                TEXT NOT NULL,
  category                TEXT NOT NULL DEFAULT 'other'
                            REFERENCES public.experience_categories(slug) ON UPDATE CASCADE,
  partner_name            TEXT NOT NULL DEFAULT '',
  partner_description_ar  TEXT NOT NULL DEFAULT '',
  partner_description_en  TEXT NOT NULL DEFAULT '',
  short_description_ar    TEXT NOT NULL DEFAULT '',
  short_description_en    TEXT NOT NULL DEFAULT '',
  full_description_ar     TEXT NOT NULL DEFAULT '',
  full_description_en     TEXT NOT NULL DEFAULT '',
  included_ar             TEXT[] NOT NULL DEFAULT '{}',
  included_en             TEXT[] NOT NULL DEFAULT '{}',
  not_included_ar         TEXT[] NOT NULL DEFAULT '{}',
  not_included_en         TEXT[] NOT NULL DEFAULT '{}',
  -- [{ day, title_ar, title_en, description_ar, description_en }]
  itinerary               JSONB NOT NULL DEFAULT '[]'::jsonb,
  hero_image              TEXT NOT NULL DEFAULT '',
  gallery                 TEXT[] NOT NULL DEFAULT '{}',
  -- Optional admin override; when blank the UI derives duration from the date.
  duration_ar             TEXT NOT NULL DEFAULT '',
  duration_en             TEXT NOT NULL DEFAULT '',
  price                   NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiences_status   ON public.experiences (status);
CREATE INDEX IF NOT EXISTS idx_experiences_category ON public.experiences (category);
CREATE INDEX IF NOT EXISTS idx_experiences_sort     ON public.experiences (sort_order ASC, created_at DESC);

-- Gallery is capped at 6 images by product decision; enforced in the DB too so
-- a stray API call cannot blow past it.
ALTER TABLE public.experiences DROP CONSTRAINT IF EXISTS experiences_gallery_max;
ALTER TABLE public.experiences
  ADD CONSTRAINT experiences_gallery_max
  CHECK (array_length(gallery, 1) IS NULL OR array_length(gallery, 1) <= 6);

-- ─── Scheduled departures ───
CREATE TABLE IF NOT EXISTS public.experience_dates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  total_spots    INTEGER NOT NULL DEFAULT 10 CHECK (total_spots >= 0),
  -- Sold-out is DERIVED from bookings and never stored. `status` covers the
  -- cancelled case and `is_open` is the admin's manual close switch.
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  is_open        BOOLEAN NOT NULL DEFAULT true,
  -- Per-date price override; NULL falls back to experiences.price.
  price_override NUMERIC(10,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT experience_dates_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_experience_dates_experience ON public.experience_dates (experience_id, start_date ASC);
CREATE INDEX IF NOT EXISTS idx_experience_dates_start      ON public.experience_dates (start_date ASC);

-- ─── Booking requests ───
CREATE TABLE IF NOT EXISTS public.experience_bookings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id      UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  experience_date_id UUID NOT NULL REFERENCES public.experience_dates(id) ON DELETE CASCADE,
  customer_id        UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  full_name          TEXT NOT NULL,
  phone              TEXT NOT NULL,
  email              TEXT NOT NULL DEFAULT '',
  spots_requested    INTEGER NOT NULL DEFAULT 1 CHECK (spots_requested >= 1),
  notes              TEXT NOT NULL DEFAULT '',
  -- Server-derived at insert time (price x spots); never trusted from client.
  quoted_price       NUMERIC(10,2),
  currency           TEXT NOT NULL DEFAULT 'EGP',
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  source             TEXT NOT NULL DEFAULT 'website',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experience_bookings_date   ON public.experience_bookings (experience_date_id);
CREATE INDEX IF NOT EXISTS idx_experience_bookings_exp    ON public.experience_bookings (experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_bookings_status ON public.experience_bookings (status);

-- ─── Availability view ───
-- Pending AND confirmed bookings both hold a spot; cancelled ones release it.
CREATE OR REPLACE VIEW public.experience_date_availability AS
SELECT
  d.id AS experience_date_id,
  d.experience_id,
  d.start_date,
  d.end_date,
  d.total_spots,
  d.status,
  d.is_open,
  d.price_override,
  COALESCE(b.spots_taken, 0)::int AS spots_taken,
  GREATEST(d.total_spots - COALESCE(b.spots_taken, 0), 0)::int AS spots_remaining
FROM public.experience_dates d
LEFT JOIN (
  SELECT experience_date_id, SUM(spots_requested) AS spots_taken
  FROM public.experience_bookings
  WHERE status <> 'cancelled'
  GROUP BY experience_date_id
) b ON b.experience_date_id = d.id;

-- ─── updated_at triggers (function hardened in migration 009) ───
DROP TRIGGER IF EXISTS update_experiences_updated_at ON public.experiences;
CREATE TRIGGER update_experiences_updated_at BEFORE UPDATE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_experience_dates_updated_at ON public.experience_dates;
CREATE TRIGGER update_experience_dates_updated_at BEFORE UPDATE ON public.experience_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_experience_bookings_updated_at ON public.experience_bookings;
CREATE TRIGGER update_experience_bookings_updated_at BEFORE UPDATE ON public.experience_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ───
-- Every read/write in this app goes through the service-role client behind
-- `requireAdmin`, so these policies are defence in depth for the anon key.
ALTER TABLE public.experience_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_dates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_bookings   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read experience categories" ON public.experience_categories;
CREATE POLICY "Public can read experience categories" ON public.experience_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can read published experiences" ON public.experiences;
CREATE POLICY "Public can read published experiences" ON public.experiences
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Public can read experience dates" ON public.experience_dates;
CREATE POLICY "Public can read experience dates" ON public.experience_dates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_id AND e.status = 'published')
  );

-- Booking rows carry customer contact details: no public SELECT, insert only
-- (and the app inserts server-side anyway).
DROP POLICY IF EXISTS "Anyone can request an experience booking" ON public.experience_bookings;
CREATE POLICY "Anyone can request an experience booking" ON public.experience_bookings
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage experience categories" ON public.experience_categories;
CREATE POLICY "Admins can manage experience categories" ON public.experience_categories
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage experiences" ON public.experiences;
CREATE POLICY "Admins can manage experiences" ON public.experiences
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage experience dates" ON public.experience_dates;
CREATE POLICY "Admins can manage experience dates" ON public.experience_dates
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage experience bookings" ON public.experience_bookings;
CREATE POLICY "Admins can manage experience bookings" ON public.experience_bookings
  FOR ALL USING (auth.role() = 'authenticated');
