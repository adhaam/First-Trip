-- WEEMAP SINAI · Migration 006 · final safe public-content controls
-- Additive only. Run after 005_weemap_website_cms.sql.

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Dahab, South Sinai, Egypt',
  ADD COLUMN IF NOT EXISTS primary_cta_label_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_cta_label_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_cta_label_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_cta_label_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_share_image TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS organization_name TEXT NOT NULL DEFAULT 'WEEMAP SINAI';
