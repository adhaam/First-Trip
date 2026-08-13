-- ═══════════════ First Trip — Migration v2 ═══════════════
-- Run this in Supabase SQL Editor BEFORE seed_data.sql.
-- Reconciles the original schema.sql with fields the frontend (types.ts / components)
-- actually expects, which had drifted out of sync while the site ran on mock data.

-- accommodations: add fields used by the UI / AccommodationManager / map that were
-- never in the original schema (tier, image_url, split location, lat/lng)
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS location_ar TEXT DEFAULT '';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS location_en TEXT DEFAULT '';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- sinai_trips: frontend shows an English duration separately from the Arabic one
ALTER TABLE sinai_trips ADD COLUMN IF NOT EXISTS duration_en TEXT DEFAULT '';

-- trip_dates: frontend types.ts refers to `date`, DB has `trip_date` — no DB change needed,
-- the data layer will alias this when reading/writing.

-- Helpful index for admin search/sort
CREATE INDEX IF NOT EXISTS idx_accommodations_tier ON accommodations(tier);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
