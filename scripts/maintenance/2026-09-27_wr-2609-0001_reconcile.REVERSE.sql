-- 2026-09-27_wr-2609-0001_reconcile.REVERSE.sql
-- Undo of 2026-09-27_wr-2609-0001_reconcile.sql. Append-only: it never deletes
-- the transfer entries — it appends their mirror and restores the prior state
-- (money back on BK-03BD02AC, journey frozen again as MANUAL_FINANCIAL_REVIEW).
-- The phone correction is NOT reverted (it fixes a typo). Run only if the
-- journey has had no further payments since the reconcile.

BEGIN;

DO $$
DECLARE
  c_request  CONSTANT UUID := 'd4efee63-7701-47eb-8ca9-78ce7aa47c52';
  c_booking  CONSTANT UUID := '03bd02ac-46bf-4574-9e43-28769354eb13';
  c_original CONSTANT UUID := '1443e829-4185-403d-94ea-1e203dba19b1';
  c_by       CONSTANT TEXT := 'maintenance:049-reconcile-wr-2609-0001:reverse';
  o public.payment_records%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.payment_records WHERE id = c_original;
  IF (SELECT (agreed_total, amount_paid, payment_status) FROM public.trip_requests WHERE id = c_request FOR UPDATE)
       IS DISTINCT FROM (16300::NUMERIC(12,2), 5000::NUMERIC(12,2), 'partial'::TEXT)
     OR (SELECT amount_paid FROM public.bookings WHERE id = c_booking FOR UPDATE) <> 0
     OR (SELECT count(*) FROM public.payment_records
          WHERE entity_type = 'trip_request' AND entity_id = c_request) <> 1 THEN
    RAISE EXCEPTION 'precondition: journey is not in the exact post-reconcile state; reverse refused';
  END IF;

  PERFORM set_config('weemap.payment_maintenance', 'on', true);
  INSERT INTO public.payment_records (entity_type, entity_id, direction, amount, method, reference, note,
                                      received_at, recorded_by, amount_paid_after)
  VALUES ('trip_request', c_request, 'refunded', 5000, o.method, 'transfer-reversal:' || c_original::text,
          'Reversal of the 049 reconcile transfer: commercial effect returned to component BK-03BD02AC.',
          NOW(), c_by, 0),
         ('accommodation_booking', c_booking, 'received', 5000, o.method, 'transfer-reversal:' || c_original::text,
          'Reversal of the 049 reconcile transfer: original payment ' || c_original::text || ' restored here.',
          o.received_at, c_by, 5000);
  UPDATE public.bookings SET amount_paid = 5000, payment_status = 'partial' WHERE id = c_booking;
  UPDATE public.trip_requests SET agreed_total = NULL, amount_paid = 0, payment_status = NULL WHERE id = c_request;
  PERFORM set_config('weemap.payment_maintenance', 'off', true);
END
$$;

COMMIT;
