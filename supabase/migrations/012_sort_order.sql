-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 012 · Manual sort_order for trips & accommodations
-- ───────────────────────────────────────────────────────────────────────────
-- Adds a sort_order column to accommodations and sinai_trips so admins can
-- control the display order shown to customers.
--
-- community_posts already has sort_order (applied in migration 005).
-- This migration is additive-only and backward compatible.
--
-- Default = 0 for all existing rows → existing order is preserved until
-- an admin explicitly sets values.
-- Public order: sort_order ASC, then created_at ASC as tie-breaker.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sinai_trips
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Indexes to keep public listing queries fast
CREATE INDEX IF NOT EXISTS idx_accommodations_sort
  ON accommodations(sort_order ASC, created_at ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sinai_trips_sort
  ON sinai_trips(sort_order ASC, created_at ASC)
  WHERE is_active = true;

COMMIT;
