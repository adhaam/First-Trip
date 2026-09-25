-- Checks run by scripts/db-upgrade-check.sh AFTER the release migrations were
-- applied on top of legacy_fixture.sql. Rolled back. LOCAL ONLY.
\set ON_ERROR_STOP 1

BEGIN;
DO $$
DECLARE
  n   INTEGER;
  got TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Legacy money is now in the ledger, once, and every row reconciles.
  SELECT count(*) INTO n FROM payment_records WHERE recorded_by = 'migration:040';
  IF n <> 5 THEN RAISE EXCEPTION 'expected 5 opening balances, got %', n; END IF;
  SELECT count(*) INTO n FROM (
    SELECT t.id, t.amount_paid FROM (
      SELECT id, amount_paid, 'accommodation_booking' et FROM bookings
      UNION ALL SELECT id, amount_paid, 'trip_booking' FROM trip_bookings
      UNION ALL SELECT id, amount_paid, 'signature_request' FROM experience_bookings
      UNION ALL SELECT id, amount_paid, 'commerce_order' FROM commerce_orders) t
    LEFT JOIN payment_records p ON p.entity_type = t.et AND p.entity_id = t.id
    GROUP BY t.id, t.amount_paid
    HAVING COALESCE(t.amount_paid, 0)
      <> COALESCE(SUM(CASE p.direction WHEN 'received' THEN p.amount ELSE -p.amount END), 0)) off;
  IF n <> 0 THEN RAISE EXCEPTION '% rows do not reconcile after upgrade', n; END IF;

  -- The legacy row with more received than its total is intact and still
  -- editable in ways that do not touch money.
  UPDATE bookings SET notes = 'checked' WHERE id = 'b0000000-0000-4000-8000-000000000003';
  SELECT payment_status INTO got FROM bookings WHERE id = 'b0000000-0000-4000-8000-000000000003';
  IF got <> 'paid' THEN RAISE EXCEPTION 'legacy payment_status rewritten to %', got; END IF;

  -- payment_kind backfilled by 030 on legacy rows.
  SELECT count(*) INTO n FROM bookings WHERE payment_kind IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% bookings without payment_kind', n; END IF;

  -- A legacy pickup order already out for delivery can take notes and finish.
  UPDATE commerce_orders SET internal_notes = 'handed over at the shop'
   WHERE id = 'e0000000-0000-4000-8000-000000000001';
  PERFORM weemap_set_commerce_order_status('e0000000-0000-4000-8000-000000000001', 'out_for_delivery', 'completed');
  -- The legacy delivery order follows the delivery path.
  BEGIN
    PERFORM weemap_set_commerce_order_status('e0000000-0000-4000-8000-000000000002', 'ready', 'completed');
    RAISE EXCEPTION 'legacy delivery order skipped delivery';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;

  -- Legacy policies are gone.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'legacy authenticated policy survived the upgrade';
  END IF;
  IF has_table_privilege('anon', 'public.customers', 'SELECT')
     OR has_table_privilege('authenticated', 'public.bookings', 'UPDATE') THEN
    RAISE EXCEPTION 'untrusted roles keep privileges after the upgrade';
  END IF;

  -- Re-running the release migrations must not add ledger rows twice
  -- (checked by the caller re-applying 040; here: count is stable).
  RAISE NOTICE 'upgrade checks: PASS';
END
$$;
ROLLBACK;
