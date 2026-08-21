-- WEEMAP SINAI · Migration 014 · Harden normalize_phone_eg search_path
-- Addresses Supabase security advisor WARN "function_search_path_mutable".
-- Consistent with 009_harden_updated_at_function.sql's precedent.

ALTER FUNCTION public.normalize_phone_eg(text) SET search_path = public, pg_temp;
