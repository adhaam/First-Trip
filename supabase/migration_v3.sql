-- ═══════════════ First Trip — Migration v3 ═══════════════
-- Run this in the Supabase SQL Editor AFTER migration_v2.sql.
-- Safe to re-run (everything is IF NOT EXISTS / ON CONFLICT DO NOTHING).
--
-- What this adds:
--   1. transfer_settings              — base Cairo price per transfer type (bus / hiace)
--   2. transfer_governorate_pricing   — per-governorate SURCHARGE on top of Cairo, per type
--   3. testimonials                   — customer reviews managed from the dashboard
--   4. bookings                       — extra columns so transfer bookings can actually be stored


-- ─── 1. Transfer settings (base price per transfer type) ───
-- base_price is ALWAYS: Cairo, ONE direction, PER PERSON.
-- A round trip is base_price x 2 (computed in the app, never stored doubled).
CREATE TABLE IF NOT EXISTS transfer_settings (
  transfer_type TEXT PRIMARY KEY CHECK (transfer_type IN ('package_bus', 'hiace')),
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  vehicle_ar    TEXT NOT NULL DEFAULT '',
  vehicle_en    TEXT NOT NULL DEFAULT '',
  base_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN transfer_settings.base_price IS
  'Cairo price, ONE direction, per person. Round trip = base_price * 2.';


-- ─── 2. Per-governorate surcharge, separate per transfer type ───
-- price_surcharge is added ON TOP of transfer_settings.base_price for one direction.
-- e.g. bus base 400 + Alexandria surcharge 50 => 450 per person one way, 900 round trip.
CREATE TABLE IF NOT EXISTS transfer_governorate_pricing (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_type    TEXT NOT NULL REFERENCES transfer_settings(transfer_type) ON DELETE CASCADE,
  governorate_code TEXT NOT NULL,
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  price_surcharge  NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transfer_type, governorate_code)
);

CREATE INDEX IF NOT EXISTS idx_transfer_gov_type
  ON transfer_governorate_pricing(transfer_type, is_active);


-- ─── 3. Testimonials ───
CREATE TABLE IF NOT EXISTS testimonials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  text_ar      TEXT NOT NULL DEFAULT '',
  text_en      TEXT NOT NULL DEFAULT '',
  rating       INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  avatar_url   TEXT,
  trip_ar      TEXT NOT NULL DEFAULT '',
  trip_en      TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT 'facebook',
  source_url   TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_published
  ON testimonials(is_published, sort_order);


-- ─── 4. bookings: columns needed to store transfer bookings ───
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transfer_type      TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transfer_direction TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_date        DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nights             INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_transfer_type_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_transfer_type_check
      CHECK (transfer_type IS NULL OR transfer_type IN ('package_bus', 'hiace'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_transfer_direction_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_transfer_direction_check
      CHECK (transfer_direction IS NULL OR transfer_direction IN ('to_dahab', 'from_dahab', 'round_trip'));
  END IF;
END $$;


-- ─── 5. updated_at triggers ───
DROP TRIGGER IF EXISTS update_transfer_settings_updated_at ON transfer_settings;
CREATE TRIGGER update_transfer_settings_updated_at BEFORE UPDATE ON transfer_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transfer_gov_updated_at ON transfer_governorate_pricing;
CREATE TRIGGER update_transfer_gov_updated_at BEFORE UPDATE ON transfer_governorate_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_testimonials_updated_at ON testimonials;
CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON testimonials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── 6. Row Level Security ───
ALTER TABLE transfer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_governorate_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read transfer settings" ON transfer_settings;
CREATE POLICY "Public can read transfer settings" ON transfer_settings
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage transfer settings" ON transfer_settings;
CREATE POLICY "Admins can manage transfer settings" ON transfer_settings
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read transfer governorate pricing" ON transfer_governorate_pricing;
CREATE POLICY "Public can read transfer governorate pricing" ON transfer_governorate_pricing
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage transfer governorate pricing" ON transfer_governorate_pricing;
CREATE POLICY "Admins can manage transfer governorate pricing" ON transfer_governorate_pricing
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read published testimonials" ON testimonials;
CREATE POLICY "Public can read published testimonials" ON testimonials
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage testimonials" ON testimonials;
CREATE POLICY "Admins can manage testimonials" ON testimonials
  FOR ALL USING (auth.role() = 'authenticated');


-- ─── 7. Seed: transfer types ───
-- package_bus: the bus used inside a package. Cairo = 400 EGP / person / one direction.
-- hiace:       standalone transfer booking. Cairo = 500 EGP / person / one direction.
INSERT INTO transfer_settings (transfer_type, name_ar, name_en, vehicle_ar, vehicle_en, base_price) VALUES
  ('package_bus', 'نقل الباكدج',   'Package Transfer',  'باص',      'Bus',   400),
  ('hiace',       'حجز انتقالات', 'Standalone Transfer', 'هاي إيس', 'Hiace', 500)
ON CONFLICT (transfer_type) DO NOTHING;


-- ─── 8. Seed: governorate surcharges ───
-- NOTE: Cairo is the baseline and MUST stay at 0 — every other governorate is a
-- surcharge on top of it. The non-Cairo values below are carried over from the old
-- `governorate_pricing` table as a starting point. Adjust them in the dashboard
-- (النقل tab) — they are not authoritative.
INSERT INTO transfer_governorate_pricing
  (transfer_type, governorate_code, name_ar, name_en, price_surcharge, sort_order) VALUES
  ('package_bus', 'cairo',      'القاهرة',      'Cairo',        0,   0),
  ('package_bus', 'alexandria', 'الإسكندرية',   'Alexandria',   200, 1),
  ('package_bus', 'zagazig',    'الزقازيق',     'Zagazig',      150, 2),
  ('package_bus', 'mansoura',   'المنصورة',     'Mansoura',     150, 3),
  ('hiace',       'cairo',      'القاهرة',      'Cairo',        0,   0),
  ('hiace',       'alexandria', 'الإسكندرية',   'Alexandria',   200, 1),
  ('hiace',       'zagazig',    'الزقازيق',     'Zagazig',      150, 2),
  ('hiace',       'mansoura',   'المنصورة',     'Mansoura',     150, 3)
ON CONFLICT (transfer_type, governorate_code) DO NOTHING;


-- ─── 9. Seed: testimonials placeholder ───
-- Replace these from the dashboard (آراء العملاء tab) with the real Facebook reviews.
INSERT INTO testimonials (name, text_ar, text_en, rating, sort_order, source) VALUES
  ('أحمد محمد',   'من أفضل الرحلات اللي روحتها في حياتي. التنظيم كان ممتاز وكل حاجة كانت مظبوطة من الأول للآخر. شكراً First Trip!', 'One of the best trips of my life. Organization was excellent and everything was perfect from start to finish. Thank you First Trip!', 5, 0, 'facebook'),
  ('منى السيد',   'رحلة عائلية رائعة مع First Trip. الأطفال استمتعوا جداً والفندق كان تحفة. هنكرر التجربة أكيد!', 'An amazing family trip with First Trip. The kids had so much fun and the hotel was gorgeous. We will definitely do it again!', 5, 1, 'facebook'),
  ('كريم الشافعي', 'أفضل شركة تنظم رحلات لدهب بدون منازع. سافرت معاهم 3 مرات وكل مرة أحسن من اللي قبلها.', 'Hands down the best company for Dahab trips. Traveled with them 3 times and each time is better than the last.', 5, 2, 'facebook')
ON CONFLICT DO NOTHING;
