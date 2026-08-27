-- 017_trip_packages.sql
-- Trip Packages: curated bundles of EXISTING Sinai Trips. Additive only.
--
-- Pricing contract (enforced in application code, not in SQL):
--   * A package's total = SUM(sinai_trips.package_price) for its included
--     trips. Never falls back to `price`.
--   * A package cannot be marked `is_active = true` unless every included
--     trip has a valid (non-null, > 0) package_price — enforced in
--     src/app/api/admin/trip-packages/route.ts and [id]/route.ts, not by a
--     DB constraint, because the validation needs to run against the joined
--     trip_package_items + sinai_trips state at write time.
--   * Package totals are NOT cached/frozen on trip_packages — they're always
--     computed live from current sinai_trips.package_price, exactly like
--     other live pricing. Freezing only happens in a booking's price_snapshot
--     at the moment a customer actually books (see bookings.trip_package_ids
--     + price_snapshot.trip_packages below), same convention as the rest of
--     the pricing engine (buildPriceSnapshot in src/lib/pricing.ts).
--
-- Follows the exact table/RLS/trigger pattern already used for
-- commerce_collections + commerce_product_collections (migration 015).

CREATE TABLE IF NOT EXISTS public.trip_package_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_package_categories_active ON public.trip_package_categories (is_active, sort_order);

ALTER TABLE public.trip_package_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trip_package_categories_public_read" ON public.trip_package_categories;
CREATE POLICY "trip_package_categories_public_read" ON public.trip_package_categories
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "trip_package_categories_service_role_all" ON public.trip_package_categories;
CREATE POLICY "trip_package_categories_service_role_all" ON public.trip_package_categories
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_trip_package_categories_updated_at ON public.trip_package_categories;
CREATE TRIGGER update_trip_package_categories_updated_at BEFORE UPDATE ON public.trip_package_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.trip_packages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT NOT NULL UNIQUE,
  name_ar                TEXT NOT NULL,
  name_en                TEXT NOT NULL,
  short_description_ar   TEXT NOT NULL DEFAULT '',
  short_description_en   TEXT NOT NULL DEFAULT '',
  description_ar         TEXT NOT NULL DEFAULT '',
  description_en         TEXT NOT NULL DEFAULT '',
  image                  TEXT DEFAULT '',
  badge_ar               TEXT DEFAULT '',
  badge_en               TEXT DEFAULT '',
  package_category_id    UUID REFERENCES public.trip_package_categories(id) ON DELETE SET NULL,
  featured               BOOLEAN NOT NULL DEFAULT false,
  -- Published state — gated by publish validation in the admin API, not here.
  is_active              BOOLEAN NOT NULL DEFAULT false,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_packages_active ON public.trip_packages (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_trip_packages_category ON public.trip_packages (package_category_id);

ALTER TABLE public.trip_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trip_packages_public_read" ON public.trip_packages;
CREATE POLICY "trip_packages_public_read" ON public.trip_packages
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "trip_packages_service_role_all" ON public.trip_packages;
CREATE POLICY "trip_packages_service_role_all" ON public.trip_packages
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_trip_packages_updated_at ON public.trip_packages;
CREATE TRIGGER update_trip_packages_updated_at BEFORE UPDATE ON public.trip_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.trip_package_items (
  package_id  UUID NOT NULL REFERENCES public.trip_packages(id) ON DELETE CASCADE,
  trip_id     UUID NOT NULL REFERENCES public.sinai_trips(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (package_id, trip_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_package_items_package ON public.trip_package_items (package_id);
CREATE INDEX IF NOT EXISTS idx_trip_package_items_trip ON public.trip_package_items (trip_id);

ALTER TABLE public.trip_package_items ENABLE ROW LEVEL SECURITY;
-- Public read is safe: this join table only carries trip_id/sort_order, never
-- a price. Trip names come from sinai_trips (already public); package_price
-- is a separate column on sinai_trips that public queries never select
-- (see stripPackagePrice() in src/lib/data.ts).
DROP POLICY IF EXISTS "trip_package_items_public_read" ON public.trip_package_items;
CREATE POLICY "trip_package_items_public_read" ON public.trip_package_items
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "trip_package_items_service_role_all" ON public.trip_package_items;
CREATE POLICY "trip_package_items_service_role_all" ON public.trip_package_items
  FOR ALL USING (auth.role() = 'service_role');


-- ─── Booking integration — additive columns only ───
-- Mirrors the existing extra_trip_ids UUID[] convention on bookings.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_package_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.bookings.trip_package_ids IS
  'Trip Packages selected at booking time. Each package''s total is frozen '
  'into price_snapshot.trip_packages at booking creation — this array is for '
  'querying/reference only, never re-priced from current sinai_trips values.';
