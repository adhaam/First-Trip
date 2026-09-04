-- 023_accommodations_rating_allow_decimal.sql
--
-- RECOVERED FROM PRODUCTION. Applied to the live database on 2026-08-23 as
-- `accommodations_rating_allow_decimal` (version 20260823153451) but never
-- committed here, so this folder did not reproduce production. Recovered
-- verbatim from supabase_migrations.schema_migrations.
--
-- The file number reflects the order it is applied in on a fresh database,
-- NOT when it was originally applied. It only alters a column on a table
-- created long before, so running it last is equivalent.
--
-- Ratings are shown as 4.3 / 4.7 in the admin list and on cards; the column
-- was an integer, which silently truncated them.

ALTER TABLE public.accommodations ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);
ALTER TABLE public.accommodations ALTER COLUMN rating SET DEFAULT 4;
