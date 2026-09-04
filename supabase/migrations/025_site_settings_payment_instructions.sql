-- 025_site_settings_payment_instructions.sql
--
-- RECOVERED FROM PRODUCTION. Applied to the live database on 2026-08-25 as
-- `018_site_settings_payment_instructions` (version 20260825164906) but never
-- committed here. Recovered verbatim from
-- supabase_migrations.schema_migrations.
--
-- The file number reflects apply order on a fresh database, not the original
-- date. Renaming from 018 avoids colliding with this folder's existing
-- 018_signature_experiences.sql — the same collision that let the drift go
-- unnoticed.
--
-- Owner-editable text shown to the customer explaining how to pay and
-- confirm a booking.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS payment_instructions_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_instructions_en TEXT NOT NULL DEFAULT '';
