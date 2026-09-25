-- After supabase/rollback/m4_app_rollback_guards.sql: the pre-M4 admin's
-- writes work again and no data was lost. Rolled back. LOCAL ONLY.
\set ON_ERROR_STOP 1
BEGIN;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  -- old admin: free-edit payment fields
  UPDATE bookings SET amount_paid = 600, payment_status = 'partial' WHERE id = 'b0000000-0000-4000-8000-000000000001';
  -- old admin: pickup through out_for_delivery
  UPDATE commerce_orders SET status = 'out_for_delivery' WHERE id = 'e0000000-0000-4000-8000-000000000002';
  IF (SELECT count(*) FROM payment_records WHERE recorded_by = 'migration:040') <> 5 THEN
    RAISE EXCEPTION 'ledger rows lost by the rollback helper';
  END IF;
  IF has_table_privilege('anon', 'public.customers', 'SELECT') THEN
    RAISE EXCEPTION 'rollback helper undid the privilege hardening';
  END IF;
END
$$;
ROLLBACK;
