-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 013 · Unified Customer + Commerce + Rentals +
--                                  Sinai Trip Bookings foundation
-- ───────────────────────────────────────────────────────────────────────────
-- Additive only. Nothing here drops or renames an existing column/table.
-- Existing bookings, prices, customers and the current booking flow keep
-- working exactly as before. This migration:
--
--   1. Extends `customers` into the shared CRM identity (normalized_phone,
--      whatsapp_phone, preferred_language, notes, merged_into for safe
--      duplicate handling) without touching the existing `phone` column or
--      its unique constraint.
--   2. Adds `bookings.customer_id` (nullable FK) and best-effort backfills it
--      from existing customer_phone / customers.phone — no data is deleted.
--   3. Adds `trip_bookings` — standalone Sinai Trip requests, separate from
--      trip *management* (sinai_trips stays as-is).
--   4. Adds the unified commerce engine: categories, products (sale|rental),
--      options/values, variants, rental pricing tiers, delivery zones,
--      commerce_settings, orders + order_items (historical snapshots),
--      rental_reservations, rental_availability_blocks.
--
-- Every new customer-facing write path is expected to resolve identity
-- through findOrCreateCustomerByPhone() (src/lib/customer.ts) rather than
-- writing to `customers` directly.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 0. Phone normalization helper (Egyptian-aware, safe fallback for others)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_phone_eg(raw_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
BEGIN
  IF raw_phone IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(raw_phone, '[^0-9]', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;

  -- "00" international dialing prefix -> strip
  IF left(digits, 2) = '00' THEN
    digits := substring(digits from 3);
  END IF;

  -- Egyptian mobile with country code: 20 1[0-9] XXXXXXXX (12 digits)
  IF left(digits, 2) = '20' AND length(digits) = 12 AND substring(digits from 3 for 1) = '1' THEN
    RETURN '+' || digits;
  END IF;

  -- Local Egyptian mobile: 01[0-9]XXXXXXXX (11 digits, leading 0)
  IF left(digits, 1) = '0' AND length(digits) = 11 AND substring(digits from 2 for 1) = '1' THEN
    RETURN '+20' || substring(digits from 2);
  END IF;

  -- Egyptian mobile missing both the leading 0 and country code (10 digits)
  IF length(digits) = 10 AND left(digits, 1) = '1' THEN
    RETURN '+20' || digits;
  END IF;

  -- Anything else that looks like a plausible international number:
  -- trust it as-is with a leading + (never reorder/strip digits further —
  -- "do not blindly modify numbers if country inference is unsafe").
  IF length(digits) BETWEEN 8 AND 15 THEN
    RETURN '+' || digits;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.normalize_phone_eg IS
  'Best-effort E.164-style phone normalization. Egyptian mobile variants '
  '(01xxxxxxxxx / +201xxxxxxxxx / 00201xxxxxxxxx) resolve confidently to '
  '+201xxxxxxxxx. Other numbers get a generic + prefix without reordering '
  'digits. Mirrored in TypeScript at src/lib/customer.ts — keep both in sync.';


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Unified customer identity
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS normalized_phone   TEXT,
  ADD COLUMN IF NOT EXISTS raw_phone          TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone     TEXT,
  ADD COLUMN IF NOT EXISTS country_code       TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS primary_address    TEXT,
  ADD COLUMN IF NOT EXISTS notes              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ,
  -- Safe duplicate-handling compatibility layer: if a legacy row turns out to
  -- be a duplicate of another customer (same normalized_phone), we point it
  -- at the canonical row instead of deleting it. Historical bookings that
  -- reference the duplicate's id keep working; the resolver always follows
  -- this chain to the canonical customer.
  ADD COLUMN IF NOT EXISTS merged_into        UUID REFERENCES public.customers(id);

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_preferred_language_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_preferred_language_check
  CHECK (preferred_language IN ('ar', 'en'));

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_not_self_merged;
ALTER TABLE public.customers ADD CONSTRAINT customers_not_self_merged
  CHECK (merged_into IS NULL OR merged_into <> id);

COMMENT ON COLUMN public.customers.normalized_phone IS
  'Canonical E.164-style phone, the customer matching key. Backfilled from '
  'the legacy `phone` column. New writes must go through findOrCreateCustomerByPhone().';
COMMENT ON COLUMN public.customers.merged_into IS
  'Set when this row was identified as a duplicate of another customer '
  '(same normalized_phone). NULL = this is the canonical record. Historical '
  'FKs pointing at a merged row remain valid; resolve through this chain to '
  'find the canonical customer_id.';

-- Backfill normalized_phone for every existing row that doesn't have one yet.
UPDATE public.customers
SET normalized_phone = public.normalize_phone_eg(phone), raw_phone = COALESCE(raw_phone, phone)
WHERE normalized_phone IS NULL;

-- Safe duplicate merge: multiple legacy customer rows can normalize to the
-- same phone (e.g. "01012345678" vs "+201012345678" as separately-created
-- rows before this migration). We never delete a row — we keep the oldest
-- as canonical and point every later duplicate at it via merged_into.
WITH ranked AS (
  SELECT
    id,
    normalized_phone,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_phone ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY normalized_phone ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS canonical_id
  FROM public.customers
  WHERE normalized_phone IS NOT NULL
)
UPDATE public.customers c
SET merged_into = r.canonical_id
FROM ranked r
WHERE c.id = r.id AND r.rn > 1 AND c.merged_into IS NULL;

-- One canonical customer per normalized phone going forward. Merged
-- (superseded) rows are excluded so their now-shared phone doesn't collide.
DROP INDEX IF EXISTS customers_normalized_phone_canonical_idx;
CREATE UNIQUE INDEX customers_normalized_phone_canonical_idx
  ON public.customers (normalized_phone)
  WHERE normalized_phone IS NOT NULL AND merged_into IS NULL;

CREATE INDEX IF NOT EXISTS customers_merged_into_idx ON public.customers (merged_into);

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Link accommodation bookings to the canonical customer (additive FK)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- Best-effort backfill: match each existing booking to a customer by
-- normalized phone, following merged_into to the canonical row. Bookings
-- that can't be confidently matched are left NULL — nothing is guessed.
UPDATE public.bookings b
SET customer_id = COALESCE(c.merged_into, c.id)
FROM public.customers c
WHERE b.customer_id IS NULL
  AND c.normalized_phone IS NOT NULL
  AND c.normalized_phone = public.normalize_phone_eg(b.customer_phone);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings (customer_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Sinai Trip bookings/requests — separate from trip management
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID REFERENCES public.customers(id),
  trip_id          UUID REFERENCES public.sinai_trips(id),
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  preferred_date   DATE,
  num_people       INTEGER NOT NULL DEFAULT 1 CHECK (num_people >= 1),
  adults           INTEGER,
  children         INTEGER,
  selected_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  context          TEXT NOT NULL DEFAULT 'standalone'
                     CHECK (context IN ('standalone', 'package_addon')),
  quoted_price     NUMERIC(10,2),
  final_price      NUMERIC(10,2),
  source           TEXT NOT NULL DEFAULT 'website'
                     CHECK (source IN ('website', 'manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other')),
  notes            TEXT DEFAULT '',
  internal_notes   TEXT DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'contacted', 'confirmed', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_bookings_customer ON public.trip_bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_trip ON public.trip_bookings (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_status ON public.trip_bookings (status);

ALTER TABLE public.trip_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trip_bookings_service_role_all" ON public.trip_bookings;
CREATE POLICY "trip_bookings_service_role_all" ON public.trip_bookings
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_trip_bookings_updated_at ON public.trip_bookings;
CREATE TRIGGER update_trip_bookings_updated_at BEFORE UPDATE ON public.trip_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.trip_bookings IS
  'Customer requests/bookings for a Sinai Trip, separate from sinai_trips '
  '(the trip product/content). Always linked to the canonical customer_id.';


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Commerce: categories
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  applies_to          TEXT NOT NULL DEFAULT 'both' CHECK (applies_to IN ('sale', 'rental', 'both')),
  name_ar             TEXT NOT NULL,
  name_en             TEXT NOT NULL,
  description_ar      TEXT NOT NULL DEFAULT '',
  description_en      TEXT NOT NULL DEFAULT '',
  image_url           TEXT DEFAULT '',
  icon                TEXT DEFAULT '',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_featured         BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  seo_title           TEXT DEFAULT '',
  seo_description_ar  TEXT DEFAULT '',
  seo_description_en  TEXT DEFAULT '',
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_categories_active ON public.commerce_categories (is_active, sort_order);

ALTER TABLE public.commerce_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_categories_public_read" ON public.commerce_categories;
CREATE POLICY "commerce_categories_public_read" ON public.commerce_categories
  FOR SELECT USING (is_active = true AND archived_at IS NULL);
DROP POLICY IF EXISTS "commerce_categories_service_role_all" ON public.commerce_categories;
CREATE POLICY "commerce_categories_service_role_all" ON public.commerce_categories
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_commerce_categories_updated_at ON public.commerce_categories;
CREATE TRIGGER update_commerce_categories_updated_at BEFORE UPDATE ON public.commerce_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────
-- 5. Commerce: products (sale | rental), options, values, variants
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID REFERENCES public.commerce_categories(id) ON DELETE SET NULL,
  product_type        TEXT NOT NULL CHECK (product_type IN ('sale', 'rental')),
  slug                TEXT NOT NULL UNIQUE,
  name_ar             TEXT NOT NULL,
  name_en             TEXT NOT NULL,
  description_ar      TEXT NOT NULL DEFAULT '',
  description_en      TEXT NOT NULL DEFAULT '',
  images              TEXT[] NOT NULL DEFAULT '{}',
  base_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  sku                 TEXT,
  track_inventory     BOOLEAN NOT NULL DEFAULT true,
  requires_delivery   BOOLEAN NOT NULL DEFAULT true,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_featured         BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  seo_title           TEXT DEFAULT '',
  seo_description_ar  TEXT DEFAULT '',
  seo_description_en  TEXT DEFAULT '',
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_products_category ON public.commerce_products (category_id);
CREATE INDEX IF NOT EXISTS idx_commerce_products_type_active ON public.commerce_products (product_type, is_active);

ALTER TABLE public.commerce_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_products_public_read" ON public.commerce_products;
CREATE POLICY "commerce_products_public_read" ON public.commerce_products
  FOR SELECT USING (is_active = true AND archived_at IS NULL);
DROP POLICY IF EXISTS "commerce_products_service_role_all" ON public.commerce_products;
CREATE POLICY "commerce_products_service_role_all" ON public.commerce_products
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_commerce_products_updated_at ON public.commerce_products;
CREATE TRIGGER update_commerce_products_updated_at BEFORE UPDATE ON public.commerce_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.commerce_product_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_product_options_product ON public.commerce_product_options (product_id);

ALTER TABLE public.commerce_product_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_product_options_public_read" ON public.commerce_product_options;
CREATE POLICY "commerce_product_options_public_read" ON public.commerce_product_options
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "commerce_product_options_service_role_all" ON public.commerce_product_options;
CREATE POLICY "commerce_product_options_service_role_all" ON public.commerce_product_options
  FOR ALL USING (auth.role() = 'service_role');


CREATE TABLE IF NOT EXISTS public.commerce_product_option_values (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id   UUID NOT NULL REFERENCES public.commerce_product_options(id) ON DELETE CASCADE,
  value_ar    TEXT NOT NULL,
  value_en    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_option_values_option ON public.commerce_product_option_values (option_id);

ALTER TABLE public.commerce_product_option_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_option_values_public_read" ON public.commerce_product_option_values;
CREATE POLICY "commerce_option_values_public_read" ON public.commerce_product_option_values
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "commerce_option_values_service_role_all" ON public.commerce_product_option_values;
CREATE POLICY "commerce_option_values_service_role_all" ON public.commerce_product_option_values
  FOR ALL USING (auth.role() = 'service_role');


CREATE TABLE IF NOT EXISTS public.commerce_product_variants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  sku                 TEXT,
  -- Denormalized array of commerce_product_option_values.id that make up
  -- this variant (e.g. [Size=M, Color=Black]). Kept simple on purpose —
  -- a join table can be added later without breaking this column.
  option_value_ids    UUID[] NOT NULL DEFAULT '{}',
  price_override      NUMERIC(10,2),
  inventory_quantity  INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  image_url           TEXT DEFAULT '',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_variants_product ON public.commerce_product_variants (product_id);

ALTER TABLE public.commerce_product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_variants_public_read" ON public.commerce_product_variants;
CREATE POLICY "commerce_variants_public_read" ON public.commerce_product_variants
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "commerce_variants_service_role_all" ON public.commerce_product_variants;
CREATE POLICY "commerce_variants_service_role_all" ON public.commerce_product_variants
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_commerce_variants_updated_at ON public.commerce_product_variants;
CREATE TRIGGER update_commerce_variants_updated_at BEFORE UPDATE ON public.commerce_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────
-- 6. Rental pricing tiers — dynamic durations, not hard-coded
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_pricing_tiers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  variant_id     UUID REFERENCES public.commerce_product_variants(id) ON DELETE CASCADE,
  duration_days  INTEGER NOT NULL CHECK (duration_days > 0),
  label_ar       TEXT NOT NULL DEFAULT '',
  label_en       TEXT NOT NULL DEFAULT '',
  price          NUMERIC(10,2) NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, variant_id, duration_days)
);

CREATE INDEX IF NOT EXISTS idx_rental_pricing_tiers_product ON public.rental_pricing_tiers (product_id, is_active);

ALTER TABLE public.rental_pricing_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rental_pricing_tiers_public_read" ON public.rental_pricing_tiers;
CREATE POLICY "rental_pricing_tiers_public_read" ON public.rental_pricing_tiers
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "rental_pricing_tiers_service_role_all" ON public.rental_pricing_tiers;
CREATE POLICY "rental_pricing_tiers_service_role_all" ON public.rental_pricing_tiers
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_rental_pricing_tiers_updated_at ON public.rental_pricing_tiers;
CREATE TRIGGER update_rental_pricing_tiers_updated_at BEFORE UPDATE ON public.rental_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────
-- 7. Delivery zones + commerce settings
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  fee_type    TEXT NOT NULL DEFAULT 'fixed' CHECK (fee_type IN ('fixed', 'free', 'quote')),
  fixed_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_zones_public_read" ON public.delivery_zones;
CREATE POLICY "delivery_zones_public_read" ON public.delivery_zones
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "delivery_zones_service_role_all" ON public.delivery_zones;
CREATE POLICY "delivery_zones_service_role_all" ON public.delivery_zones
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER update_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.commerce_settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pickup_enabled              BOOLEAN NOT NULL DEFAULT true,
  delivery_enabled            BOOLEAN NOT NULL DEFAULT true,
  default_currency            TEXT NOT NULL DEFAULT 'EGP',
  orders_require_confirmation BOOLEAN NOT NULL DEFAULT true,
  online_payment_enabled      BOOLEAN NOT NULL DEFAULT false,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.commerce_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.commerce_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_settings_public_read" ON public.commerce_settings;
CREATE POLICY "commerce_settings_public_read" ON public.commerce_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "commerce_settings_service_role_all" ON public.commerce_settings;
CREATE POLICY "commerce_settings_service_role_all" ON public.commerce_settings
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_commerce_settings_updated_at ON public.commerce_settings;
CREATE TRIGGER update_commerce_settings_updated_at BEFORE UPDATE ON public.commerce_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────
-- 8. Orders + order items (historical snapshots, server-computed totals)
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.commerce_order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.commerce_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      TEXT NOT NULL UNIQUE DEFAULT ('WM-' || nextval('public.commerce_order_number_seq')::text),
  customer_id       UUID REFERENCES public.customers(id),
  order_type        TEXT NOT NULL CHECK (order_type IN ('merch', 'rental', 'mixed')),
  fulfillment_method TEXT NOT NULL DEFAULT 'pickup' CHECK (fulfillment_method IN ('pickup', 'delivery')),
  delivery_zone_id  UUID REFERENCES public.delivery_zones(id),
  delivery_address  TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'contacted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  amount_paid       NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes             TEXT DEFAULT '',
  internal_notes    TEXT DEFAULT '',
  source            TEXT NOT NULL DEFAULT 'website'
                      CHECK (source IN ('website', 'manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer ON public.commerce_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_status ON public.commerce_orders (status);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_type ON public.commerce_orders (order_type);

ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_orders_service_role_all" ON public.commerce_orders;
CREATE POLICY "commerce_orders_service_role_all" ON public.commerce_orders
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_commerce_orders_updated_at ON public.commerce_orders;
CREATE TRIGGER update_commerce_orders_updated_at BEFORE UPDATE ON public.commerce_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.commerce_orders IS
  'Unified order header for merch + rental requests. No online payment yet — '
  'orders are requests requiring WEEMAP confirmation over WhatsApp.';


CREATE TABLE IF NOT EXISTS public.commerce_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.commerce_orders(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
  variant_id          UUID REFERENCES public.commerce_product_variants(id) ON DELETE SET NULL,
  item_type           TEXT NOT NULL CHECK (item_type IN ('sale', 'rental')),
  -- Frozen at order time so later product/price edits never corrupt history.
  name_snapshot_ar    TEXT NOT NULL,
  name_snapshot_en    TEXT NOT NULL,
  variant_snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  unit_price          NUMERIC(10,2) NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rental_duration_days INTEGER,
  rental_start_date   DATE,
  rental_end_date     DATE,
  line_total          NUMERIC(10,2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order ON public.commerce_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_order_items_product ON public.commerce_order_items (product_id);

ALTER TABLE public.commerce_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_order_items_service_role_all" ON public.commerce_order_items;
CREATE POLICY "commerce_order_items_service_role_all" ON public.commerce_order_items
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────
-- 9. Rental reservations + availability blocks
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  UUID REFERENCES public.commerce_order_items(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.commerce_products(id),
  variant_id     UUID REFERENCES public.commerce_product_variants(id),
  quantity       INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested', 'contacted', 'confirmed', 'active', 'returned', 'completed', 'cancelled', 'late')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_reservation_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rental_reservations_product_dates
  ON public.rental_reservations (product_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_reservations_status ON public.rental_reservations (status);

ALTER TABLE public.rental_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rental_reservations_service_role_all" ON public.rental_reservations;
CREATE POLICY "rental_reservations_service_role_all" ON public.rental_reservations
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_rental_reservations_updated_at ON public.rental_reservations;
CREATE TRIGGER update_rental_reservations_updated_at BEFORE UPDATE ON public.rental_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.rental_reservations IS
  'A submission is "requested" (not yet confirmed) inventory. Only statuses '
  'in (confirmed, active, late) count against confirmed availability — see '
  'RESERVING_STATUSES in src/lib/rental-availability.ts, the single source '
  'of truth for which statuses reserve inventory.';


CREATE TABLE IF NOT EXISTS public.rental_availability_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES public.commerce_product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT DEFAULT '',
  created_by  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_block_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rental_blocks_product_dates
  ON public.rental_availability_blocks (product_id, start_date, end_date);

ALTER TABLE public.rental_availability_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rental_blocks_service_role_all" ON public.rental_availability_blocks;
CREATE POLICY "rental_blocks_service_role_all" ON public.rental_availability_blocks
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;
