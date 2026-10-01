-- fresh-launch-reset.restore.sql — RECOVERY ONLY. DO NOT RUN without explicit owner approval.
--
-- Puts back every row removed by fresh-launch-reset.sql (v2, Tier A + Tier B, committed 2026-10-01,
-- snapshot captured 2026-10-01 16:28:25.559803+00, WAL 5/19000000) from the maintenance.flr_20261001_* tables.
--
-- Rows go back byte-for-byte (same ids, timestamps, payment amounts). To achieve that, user triggers on the target
-- tables are disabled for this transaction only, so that:
--   * weemap_payment_opening_balance does not invent a second ledger entry for the restored 5000 booking;
--   * weemap_record_change / weemap_stamp_lifecycle / weemap_customer_events do not add fresh history rows
--     (the original history rows are restored from the snapshot instead);
--   * update_*_updated_at does not overwrite the original timestamps.
-- Foreign keys stay enforced (they are system triggers, untouched by DISABLE TRIGGER USER).
-- The snapshot tables are NOT dropped by this script.

BEGIN;

DO $restore$
DECLARE
  t text;
  n bigint;
  m bigint;
BEGIN
  -- Guard: nothing being restored may already exist (no double restore, no id clash).
  FOREACH t IN ARRAY array['customers', 'trip_requests', 'bookings', 'trip_bookings', 'payment_records',
                           'ai_leads', 'ai_messages', 'status_history', 'domain_events']
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I p JOIN maintenance.%I s USING (id)', t, 'flr_20261001_' || t) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'restore: % already has % of the snapshot ids', t, n; END IF;
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
  END LOOP;

  INSERT INTO public.customers     SELECT * FROM maintenance.flr_20261001_customers;
  -- trip_requests <-> bookings reference each other: insert the request without its booking link first.
  INSERT INTO public.trip_requests
  SELECT (jsonb_populate_record(NULL::public.trip_requests, to_jsonb(s) || '{"converted_booking_id": null}')).*
    FROM maintenance.flr_20261001_trip_requests s;
  INSERT INTO public.bookings      SELECT * FROM maintenance.flr_20261001_bookings;
  UPDATE public.trip_requests r SET converted_booking_id = s.converted_booking_id
    FROM maintenance.flr_20261001_trip_requests s WHERE r.id = s.id;
  INSERT INTO public.trip_bookings   SELECT * FROM maintenance.flr_20261001_trip_bookings;
  INSERT INTO public.payment_records SELECT * FROM maintenance.flr_20261001_payment_records;
  INSERT INTO public.ai_leads        SELECT * FROM maintenance.flr_20261001_ai_leads;
  INSERT INTO public.ai_messages     SELECT * FROM maintenance.flr_20261001_ai_messages;
  INSERT INTO public.status_history  SELECT * FROM maintenance.flr_20261001_status_history;
  INSERT INTO public.domain_events   SELECT * FROM maintenance.flr_20261001_domain_events;

  -- Prove every snapshot row is back, identical, before re-enabling triggers.
  FOREACH t IN ARRAY array['customers', 'trip_requests', 'bookings', 'trip_bookings', 'payment_records',
                           'ai_leads', 'ai_messages', 'status_history', 'domain_events']
  LOOP
    EXECUTE format('SELECT count(*) FROM maintenance.%I', 'flr_20261001_' || t) INTO m;
    EXECUTE format('SELECT count(*) FROM maintenance.%I s JOIN public.%I p USING (id)
                     WHERE to_jsonb(s) = to_jsonb(p)', 'flr_20261001_' || t, t) INTO n;
    IF n <> m THEN RAISE EXCEPTION 'restore: % has % identical rows, snapshot has %', t, n, m; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
  END LOOP;

  RAISE NOTICE 'fresh-launch restore complete';
END
$restore$;

COMMIT;
