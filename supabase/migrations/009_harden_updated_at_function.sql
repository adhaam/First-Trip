-- WEEMAP SINAI · Migration 009 · Harden shared updated_at trigger function
-- The function only needs pg_catalog.NOW() and the trigger's NEW row.

BEGIN;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog;

COMMIT;
