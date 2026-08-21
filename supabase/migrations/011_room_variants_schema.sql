-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 011 · Room Upgrades Schema
-- ───────────────────────────────────────────────────────────────────────────
-- Additive only. Enables hotels to offer optional room upgrades
-- (e.g. Sea View, Deluxe) that add a fixed supplement per room per night
-- on top of the base single/double/triple room price.
--
-- What this adds:
--   1. accommodation_room_upgrades — hotel-level upgrade tiers
--
-- Model: upgrade supplement, NOT separate room inventory.
--   Base room prices (single/double/triple) remain the source of truth.
--   An upgrade adds a fixed extra EGP amount to whichever room type
--   the customer selects. The upgrade is not tied to a specific occupancy
--   and is not a replacement price.
--
-- Examples:
--   Base Double = 2400, Sea View upgrade = +1000 → Double Sea View = 3400
--   Base Single = 1800, Sea View upgrade = +1000 → Single Sea View = 2800
--   Base Triple = 2800, Sea View upgrade = +1000 → Triple Sea View = 3800
--
-- Design decision: bookings do NOT get an upgrade FK column.
--   Upgrade details (id, name snapshot, extra cost, final rate per room)
--   are captured in the existing price_snapshot JSONB column, which is
--   already immutable and audit-safe for exactly this purpose.
--
-- Simple hotels: leave this table empty, use base room pricing (unchanged).
-- Hotels with upgrades: add rows; the booking form shows them per allocation.
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Room Upgrades Table ───
CREATE TABLE IF NOT EXISTS accommodation_room_upgrades (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id      UUID        NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,

  -- Displayed upgrade name (e.g. "Sea View", "Deluxe", "Standard")
  name_ar               TEXT        NOT NULL,
  name_en               TEXT        NOT NULL,

  -- Fixed supplement added PER ROOM PER NIGHT on top of the base room rate.
  -- This is NOT per person and is NOT an absolute room price.
  -- 0 is valid (means "Standard / No Upgrade" with a named label).
  extra_price_per_night NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Admin control
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE accommodation_room_upgrades IS
  'Optional room upgrade tiers for an accommodation. '
  'extra_price_per_night is a fixed supplement per ROOM per night added on top of '
  'the base single/double/triple room rate. Hotels without upgrades leave this empty.';

COMMENT ON COLUMN accommodation_room_upgrades.extra_price_per_night IS
  'Fixed EGP supplement per room per night. '
  'Added on top of whichever base room type (single/double/triple) the customer selects. '
  'Value of 0 is valid for a named "Standard" / no-extra option.';

COMMENT ON COLUMN accommodation_room_upgrades.sort_order IS
  'Display order in the booking form. Lower = shown first.';

-- Index for booking form and admin queries
CREATE INDEX IF NOT EXISTS idx_room_upgrades_accommodation
  ON accommodation_room_upgrades(accommodation_id, is_active, sort_order);

-- ─── Row-Level Security ───
-- Matches the project's established pattern (see newsletter_subscribers, etc.)
ALTER TABLE accommodation_room_upgrades ENABLE ROW LEVEL SECURITY;

-- Public booking form reads active upgrades for the selected hotel
CREATE POLICY "room_upgrades_public_read"
  ON accommodation_room_upgrades FOR SELECT
  USING (is_active = true);

-- Admin API (service-role) has full write access
CREATE POLICY "room_upgrades_service_role_all"
  ON accommodation_room_upgrades FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Auto-update updated_at trigger ───
CREATE TRIGGER update_accommodation_room_upgrades_updated_at
  BEFORE UPDATE ON accommodation_room_upgrades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
