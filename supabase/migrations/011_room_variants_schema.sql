-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 011 · Room Variants Schema
-- ───────────────────────────────────────────────────────────────────────────
-- Additive only. Enables hotels to offer multiple variants within a room type
-- (e.g., Standard Double, Deluxe Double, Sea View Double) with different prices.
--
-- What this adds:
--   1. accommodation_room_variants       — variants per accommodation, per
--                                          base room type (single/double/triple)
--   2. bookings.room_variant_id         — optional reference to a specific
--                                          variant (backward compatible with
--                                          bookings.room_type)
--
-- Both additions are optional:
--   • Simple hotels leave variants empty, use base pricing
--   • Complex hotels add variants, variants take precedence
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Room Variants Table ───
CREATE TABLE IF NOT EXISTS accommodation_room_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,

  -- The base room type this variant belongs to
  base_room_type   TEXT NOT NULL,
  CONSTRAINT room_variant_base_type_check
    CHECK (base_room_type IN ('single', 'double', 'triple')),

  -- Variant names (e.g., "Standard Double", "Deluxe Double", "Sea View Double")
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,

  -- Occupancy (usually 1 for single, 2 for double, 3 for triple)
  -- Can differ from base type if variant has different capacity
  occupancy        INTEGER NOT NULL DEFAULT 2,

  -- Nightly rate for this variant
  price_per_night  NUMERIC(10,2) NOT NULL,

  -- Admin control
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE accommodation_room_variants IS
  'Room variants within an accommodation. Each variant belongs to a base room type '
  'and has its own price. Hotels without variants leave this table empty and use base pricing.';

COMMENT ON COLUMN accommodation_room_variants.occupancy IS
  'Number of people this variant accommodates. Usually 1, 2, or 3.';

COMMENT ON COLUMN accommodation_room_variants.sort_order IS
  'Display order when shown to the booking form. Lower = shown first.';

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_room_variants_accommodation
  ON accommodation_room_variants(accommodation_id, is_active);

CREATE INDEX IF NOT EXISTS idx_room_variants_base_type
  ON accommodation_room_variants(accommodation_id, base_room_type, is_active);


-- ─── Bookings Enhancement ───
-- Optional reference to a specific room variant.
-- If set, variant pricing overrides base type pricing.
-- If NULL, booking.room_type is used (backward compatible).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_variant_id UUID REFERENCES accommodation_room_variants(id);

COMMENT ON COLUMN bookings.room_variant_id IS
  'Reference to a specific room variant if one was chosen. If NULL, falls back to room_type.';


-- ─── Row-Level Security ───
-- Room variants inherit the same RLS as accommodations
ALTER TABLE accommodation_room_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_variants_public_read"
  ON accommodation_room_variants FOR SELECT USING (true);

CREATE POLICY "room_variants_admin_all"
  ON accommodation_room_variants FOR ALL
  USING (
    -- Same as accommodations: only authenticated users (dashboard)
    -- A proper production setup would check for admin role
    auth.role() = 'authenticated'
  );

COMMIT;
