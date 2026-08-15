-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 004 · Pricing Engine v2
-- ───────────────────────────────────────────────────────────────────────────
-- Additive only. Nothing here drops or renames an existing column/table, so
-- it is safe to run against production data. Existing bookings, prices and
-- the current booking flow keep working exactly as before until the admin
-- UI / booking API are wired to the new columns (tracked separately in
-- WEEMAP_REBRAND.md — Phase 2).
--
-- What this adds:
--   1. accommodations.price_triple_room        — base (non-seasonal) triple rate
--   2. accommodation_seasonal_rates             — date-range single/double/triple
--                                                 overrides per accommodation, with
--                                                 an overlap guard per property
--   3. sinai_trips.package_price                — the discounted cost WEEMAP pays
--                                                 internally when a trip is one of
--                                                 the two trips included in a package
--                                                 (falls back to `price` if NULL)
--   4. bookings: payment_status, amount_paid,
--      price_snapshot                           — manual payment tracking +
--                                                 a frozen breakdown of the rates
--                                                 used, so a later price change
--                                                 never touches a past booking
--   5. bookings.source                          — widened to the full set of
--                                                 channels the dashboard now tracks
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 0. Catch-up guards ───
-- The production DB turned out to be missing columns from earlier migration
-- files that were never run against it (bookings.source failed on first run).
-- Everything below is IF NOT EXISTS, so it is a no-op wherever the earlier
-- migrations DID run, and fills the gaps where they didn't.
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS price_double_room NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_single_room NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_plans JSONB NOT NULL DEFAULT '[]';

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS package_included_trip_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_type TEXT,
  ADD COLUMN IF NOT EXISTS meal_plan_key TEXT,
  ADD COLUMN IF NOT EXISTS extra_trip_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transfer_type TEXT,
  ADD COLUMN IF NOT EXISTS transfer_direction TEXT,
  ADD COLUMN IF NOT EXISTS return_date DATE,
  ADD COLUMN IF NOT EXISTS nights INTEGER;

-- room_type must now allow 'triple' — replace any older narrower CHECK.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_room_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_room_type_check
  CHECK (room_type IS NULL OR room_type IN ('double', 'single', 'triple'));


-- ─── 1. Triple room base price ───
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS price_triple_room NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN accommodations.price_triple_room IS
  'Total room price per night for triple occupancy (3 people). Per-person = this / 3. '
  'Falls back from accommodation_seasonal_rates when no seasonal period covers a given night.';


-- ─── 2. Seasonal rate periods ───
-- One row = one named period (e.g. "Christmas / New Year") with its own
-- single/double/triple nightly rates. The pricing engine resolves each
-- night of a stay against these periods individually (see src/lib/pricing.ts)
-- and falls back to the accommodation's base price_* columns for any night
-- not covered by a period.
CREATE TABLE IF NOT EXISTS accommodation_seasonal_rates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT '',
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  single_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  double_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  triple_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seasonal_rate_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_seasonal_rates_accommodation
  ON accommodation_seasonal_rates(accommodation_id, is_active);

-- Prevent two ACTIVE periods for the same accommodation from overlapping —
-- "Never silently choose a random seasonal rate" from the spec. Requires the
-- btree_gist extension for the UUID equality term inside an EXCLUDE constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seasonal_rate_no_overlap'
  ) THEN
    ALTER TABLE accommodation_seasonal_rates
      ADD CONSTRAINT seasonal_rate_no_overlap
      EXCLUDE USING gist (
        accommodation_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      ) WHERE (is_active);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_seasonal_rates_updated_at ON accommodation_seasonal_rates;
CREATE TRIGGER update_seasonal_rates_updated_at BEFORE UPDATE ON accommodation_seasonal_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE accommodation_seasonal_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active seasonal rates" ON accommodation_seasonal_rates;
CREATE POLICY "Public can read active seasonal rates" ON accommodation_seasonal_rates
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage seasonal rates" ON accommodation_seasonal_rates;
CREATE POLICY "Admins can manage seasonal rates" ON accommodation_seasonal_rates
  FOR ALL USING (auth.role() = 'authenticated');


-- ─── 3. Trip package cost (separate from public selling price) ───
ALTER TABLE sinai_trips
  ADD COLUMN IF NOT EXISTS package_price NUMERIC(10,2);

COMMENT ON COLUMN sinai_trips.package_price IS
  'What WEEMAP uses internally when this trip is one of the two trips included '
  'in a package. NULL = not configured yet, falls back to `price` (with an admin '
  'warning) until the owner sets an explicit package cost.';


-- ─── 4. Payment tracking + historical price snapshot ───
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT '',
  -- Frozen breakdown of every rate used to compute total_price at booking time:
  -- room nightly rates per night, transfer rate, included/extra trip rates,
  -- meal pricing. See buildPriceSnapshot() in src/lib/pricing.ts.
  ADD COLUMN IF NOT EXISTS price_snapshot JSONB;

COMMENT ON COLUMN bookings.price_snapshot IS
  'Frozen pricing breakdown captured at booking creation time. Never recompute '
  'a past booking''s total from current prices — this column is the source of '
  'truth for what the customer was actually charged and why.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_status_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
      CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));
  END IF;
END $$;


-- ─── 5. Booking source — full channel list ───
-- The production DB may not have run 002_bookings_extra_columns.sql, so the
-- column itself may be missing. Create it if needed, then (re)apply the CHECK.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT;
UPDATE bookings SET source = 'website' WHERE source IS NULL;
ALTER TABLE bookings ALTER COLUMN source SET DEFAULT 'website';
ALTER TABLE bookings ALTER COLUMN source SET NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_source_check
  CHECK (source IN ('website', 'manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other'));


-- ─── 6. Practical booking status vocabulary ───
-- Existing CHECK already covers pending/confirmed/cancelled/completed. Add
-- 'new' as the default first-touch state for a freshly submitted booking.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('new', 'pending', 'confirmed', 'cancelled', 'completed'));
