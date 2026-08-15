-- ═══════════════════════════════════════════════════════════════════════════
-- WEEMAP SINAI · Migration 005 · Website CMS settings
-- ───────────────────────────────────────────────────────────────────────────
-- Additive only. Structured, safe website controls so the owner can edit
-- important homepage/SEO content from the dashboard without touching code.
-- No free-form page builder — just typed columns with sensible defaults.
-- Run AFTER 004_weemap_pricing_engine_v2.sql.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE site_settings
  -- Homepage hero copy (empty = the built-in WEEMAP default is used)
  ADD COLUMN IF NOT EXISTS hero_heading_ar    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_heading_en    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_subheading_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_subheading_en TEXT NOT NULL DEFAULT '',
  -- Featured content pickers (empty = automatic selection)
  ADD COLUMN IF NOT EXISTS featured_accommodation_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured_trip_ids          UUID[] NOT NULL DEFAULT '{}',
  -- Safe homepage section visibility toggles
  ADD COLUMN IF NOT EXISTS show_community  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_partners   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_newsletter BOOLEAN NOT NULL DEFAULT true,
  -- Global SEO (empty = built-in defaults from the app)
  ADD COLUMN IF NOT EXISTS seo_title          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description_en TEXT NOT NULL DEFAULT '';
