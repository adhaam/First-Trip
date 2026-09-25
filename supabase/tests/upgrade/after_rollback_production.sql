-- After supabase/rollback/m4_app_rollback_guards.sql on the production-shaped
-- rehearsal: the pre-M4 admin's writes work again, nothing was lost, the
-- privilege hardening and the newsletter table stay. Rolled back. LOCAL ONLY.
\set ON_ERROR_STOP 1
BEGIN;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE bookings SET amount_paid = 100, payment_status = 'partial'
   WHERE id = 'b1000000-0000-4000-8000-000000000001';
  IF (SELECT count(*) FROM bookings) <> 4 OR (SELECT count(*) FROM customers) <> 13 THEN
    RAISE EXCEPTION 'rows lost by the rollback helper';
  END IF;
  IF to_regclass('public.newsletter_subscribers') IS NULL THEN
    RAISE EXCEPTION 'rollback helper removed the newsletter table';
  END IF;
  IF has_table_privilege('anon', 'public.customers', 'SELECT')
     OR has_table_privilege('anon', 'public.newsletter_subscribers', 'INSERT') THEN
    RAISE EXCEPTION 'rollback helper undid the privilege hardening';
  END IF;
END
$$;
ROLLBACK;
