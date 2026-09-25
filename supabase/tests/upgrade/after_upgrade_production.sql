-- Checks after 029 → latest on the production-shaped database
-- (production_shape.sql + production_fixture.sql). Rolled back. LOCAL ONLY.
\set ON_ERROR_STOP 1

BEGIN;
DO $$
DECLARE
  n   INTEGER;
  got TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Data intact; no money existed, so the 040 backfill added nothing.
  IF (SELECT count(*) FROM customers) <> 13 OR (SELECT count(*) FROM bookings) <> 4
     OR (SELECT count(*) FROM trip_bookings) <> 4 THEN
    RAISE EXCEPTION 'row counts changed by the upgrade';
  END IF;
  IF (SELECT count(*) FROM payment_records) <> 0 THEN RAISE EXCEPTION 'unexpected ledger rows'; END IF;
  -- 030 classified every legacy row.
  IF EXISTS (SELECT 1 FROM bookings WHERE payment_kind IS NULL)
     OR EXISTS (SELECT 1 FROM trip_bookings WHERE payment_kind IS NULL) THEN
    RAISE EXCEPTION 'payment_kind missing after upgrade';
  END IF;
  SELECT string_agg(DISTINCT payment_kind, ',' ORDER BY payment_kind) INTO got FROM bookings;
  IF got <> 'stay,stay_package' THEN RAISE EXCEPTION 'booking kinds %', got; END IF;
  SELECT payment_kind INTO got FROM trip_bookings WHERE trip_package_id IS NOT NULL;
  IF got <> 'experience_package' THEN RAISE EXCEPTION 'package booking kind %', got; END IF;

  -- Production's Ask WEEMAP shape survives and still works.
  INSERT INTO ai_leads (session_id, name, whatsapp, locale, source)
    VALUES ('a1400000-0000-4000-8000-000000000002', 'Synthetic Lead 2', '+201000099998', 'en', 'website_ai');
  SELECT handoff_status INTO got FROM ai_leads WHERE session_id = 'a1400000-0000-4000-8000-000000000001';
  IF got <> 'human' THEN RAISE EXCEPTION 'ai_leads data changed'; END IF;

  -- M4 invariants are live on this shape.
  BEGIN
    UPDATE bookings SET amount_paid = 10 WHERE id = 'b1000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'direct money write accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF to_regclass('public.staff_users') IS NULL OR to_regclass('public.payment_records') IS NULL
     OR to_regclass('public.ops_work_items') IS NULL OR to_regclass('public.public_search_documents') IS NULL THEN
    RAISE EXCEPTION 'M3 objects missing';
  END IF;
  SELECT count(*) INTO n FROM ops_work_items;
  IF n < 8 THEN RAISE EXCEPTION 'work queue lost rows (%)', n; END IF;

  -- 042: the newsletter capability exists, server-only.
  INSERT INTO newsletter_subscribers (email, locale, source) VALUES ('reader@example.test', 'ar', 'homepage-footer')
    ON CONFLICT (email) DO UPDATE SET unsubscribed = false;
  INSERT INTO newsletter_subscribers (email, locale, source) VALUES ('reader@example.test', 'en', 'footer')
    ON CONFLICT (email) DO UPDATE SET unsubscribed = false;
  IF (SELECT count(*) FROM newsletter_subscribers) <> 1 THEN RAISE EXCEPTION 'upsert on email broken'; END IF;
  UPDATE newsletter_subscribers SET unsubscribed = true WHERE email = 'reader@example.test';
  BEGIN
    INSERT INTO newsletter_subscribers (email, locale) VALUES ('x@example.test', 'fr');
    RAISE EXCEPTION 'unknown locale accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Security posture (041 + 042).
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'authenticated policy survived';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'newsletter_subscribers'
              AND policyname <> 'newsletter_subscribers_service_role_all') THEN
    RAISE EXCEPTION 'newsletter has a non-server policy';
  END IF;
  IF has_table_privilege('anon', 'public.newsletter_subscribers', 'SELECT')
     OR has_table_privilege('anon', 'public.newsletter_subscribers', 'INSERT')
     OR has_table_privilege('authenticated', 'public.newsletter_subscribers', 'UPDATE')
     OR has_table_privilege('anon', 'public.customers', 'SELECT')
     OR has_table_privilege('authenticated', 'public.bookings', 'UPDATE')
     OR has_table_privilege('anon', 'public.site_settings', 'UPDATE') THEN
    RAISE EXCEPTION 'untrusted roles keep privileges';
  END IF;
  SELECT string_agg(p.proname, ', ') INTO got FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');
  IF got IS NOT NULL THEN RAISE EXCEPTION 'anon can execute %', got; END IF;
  RAISE NOTICE 'production-shaped upgrade checks: PASS';
END
$$;
ROLLBACK;

-- Behaviour as the untrusted roles, not just catalog flags.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true) AS jwt \gset
DO $$
BEGIN
  BEGIN
    INSERT INTO public.newsletter_subscribers (email) VALUES ('anon@example.test');
    RAISE EXCEPTION 'anon inserted a newsletter row';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.newsletter_subscribers;
    RAISE EXCEPTION 'anon read newsletter subscribers';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.customers;
    RAISE EXCEPTION 'anon read customers';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true) AS jwt \gset
DO $$
BEGIN
  BEGIN
    UPDATE public.newsletter_subscribers SET unsubscribed = true;
    RAISE EXCEPTION 'authenticated updated newsletter rows';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.site_settings SET payment_instructions_en = 'x';
    RAISE EXCEPTION 'authenticated rewrote payment instructions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;
ROLLBACK;
