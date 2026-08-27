-- 018_signature_experiences.sql
-- Reconciles the pre-existing, untracked `experiences` / `experience_categories`
-- / `experience_dates` / `experience_bookings` tables (confirmed live in
-- production with 0/8/0/0 rows respectively — no real experience or booking
-- data at risk) into this repo's migration history, and extends them into
-- the Signature Experiences product.
--
-- Signature Experiences are NOT Trip Packages. Pricing here (`experiences.price`
-- + optional `experience_dates.price_override` + `discount_*`) is entirely
-- Admin-managed and independent — nothing in this migration or the
-- application code that reads it may derive a Signature price from
-- `sinai_trips.package_price` or Trip Package totals.
--
-- Safe to run against a database where these tables already exist (every
-- CREATE TABLE is IF NOT EXISTS; every column addition is ADD COLUMN IF NOT
-- EXISTS) or one that has never seen them (fresh install). Does not drop or
-- rename any existing table or column. The only destructive-looking
-- statement is the DELETE of the old 8 seeded experience_categories rows in
-- part 4 below — safe because zero `experiences` rows reference them (FK
-- would otherwise block it), and it's immediately followed by re-seeding
-- the real taxonomy.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Reconcile existing tables (no-op if already present in production)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.experience_categories (
  slug        TEXT PRIMARY KEY,
  label_ar    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.experiences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  title_ar                TEXT NOT NULL,
  title_en                TEXT NOT NULL,
  category                TEXT DEFAULT 'other' REFERENCES public.experience_categories(slug),
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
  itinerary               JSONB NOT NULL DEFAULT '[]',
  hero_image              TEXT NOT NULL DEFAULT '',
  gallery                 TEXT[] NOT NULL DEFAULT '{}',
  duration_ar             TEXT NOT NULL DEFAULT '',
  duration_en             TEXT NOT NULL DEFAULT '',
  price                   NUMERIC NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  discount_value          NUMERIC,
  discount_type           TEXT CHECK (discount_type IN ('amount', 'percentage')),
  discount_label          TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experiences_gallery_max CHECK (array_length(gallery, 1) IS NULL OR array_length(gallery, 1) <= 6)
);

CREATE TABLE IF NOT EXISTS public.experience_dates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  total_spots  INTEGER NOT NULL DEFAULT 10 CHECK (total_spots >= 0),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  is_open      BOOLEAN NOT NULL DEFAULT true,
  price_override NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT experience_dates_range CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.experience_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id       UUID REFERENCES public.experiences(id) ON DELETE SET NULL,
  experience_date_id  UUID REFERENCES public.experience_dates(id) ON DELETE SET NULL,
  customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  phone               TEXT NOT NULL,
  email               TEXT NOT NULL DEFAULT '',
  spots_requested      INTEGER NOT NULL DEFAULT 1 CHECK (spots_requested >= 1),
  notes               TEXT NOT NULL DEFAULT '',
  quoted_price        NUMERIC,
  currency            TEXT NOT NULL DEFAULT 'EGP',
  status              TEXT NOT NULL DEFAULT 'pending',
  source              TEXT NOT NULL DEFAULT 'website',
  discount_value       NUMERIC,
  discount_type        TEXT CHECK (discount_type IN ('amount', 'percentage')),
  payment_status       TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  amount_paid          NUMERIC NOT NULL DEFAULT 0,
  payment_channel      TEXT CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  payment_received_by  TEXT,
  payment_date         TIMESTAMPTZ,
  payment_notes        TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Extend experience_categories — admin-manageable, bilingual descriptions
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experience_categories
  ADD COLUMN IF NOT EXISTS description_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Extend experiences — badge, featured, starting-from price presentation
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS badge_ar             TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge_en             TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS featured             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starting_from_price  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.experiences.starting_from_price IS
  'When true, the public price display reads "From {price}" instead of a flat final price.';
COMMENT ON COLUMN public.experiences.price IS
  'Independent, Admin-managed final price. NEVER derived from sinai_trips.package_price or any Trip Package total, even when experience_trips links related trips.';

-- A published experience previously always needed a category (default
-- 'other', which this migration removes below); category is now optional at
-- the schema level so a draft can be created before a category is chosen —
-- validated as required-before-publish at the application layer instead.
ALTER TABLE public.experiences ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.experiences ALTER COLUMN category DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Replace the old seeded categories with the Signature taxonomy
--    (safe: 0 rows in `experiences` reference the old slugs)
-- ─────────────────────────────────────────────────────────────────────────
DELETE FROM public.experience_categories
  WHERE slug IN ('diving', 'kite-surf', 'yoga', 'photography', 'hiking', 'adventure', 'solo-friendly', 'other');

INSERT INTO public.experience_categories (slug, label_ar, label_en, description_ar, description_en, sort_order) VALUES
  ('honeymoon', 'شهر العسل في سيناء', 'Honeymoon in Sinai',
    'وقت هادي، أماكن مختارة وتجارب معمولة للاتنين. تجربة شهر عسل نرتب تفاصيلها بحيث تفضلوا مركزين في الرحلة، مش في تنظيمها.',
    'Quiet moments, carefully chosen places and experiences designed for two. A Sinai honeymoon arranged so you can focus on the trip rather than organizing it.',
    0),
  ('dive-journey', 'رحلة الغوص المتكاملة', 'Dive Journey',
    'تجربة غوص كاملة ممكن تجمع بين التدريب، الكورس، الغطسات والإقامة المناسبة بالتعاون مع شركاء متخصصين — حسب مستواك والمدة اللي عايزها.',
    'A complete diving experience that can combine training, courses, dives and the right stay with specialist partners — shaped around your level and available time.',
    1),
  ('kite-escape', 'تجربة الكايت سيرف', 'Kite Escape',
    'كام يوم حوالين الريح والبحر. جلسات كايت سيرف وتجربة مرتبة مع شركاء متخصصين، ومعاها باقي تفاصيل الرحلة بالشكل اللي يناسب مستواك.',
    'A few days built around wind and water. Kite sessions with specialist partners, combined with the rest of the trip around your level and pace.',
    2),
  ('hike-camp-adventure', 'هايك، كامب ومغامرة', 'Hike, Camp & Adventure',
    'للي عايز يشوف سيناء من جوه. مسارات، جبال، كامب وتجارب مغامرة متجمعة في رحلة واحدة بدل ما ترتب كل جزء لوحده.',
    'For travelers who want to experience Sinai from the inside — trails, mountains, camping and adventure brought together into one journey.',
    3),
  ('nuweiba-escape', 'تجربة نويبع', 'Nuweiba Escape',
    'نويبع على مهل. بحر، جبال، وديان وأماكن مختارة بعيد عن الزحمة، في تجربة نرتبها على حسب عدد الأيام والطريقة اللي تحب تعيش بيها المكان.',
    'Nuweiba at a slower pace — sea, mountains, wadis and carefully chosen places away from the crowds, shaped around the time you have and how you want to experience it.',
    4),
  ('build-your-signature', 'ابنِ تجربتك', 'Build Your Signature',
    'عندك مناسبة، فكرة أو شكل رحلة معين في دماغك؟ قول لنا إنت عايز تعيش سيناء إزاي، وإحنا نركّب التجربة حواليك بدل ما تختار من باكدج جاهزة.',
    'Have an occasion, an idea or a completely different kind of trip in mind? Tell us how you want to experience Sinai and we''ll shape the journey around you instead of forcing you into a ready-made package.',
    5)
ON CONFLICT (slug) DO UPDATE SET
  label_ar = EXCLUDED.label_ar, label_en = EXCLUDED.label_en,
  description_ar = EXCLUDED.description_ar, description_en = EXCLUDED.description_en,
  sort_order = EXCLUDED.sort_order;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Experience Partners — public/private split enforced by RLS, not just
--    application code (see part 8: no public SELECT policy on this table
--    or its link table at all; public pages only ever see partner info via
--    the server-side filtered projection built into the experience detail
--    fetcher, never by querying these tables directly).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience_partners (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  service_category       TEXT NOT NULL DEFAULT '',
  public_description_ar  TEXT NOT NULL DEFAULT '',
  public_description_en  TEXT NOT NULL DEFAULT '',
  contact_name           TEXT NOT NULL DEFAULT '',
  contact_phone          TEXT NOT NULL DEFAULT '',
  contact_email          TEXT NOT NULL DEFAULT '',
  internal_notes         TEXT NOT NULL DEFAULT '',
  public_credit_enabled  BOOLEAN NOT NULL DEFAULT false,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.experience_partners.contact_name IS 'INTERNAL ONLY — never returned from a public API/page.';
COMMENT ON COLUMN public.experience_partners.contact_phone IS 'INTERNAL ONLY — never returned from a public API/page.';
COMMENT ON COLUMN public.experience_partners.contact_email IS 'INTERNAL ONLY — never returned from a public API/page.';
COMMENT ON COLUMN public.experience_partners.internal_notes IS 'INTERNAL ONLY — never returned from a public API/page.';
COMMENT ON COLUMN public.experience_partners.public_credit_enabled IS
  'Only when true may name + public_description be shown on a public experience page. Contact fields and internal_notes are NEVER public regardless of this flag.';

CREATE TABLE IF NOT EXISTS public.experience_partner_links (
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  partner_id    UUID NOT NULL REFERENCES public.experience_partners(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (experience_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_experience_partner_links_experience ON public.experience_partner_links (experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_partner_links_partner ON public.experience_partner_links (partner_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Optional linked Sinai Trips (informational only — never affects price)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience_trips (
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  trip_id       UUID NOT NULL REFERENCES public.sinai_trips(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (experience_id, trip_id)
);
CREATE INDEX IF NOT EXISTS idx_experience_trips_experience ON public.experience_trips (experience_id);

COMMENT ON TABLE public.experience_trips IS
  'Informational link to existing Sinai Trips referenced by a Signature Experience. Never read by any pricing path — experiences.price is independent and Admin-managed.';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. experience_bookings → Signature request/booking record
--    (supports both a request against a published Experience, and a fully
--    custom "Build Your Signature" request with no experience/date at all)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experience_bookings
  ALTER COLUMN experience_id DROP NOT NULL,
  ALTER COLUMN experience_date_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_custom_request     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_date        DATE,
  ADD COLUMN IF NOT EXISTS interests             TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration_preference   TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.experience_bookings.is_custom_request IS
  'true = submitted via "Build Your Signature" with no predefined experience_id.';
COMMENT ON COLUMN public.experience_bookings.preferred_date IS
  'Free-form preferred date — used instead of experience_date_id when the request has no fixed scheduled date (always the case for custom requests, optionally the case for a published-experience request too).';

-- Practical Admin status vocabulary, replacing the old
-- pending/confirmed/cancelled-only set.
ALTER TABLE public.experience_bookings DROP CONSTRAINT IF EXISTS experience_bookings_status_check;
ALTER TABLE public.experience_bookings ADD CONSTRAINT experience_bookings_status_check
  CHECK (status = ANY (ARRAY['new', 'contacted', 'planning', 'confirmed', 'completed', 'cancelled']));
ALTER TABLE public.experience_bookings ALTER COLUMN status SET DEFAULT 'new';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. RLS — realign every experience_* table to this repo's actual admin
--    architecture. The app has no Supabase Auth sessions anywhere; every
--    admin route authenticates via a custom cookie (requireAdmin()) and
--    always talks to Supabase through the service-role key. The old
--    `auth.role() = 'authenticated'` policies here were dead — only the
--    service-role bypass ever actually authorized a write. Replaced with
--    the `service_role` convention used by every other table in this repo
--    (see trip_categories, trip_packages, commerce_categories, etc.).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.experience_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage experience categories" ON public.experience_categories;
DROP POLICY IF EXISTS "Public can read experience categories" ON public.experience_categories;
DROP POLICY IF EXISTS "experience_categories_service_role_all" ON public.experience_categories;
CREATE POLICY "experience_categories_service_role_all" ON public.experience_categories
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "experience_categories_public_read" ON public.experience_categories;
CREATE POLICY "experience_categories_public_read" ON public.experience_categories
  FOR SELECT USING (is_active = true);

ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage experiences" ON public.experiences;
DROP POLICY IF EXISTS "Public can read published experiences" ON public.experiences;
DROP POLICY IF EXISTS "experiences_service_role_all" ON public.experiences;
CREATE POLICY "experiences_service_role_all" ON public.experiences
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "experiences_public_read" ON public.experiences;
CREATE POLICY "experiences_public_read" ON public.experiences
  FOR SELECT USING (status = 'published');

ALTER TABLE public.experience_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage experience dates" ON public.experience_dates;
DROP POLICY IF EXISTS "Public can read experience dates" ON public.experience_dates;
DROP POLICY IF EXISTS "experience_dates_service_role_all" ON public.experience_dates;
CREATE POLICY "experience_dates_service_role_all" ON public.experience_dates
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "experience_dates_public_read" ON public.experience_dates;
CREATE POLICY "experience_dates_public_read" ON public.experience_dates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.experiences e WHERE e.id = experience_dates.experience_id AND e.status = 'published')
  );

ALTER TABLE public.experience_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage experience bookings" ON public.experience_bookings;
DROP POLICY IF EXISTS "Anyone can request an experience booking" ON public.experience_bookings;
DROP POLICY IF EXISTS "experience_bookings_service_role_all" ON public.experience_bookings;
CREATE POLICY "experience_bookings_service_role_all" ON public.experience_bookings
  FOR ALL USING (auth.role() = 'service_role');
-- Public INSERT stays (a customer submits a request without being "admin"),
-- but only via the server-side API route (which uses the service-role
-- client itself) — this policy is defense in depth, not the primary gate.
DROP POLICY IF EXISTS "experience_bookings_public_insert" ON public.experience_bookings;
CREATE POLICY "experience_bookings_public_insert" ON public.experience_bookings
  FOR INSERT WITH CHECK (true);

ALTER TABLE public.experience_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "experience_partners_service_role_all" ON public.experience_partners;
CREATE POLICY "experience_partners_service_role_all" ON public.experience_partners
  FOR ALL USING (auth.role() = 'service_role');
-- Deliberately NO public SELECT policy — see table comment above.

ALTER TABLE public.experience_partner_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "experience_partner_links_service_role_all" ON public.experience_partner_links;
CREATE POLICY "experience_partner_links_service_role_all" ON public.experience_partner_links
  FOR ALL USING (auth.role() = 'service_role');
-- Deliberately NO public SELECT policy — same reasoning as experience_partners.

ALTER TABLE public.experience_trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "experience_trips_service_role_all" ON public.experience_trips;
CREATE POLICY "experience_trips_service_role_all" ON public.experience_trips
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "experience_trips_public_read" ON public.experience_trips;
CREATE POLICY "experience_trips_public_read" ON public.experience_trips
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 9. updated_at triggers (experiences/experience_dates/experience_bookings
--    already had these live — recreated here idempotently for tracking;
--    experience_categories/experience_partners are new for this trigger)
-- ─────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_experience_categories_updated_at ON public.experience_categories;
CREATE TRIGGER update_experience_categories_updated_at BEFORE UPDATE ON public.experience_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_experiences_updated_at ON public.experiences;
CREATE TRIGGER update_experiences_updated_at BEFORE UPDATE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_experience_dates_updated_at ON public.experience_dates;
CREATE TRIGGER update_experience_dates_updated_at BEFORE UPDATE ON public.experience_dates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_experience_bookings_updated_at ON public.experience_bookings;
CREATE TRIGGER update_experience_bookings_updated_at BEFORE UPDATE ON public.experience_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_experience_partners_updated_at ON public.experience_partners;
CREATE TRIGGER update_experience_partners_updated_at BEFORE UPDATE ON public.experience_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Indexes (reconciled/added)
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_experience_categories_active ON public.experience_categories (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON public.experiences (status);
CREATE INDEX IF NOT EXISTS idx_experiences_category ON public.experiences (category);
CREATE INDEX IF NOT EXISTS idx_experiences_sort ON public.experiences (sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experience_dates_experience ON public.experience_dates (experience_id, start_date);
CREATE INDEX IF NOT EXISTS idx_experience_dates_start ON public.experience_dates (start_date);
CREATE INDEX IF NOT EXISTS idx_experience_bookings_exp ON public.experience_bookings (experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_bookings_date ON public.experience_bookings (experience_date_id);
CREATE INDEX IF NOT EXISTS idx_experience_bookings_status ON public.experience_bookings (status);
