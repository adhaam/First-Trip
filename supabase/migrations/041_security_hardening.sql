-- 041_security_hardening.sql
-- Launch security pass on database privileges (WEEMAP M4).
--
-- WHY
--   The website and the Operations Center reach the database ONLY through the
--   server (service role; src/lib/supabase.ts). Nothing uses the anon key or
--   Supabase Auth. Yet the pre-M1 schema still carried:
--     * "Admins can manage …" policies USING auth.role() = 'authenticated' on
--       bookings, customers, accommodations, seasonal rates, community posts,
--       governorate / transfer pricing, sinai trips, site settings,
--       testimonials, transfer settings and trip dates. Anyone able to obtain
--       an authenticated Supabase JWT (for example by signing up through the
--       project's Auth endpoint, if sign-up is enabled) could read every
--       customer's contact details and every booking, and rewrite prices,
--       the catalogue, or the payment instructions customers pay to.
--     * "Anyone can create …" INSERT policies on bookings, customers,
--       Signature requests, partner inquiries and newsletter subscribers,
--       letting a holder of the anon key insert rows that bypass server
--       validation and server pricing.
--     * The Supabase default grants: anon / authenticated hold INSERT,
--       UPDATE, DELETE and TRUNCATE on every table and EXECUTE on every
--       function. RLS was the only barrier.
--     * Staff sign-in rate limiting lived in the memory of one server
--       instance, so it did not hold across serverless instances.
--
-- CONTRACT
--   * No policy grants anything to 'authenticated' or lets anon write. Public
--     catalogue tables keep their read-only "is_active / is_published"
--     policies (the same rows the website shows).
--   * anon / authenticated: no write privilege on any public table; no SELECT
--     on tables that have no public-read policy (customers, bookings, staff,
--     audit, ledger, orders, requests, AI conversations, …); no EXECUTE on
--     any WEEMAP function. Future tables and functions created by 'postgres'
--     get no such default grants either.
--   * staff_login_throttle + weemap_login_throttle_check() /
--     weemap_login_throttle_record(): failed staff sign-ins are counted in the
--     database under hashed keys (the server passes sha256 of the email and
--     of the IP — no plain address is stored). A key locked out stays locked
--     until locked_until; a success clears the account key.
--   * Service role keeps full access (it bypasses RLS).
--
-- Additive for data; drops only the policies named above. Safe to re-run.

-- ─── 1. Legacy policies ───
DROP POLICY IF EXISTS "Admins can manage accommodations"              ON public.accommodations;
DROP POLICY IF EXISTS "Admins can manage seasonal rates"              ON public.accommodation_seasonal_rates;
DROP POLICY IF EXISTS "Admins can manage bookings"                    ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create a booking"                   ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage community posts"             ON public.community_posts;
DROP POLICY IF EXISTS "Admins can manage customers"                   ON public.customers;
DROP POLICY IF EXISTS "Anyone can create a customer"                  ON public.customers;
DROP POLICY IF EXISTS "experience_bookings_public_insert"             ON public.experience_bookings;
DROP POLICY IF EXISTS "Admins can manage governorate pricing"         ON public.governorate_pricing;
DROP POLICY IF EXISTS "Anyone can subscribe"                          ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "public can subscribe"                          ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "partner_inquiries_public_insert"               ON public.partner_inquiries;
DROP POLICY IF EXISTS "Admins can manage sinai trips"                 ON public.sinai_trips;
DROP POLICY IF EXISTS "Admins can manage site settings"               ON public.site_settings;
DROP POLICY IF EXISTS "Admins can manage testimonials"                ON public.testimonials;
DROP POLICY IF EXISTS "Admins can manage transfer governorate pricing" ON public.transfer_governorate_pricing;
DROP POLICY IF EXISTS "Admins can manage transfer settings"           ON public.transfer_settings;
DROP POLICY IF EXISTS "Admins can manage trip dates"                  ON public.trip_dates;

-- Belt and braces for drift: any other policy on a public table that is not
-- a plain read and names 'authenticated' or grants a write to anon/public
-- without the service role in it is dropped too.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) NOT LIKE '%service_role%'
      AND NOT roles @> ARRAY['service_role']::NAME[]
      AND (cmd <> 'SELECT' OR (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%authenticated%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    RAISE NOTICE 'dropped policy % on %', p.policyname, p.tablename;
  END LOOP;
END
$$;

-- ─── 2. Table privileges ───
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname, c.relkind FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated, PUBLIC', t.relname);
    -- Keep SELECT only where a public-read policy exposes rows on purpose
    -- (views: only experience_date_availability, a security_invoker view
    -- over public rows).
    IF (t.relkind IN ('r', 'p') AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = t.relname AND p.cmd = 'SELECT'
            AND NOT p.roles @> ARRAY['service_role']::NAME[]
            AND COALESCE(p.qual, '') NOT LIKE '%service_role%'))
       OR (t.relkind IN ('v', 'm') AND t.relname <> 'experience_date_availability') THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated, PUBLIC', t.relname);
    END IF;
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END
$$;

REVOKE USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ─── 3. Function privileges (WEEMAP's own functions, not extensions') ───
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END
$$;

-- ─── 4. Defaults for objects created later by migrations ───
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- ─── 5. Staff sign-in throttle (shared by every server instance) ───
CREATE TABLE IF NOT EXISTS public.staff_login_throttle (
  key               TEXT PRIMARY KEY,            -- 'email:<sha256>' / 'ip:<sha256>'
  failures          INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.staff_login_throttle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_login_throttle_service_role_all" ON public.staff_login_throttle;
CREATE POLICY "staff_login_throttle_service_role_all" ON public.staff_login_throttle
  FOR ALL USING (auth.role() = 'service_role');
REVOKE ALL ON public.staff_login_throttle FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.staff_login_throttle TO service_role;

-- Latest lock among the keys, or NULL when none is locked.
CREATE OR REPLACE FUNCTION public.weemap_login_throttle_check(p_keys TEXT[])
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT max(locked_until) FROM public.staff_login_throttle
  WHERE key = ANY (p_keys) AND locked_until > NOW()
$$;

-- p_limits: parallel to p_keys, the failures allowed per window for each key.
CREATE OR REPLACE FUNCTION public.weemap_login_throttle_record(
  p_keys TEXT[], p_limits INTEGER[], p_success BOOLEAN,
  p_window INTERVAL DEFAULT INTERVAL '15 minutes', p_lock INTERVAL DEFAULT INTERVAL '15 minutes'
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  i INTEGER;
  locked TIMESTAMPTZ;
BEGIN
  -- Housekeeping: forget idle keys so the table stays tiny.
  DELETE FROM public.staff_login_throttle
   WHERE updated_at < NOW() - INTERVAL '1 day' AND (locked_until IS NULL OR locked_until < NOW());
  IF p_success THEN
    DELETE FROM public.staff_login_throttle WHERE key = ANY (p_keys) AND key LIKE 'email:%';
    RETURN NULL;
  END IF;
  FOR i IN 1 .. COALESCE(array_length(p_keys, 1), 0) LOOP
    INSERT INTO public.staff_login_throttle AS t (key, failures, window_started_at, updated_at)
    VALUES (p_keys[i], 1, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET
      failures = CASE WHEN t.window_started_at < NOW() - p_window THEN 1 ELSE t.failures + 1 END,
      window_started_at = CASE WHEN t.window_started_at < NOW() - p_window THEN NOW() ELSE t.window_started_at END,
      updated_at = NOW();
    UPDATE public.staff_login_throttle
       SET locked_until = NOW() + p_lock, failures = 0, window_started_at = NOW()
     WHERE key = p_keys[i] AND failures >= p_limits[i];
  END LOOP;
  RETURN public.weemap_login_throttle_check(p_keys);
END
$$;

REVOKE ALL ON FUNCTION public.weemap_login_throttle_check(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_login_throttle_record(TEXT[], INTEGER[], BOOLEAN, INTERVAL, INTERVAL)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_login_throttle_check(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_login_throttle_record(TEXT[], INTEGER[], BOOLEAN, INTERVAL, INTERVAL)
  TO service_role;

-- ─── 6. Server-side sign-out ───
-- 035 re-pins session_version on every update that does not change access,
-- so it could not be bumped on purpose. Sign-out (POST /api/admin/logout) now
-- raises it to revoke the person's outstanding tokens; lowering it — which
-- would revive old tokens — stays impossible.
CREATE OR REPLACE FUNCTION public.weemap_staff_bump_session()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.session_version := GREATEST(OLD.session_version + 1, COALESCE(NEW.session_version, 0));
  ELSIF NEW.session_version IS NOT NULL AND NEW.session_version > OLD.session_version THEN
    NEW.session_version := OLD.session_version + 1;  -- explicit sign-out
  ELSE
    NEW.session_version := OLD.session_version;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.weemap_staff_bump_session() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
