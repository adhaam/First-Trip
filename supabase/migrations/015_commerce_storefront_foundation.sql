-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 015 · Commerce storefront foundation (Phase 2)
-- ───────────────────────────────────────────────────────────────────────────
-- Additive only — nothing here drops or renames anything from migration 013.
-- Adds:
--   1. Merchandising/product fields needed by the real storefront: compare-at
--      price, a free-text merchandising badge, rental deposit + requirements,
--      per-product pickup/delivery toggles, pickup instructions.
--   2. Collections (curated cross-category groupings) + product membership.
--   3. Concurrency-safe inventory primitives: atomic sale-inventory
--      decrement/restock, and an advisory-locked rental availability check
--      usable both at order time and when an admin confirms a reservation —
--      see "42. INVENTORY CONCURRENCY" in the phase brief.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Product merchandising + rental terms
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.commerce_products
  ADD COLUMN IF NOT EXISTS compare_at_price      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS badge_text             TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS deposit_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_enabled         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_enabled       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rental_requirements    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pickup_instructions_ar TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_instructions_en TEXT DEFAULT '';

COMMENT ON COLUMN public.commerce_products.rental_requirements IS
  'Free-form requirement tags for rentals, e.g. id_required, license_required, '
  'deposit_required. Deliberately a flexible text array instead of dedicated '
  'boolean columns so admins can introduce new requirement types without a migration.';
COMMENT ON COLUMN public.commerce_products.badge_text IS
  'Free-text merchandising badge (e.g. "New", "WEEMAP Pick", "Bestseller"). '
  'Empty string = no badge. Admin-configurable, never hard-coded business logic.';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Collections — curated groupings, distinct from categories
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commerce_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  description_ar  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  image_url       TEXT DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.commerce_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commerce_collections_public_read" ON public.commerce_collections;
CREATE POLICY "commerce_collections_public_read" ON public.commerce_collections
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "commerce_collections_service_role_all" ON public.commerce_collections;
CREATE POLICY "commerce_collections_service_role_all" ON public.commerce_collections
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_commerce_collections_updated_at ON public.commerce_collections;
CREATE TRIGGER update_commerce_collections_updated_at BEFORE UPDATE ON public.commerce_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.commerce_product_collections (
  product_id     UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  collection_id  UUID NOT NULL REFERENCES public.commerce_collections(id) ON DELETE CASCADE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_product_collections_collection ON public.commerce_product_collections (collection_id);

ALTER TABLE public.commerce_product_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_collections_public_read" ON public.commerce_product_collections;
CREATE POLICY "product_collections_public_read" ON public.commerce_product_collections
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "product_collections_service_role_all" ON public.commerce_product_collections;
CREATE POLICY "product_collections_service_role_all" ON public.commerce_product_collections
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Concurrency-safe sale inventory: atomic decrement / restock
-- ─────────────────────────────────────────────────────────────────────────
-- Single-statement conditional UPDATE — Postgres guarantees this is atomic
-- across concurrent callers, so two simultaneous orders for the last unit
-- can never both succeed.
CREATE OR REPLACE FUNCTION public.decrement_variant_inventory(p_variant_id UUID, p_qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.commerce_product_variants
  SET inventory_quantity = inventory_quantity - p_qty
  WHERE id = p_variant_id AND inventory_quantity >= p_qty;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.restock_variant_inventory(p_variant_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.commerce_product_variants
  SET inventory_quantity = inventory_quantity + p_qty
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.decrement_variant_inventory IS
  'Atomically reserves sale-item stock at order-creation time. Returns false '
  '(no partial effect) if insufficient stock — caller must restock any other '
  'variants already decremented in the same order and fail the whole order.';


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Concurrency-safe rental availability: advisory-locked check
-- ─────────────────────────────────────────────────────────────────────────
-- Serializes concurrent callers for the same product/variant with a
-- transaction-scoped advisory lock, then re-runs the same overlap logic as
-- src/lib/rental-availability.ts inside that lock. Used both when a public
-- order is submitted and — authoritatively — when an admin changes a
-- reservation's status into a reserving status (confirmed/active/late),
-- so two concurrent confirmations can never both push a product over its
-- owned inventory.
CREATE OR REPLACE FUNCTION public.check_rental_availability_locked(
  p_product_id UUID,
  p_variant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_qty INTEGER,
  p_total_inventory INTEGER,
  p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  lock_key BIGINT;
  reserved INTEGER;
  blocked INTEGER;
BEGIN
  lock_key := hashtextextended(p_product_id::text || '|' || COALESCE(p_variant_id::text, ''), 0);
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(SUM(quantity), 0) INTO reserved
  FROM public.rental_reservations
  WHERE product_id = p_product_id
    AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
    AND status IN ('confirmed', 'active', 'late')
    AND (p_exclude_reservation_id IS NULL OR id <> p_exclude_reservation_id)
    AND start_date <= p_end_date AND end_date >= p_start_date;

  SELECT COALESCE(SUM(quantity), 0) INTO blocked
  FROM public.rental_availability_blocks
  WHERE product_id = p_product_id
    AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
    AND start_date <= p_end_date AND end_date >= p_start_date;

  RETURN (p_total_inventory - reserved - blocked) >= p_qty;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.check_rental_availability_locked IS
  'Authoritative, concurrency-safe rental availability check. Must be used '
  'whenever a reservation is created or moved into a reserving status '
  '(confirmed/active/late) — never trust a check performed in an earlier, '
  'separate round-trip.';

COMMIT;
