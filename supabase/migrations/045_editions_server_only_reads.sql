-- 045_editions_server_only_reads.sql
--
-- WEEMAP Editions: remove the anon/authenticated SELECT policy added in 044.
--
-- Why: Postgres RLS is row-level only. `editions_public_read` let any holder of
-- the anon key read every column of published Editions through PostgREST,
-- including internal worksheet columns (cost_variable_per_guest_egp,
-- cost_fixed_egp, contingency_pct, min_group_size, partner_id). The app never
-- reads Editions with the anon key: public pages go through the service-role
-- client in src/lib/editions-data.ts with an explicit public column list.
-- This matches migration 041, which removed anon policies project-wide.
--
-- Additive-safe: drops only a policy on the 044 table. Safe to re-run.

DROP POLICY IF EXISTS "editions_public_read" ON public.editions;
