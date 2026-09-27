-- 2026-09-27_wr-2609-0001_reconcile.sql
-- One-off, owner-approved maintenance for confirmed TEST data. Run ONLY after
-- 049_journey_commercial_ownership.sql is applied. Not a migration.
--
-- WHAT
--   WR-2609-0001 was converted before journeys owned their payments, and staff
--   recorded 5,000 EGP (Instapay, ledger entry 1443e829…) on its stay
--   component BK-03BD02AC. 049 therefore classified it MANUAL_FINANCIAL_REVIEW
--   and left it frozen. This script moves the COMMERCIAL EFFECT of that money
--   from the component to the journey — no money moved in the real world.
--
-- HOW (append-only ledger preserved)
--   * The original entry 1443e829… is never updated or deleted.
--   * Entry 1 (component): 'refunded' 5,000 on BK-03BD02AC, amount_paid_after 0,
--     method = the original method, reference/note name the original entry and
--     the journey. It is an internal transfer out, NOT a refund to the customer.
--   * Entry 2 (journey): 'received' 5,000 on WR-2609-0001, received_at = the
--     original received_at, amount_paid_after 5,000, reference/note name the
--     original entry and the component.
--   * BK-03BD02AC: amount_paid 0, payment_status 'unpaid'.
--   * WR-2609-0001: agreed_total 16,300 (its frozen quote_snapshot.total),
--     amount_paid 5,000, payment_status 'partial'.
--   * Test customer phone typo 011111111111 → 01111111111 on the customer row
--     (phone, raw_phone, normalized_phone +201111111111) and the five rows of
--     this journey. Nothing else is touched.
--
-- SAFETY
--   * Runs in ONE transaction. Every precondition below must hold exactly or
--     the script raises and the transaction rolls back — including "no other
--     ledger entry exists on any row of this journey" and "049 is applied".
--   * Uses weemap.payment_maintenance (049/040) for its own writes only.
--   * No standalone booking, other customer, or other ledger entry is read for
--     writing. Postconditions re-check ledger sums = amount_paid for all 5 rows.
--   * Reversible: 2026-09-27_wr-2609-0001_reconcile.REVERSE.sql appends the
--     mirror entries and restores the prior state.

BEGIN;

DO $$
DECLARE
  c_request  CONSTANT UUID := 'd4efee63-7701-47eb-8ca9-78ce7aa47c52';
  c_booking  CONSTANT UUID := '03bd02ac-46bf-4574-9e43-28769354eb13';
  c_original CONSTANT UUID := '1443e829-4185-403d-94ea-1e203dba19b1';
  c_customer CONSTANT UUID := '7c5c23c2-f032-44b4-95b4-42eec12314a9';
  c_trips    CONSTANT UUID[] := ARRAY[
    '1b98b879-f9fe-49d3-a142-a0f00c768fa6', '9efb8d5f-ed09-410a-b58d-89690476c242',
    'ea945fc7-b60f-44d9-b6a0-7cd4f027cde4']::UUID[];
  c_by       CONSTANT TEXT := 'maintenance:049-reconcile-wr-2609-0001';
  r   public.trip_requests%ROWTYPE;
  b   public.bookings%ROWTYPE;
  o   public.payment_records%ROWTYPE;
  n   INTEGER;
  out_id UUID;
  in_id  UUID;
BEGIN
  -- ── Preconditions (fail closed) ──
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                  AND table_name = 'trip_requests' AND column_name = 'agreed_total') THEN
    RAISE EXCEPTION 'precondition: migration 049 is not applied';
  END IF;

  SELECT * INTO r FROM public.trip_requests WHERE id = c_request FOR UPDATE;
  IF NOT FOUND OR r.reference <> 'WR-2609-0001' OR r.customer_name <> 'Test Reservation'
     OR r.customer_id IS DISTINCT FROM c_customer OR r.converted_booking_id IS DISTINCT FROM c_booking
     OR r.agreed_total IS NOT NULL OR r.amount_paid <> 0
     OR (r.quote_snapshot ->> 'total')::NUMERIC <> 16300 THEN
    RAISE EXCEPTION 'precondition: WR-2609-0001 is not in the audited pre-reconcile state';
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = c_booking FOR UPDATE;
  IF NOT FOUND OR b.trip_request_id IS DISTINCT FROM c_request OR b.amount_paid <> 5000
     OR b.payment_status <> 'partial' OR b.total_price <> 11800 THEN
    RAISE EXCEPTION 'precondition: BK-03BD02AC is not in the audited state';
  END IF;

  SELECT count(*) INTO n FROM public.trip_bookings
   WHERE trip_request_id = c_request AND id = ANY (c_trips) AND amount_paid = 0;
  IF n <> 3 OR (SELECT count(*) FROM public.trip_bookings WHERE trip_request_id = c_request) <> 3 THEN
    RAISE EXCEPTION 'precondition: the journey''s three trip components are not the audited unpaid set';
  END IF;

  SELECT * INTO o FROM public.payment_records WHERE id = c_original;
  IF NOT FOUND OR o.entity_type <> 'accommodation_booking' OR o.entity_id <> c_booking
     OR o.direction <> 'received' OR o.amount <> 5000 THEN
    RAISE EXCEPTION 'precondition: original ledger entry 1443e829 is missing or changed';
  END IF;

  SELECT count(*) INTO n FROM public.payment_records
   WHERE entity_id = c_request OR entity_id = c_booking OR entity_id = ANY (c_trips);
  IF n <> 1 THEN
    RAISE EXCEPTION 'precondition: expected exactly 1 ledger entry on this journey, found %', n;
  END IF;

  IF EXISTS (SELECT 1 FROM public.customers WHERE id <> c_customer
              AND (phone = '01111111111' OR normalized_phone = '+201111111111')) THEN
    RAISE EXCEPTION 'precondition: another customer already holds 01111111111';
  END IF;

  -- ── Writes ──
  PERFORM set_config('weemap.payment_maintenance', 'on', true);

  INSERT INTO public.payment_records (entity_type, entity_id, direction, amount, method, reference, note,
                                      received_at, recorded_by, amount_paid_after)
  VALUES ('accommodation_booking', c_booking, 'refunded', 5000, o.method, 'transfer:' || c_original::text,
          'Internal transfer (not a customer refund): commercial effect of payment ' || c_original::text
            || ' moved to journey WR-2609-0001 (' || c_request::text || ') after migration 049.',
          NOW(), c_by, 0)
  RETURNING id INTO out_id;

  INSERT INTO public.payment_records (entity_type, entity_id, direction, amount, method, reference, note,
                                      received_at, recorded_by, amount_paid_after)
  VALUES ('trip_request', c_request, 'received', 5000, o.method, 'transfer:' || c_original::text,
          'Internal transfer in: original payment ' || c_original::text || ' (ref ' || o.reference
            || ', received ' || o.received_at::text || ') on component BK-03BD02AC (' || c_booking::text
            || '); paired with ' || out_id::text || '.',
          o.received_at, c_by, 5000)
  RETURNING id INTO in_id;

  UPDATE public.bookings SET amount_paid = 0, payment_status = 'unpaid' WHERE id = c_booking;
  UPDATE public.trip_requests
     SET agreed_total = 16300, amount_paid = 5000, payment_status = 'partial'
   WHERE id = c_request;

  -- Test-data phone correction (owner-approved).
  UPDATE public.customers
     SET phone = '01111111111', raw_phone = '01111111111', normalized_phone = '+201111111111'
   WHERE id = c_customer AND phone = '011111111111';
  UPDATE public.trip_requests SET customer_phone = '01111111111'
   WHERE id = c_request AND customer_phone = '011111111111';
  UPDATE public.bookings SET customer_phone = '01111111111'
   WHERE id = c_booking AND customer_phone = '011111111111';
  UPDATE public.trip_bookings SET customer_phone = '01111111111'
   WHERE id = ANY (c_trips) AND customer_phone = '011111111111';

  PERFORM set_config('weemap.payment_maintenance', 'off', true);

  -- ── Postconditions ──
  IF (SELECT COALESCE(sum(CASE direction WHEN 'received' THEN amount ELSE -amount END), 0)
        FROM public.payment_records WHERE entity_id = c_booking) <> 0
     OR (SELECT amount_paid FROM public.bookings WHERE id = c_booking) <> 0 THEN
    RAISE EXCEPTION 'postcondition: component ledger/amount_paid not zero';
  END IF;
  IF (SELECT COALESCE(sum(CASE direction WHEN 'received' THEN amount ELSE -amount END), 0)
        FROM public.payment_records WHERE entity_type = 'trip_request' AND entity_id = c_request) <> 5000
     OR (SELECT (agreed_total, amount_paid, payment_status) FROM public.trip_requests WHERE id = c_request)
        IS DISTINCT FROM (16300::NUMERIC(12,2), 5000::NUMERIC(12,2), 'partial'::TEXT) THEN
    RAISE EXCEPTION 'postcondition: journey is not 16,300 / 5,000 / partial';
  END IF;
  IF (SELECT count(*) FROM public.payment_records WHERE id = c_original AND amount = 5000
        AND entity_id = c_booking AND direction = 'received') <> 1 THEN
    RAISE EXCEPTION 'postcondition: original ledger entry altered';
  END IF;
  IF (SELECT count(*) FROM (
        SELECT id FROM public.customers WHERE id = c_customer AND phone = '01111111111'
        UNION ALL SELECT id FROM public.trip_requests WHERE id = c_request AND customer_phone = '01111111111'
        UNION ALL SELECT id FROM public.bookings WHERE id = c_booking AND customer_phone = '01111111111'
        UNION ALL SELECT id FROM public.trip_bookings WHERE id = ANY (c_trips) AND customer_phone = '01111111111'
      ) fixed) <> 6 THEN
    RAISE EXCEPTION 'postcondition: phone correction did not land on exactly the 6 rows';
  END IF;

  RAISE NOTICE 'reconciled WR-2609-0001: out % / in %', out_id, in_id;
END
$$;

-- Read-back (same transaction).
SELECT reference, agreed_total, amount_paid, payment_status, customer_phone
  FROM public.trip_requests WHERE id = 'd4efee63-7701-47eb-8ca9-78ce7aa47c52';
SELECT id, entity_type, entity_id, direction, amount, reference, recorded_by, amount_paid_after
  FROM public.payment_records
 WHERE entity_id IN ('d4efee63-7701-47eb-8ca9-78ce7aa47c52', '03bd02ac-46bf-4574-9e43-28769354eb13')
 ORDER BY created_at;

COMMIT;
