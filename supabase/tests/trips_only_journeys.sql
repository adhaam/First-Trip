-- Trips-only journey invariants (migration 052). Run by
-- scripts/db-bootstrap-check.sh against a disposable local database — never
-- production. Everything runs inside a transaction that is rolled back.
--
-- Proves, independent of the app:
--   1. A self-arrival request with no accommodation and ≥1 trip converts:
--      trip_bookings children are created, NO bookings (stay/transfer) row
--      exists, converted_at + agreed_total are set, converted_booking_id
--      stays NULL, a second convert reports already_converted and creates
--      nothing.
--   2. ops_work_items: exactly one parent row, converted = true,
--      payment_kind 'trip' (100% after confirmation), the trip child is a
--      journey_component.
--   3. The parent takes the payment (weemap_record_payment 'trip_request'),
--      the child refuses one (component_of_journey).
--   4. A trips-only request with a stay/transfer amount in its snapshot is
--      refused (snapshot_mismatch); one with no experiences is refused
--      (missing_accommodation).
--   5. Amendments: trips-only stays trips-only in place (trip child re-priced,
--      still no bookings row); adding a stay to a converted trips-only
--      journey is refused (amendment_changes_journey_shape).
--   6. A stay journey still converts exactly as before (one bookings child,
--      payment_kind 'journey').
\set ON_ERROR_STOP 1

BEGIN;

CREATE FUNCTION pg_temp.ts(p_id UUID) RETURNS TIMESTAMPTZ LANGUAGE sql AS $$
  SELECT updated_at FROM public.trip_requests WHERE id = p_id
$$;

DO $$
DECLARE
  owner_id UUID := '11111111-2222-4333-8444-555555555555';
  acc_id   UUID;
  trip1    UUID;
  req      UUID;
  bad      UUID;
  stay_req UUID;
  tb_id    UUID;
  res      JSONB;
  n        INTEGER;
  w        RECORD;
  journey  JSONB;
BEGIN
  PERFORM set_config('weemap.actor', 'staff:' || owner_id, true);

  INSERT INTO accommodations (name_ar, name_en, type) VALUES ('to', 'Trips Only Test Stay', 'hotel') RETURNING id INTO acc_id;
  INSERT INTO sinai_trips (name_ar, name_en, price) VALUES ('t', 'Trips Only Test Trip', 900) RETURNING id INTO trip1;

  -- ── 1. Trips-only conversion ──
  INSERT INTO trip_requests (
    transport_mode, arrival_date, departure_date, adults, children, accommodation_id, room_allocations,
    experiences, quote_snapshot, quoted_total, payment_plan, customer_name, customer_phone)
  VALUES (
    'stay_only', '2026-10-10', '2026-10-12', 2, 0, NULL, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('kind', 'trip', 'id', trip1)),
    jsonb_build_object('total', 1800, 'num_people', 2, 'extra_trips_subtotal', 1800,
      'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip1, 'name_en', 'Trips Only Test Trip', 'price', 900))),
    1800, '{"kind":"trip","upfrontPercent":100}'::jsonb, 'Trips Only Synthetic', '01000000052')
  RETURNING id INTO req;

  UPDATE trip_requests SET status = 'checking_availability' WHERE id = req;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = req;
  res := weemap_convert_trip_request(req);

  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = req;
  IF n <> 0 THEN RAISE EXCEPTION 'trips-only conversion created % phantom bookings rows', n; END IF;
  SELECT count(*) INTO n FROM trip_bookings WHERE trip_request_id = req;
  IF n <> 1 THEN RAISE EXCEPTION 'expected 1 trip child, got %', n; END IF;
  IF (SELECT converted_booking_id FROM trip_requests WHERE id = req) IS NOT NULL THEN RAISE EXCEPTION 'converted_booking_id set'; END IF;
  IF (SELECT converted_at FROM trip_requests WHERE id = req) IS NULL THEN RAISE EXCEPTION 'converted_at not set'; END IF;
  IF (SELECT agreed_total FROM trip_requests WHERE id = req) <> 1800 THEN RAISE EXCEPTION 'agreed_total wrong'; END IF;

  res := weemap_convert_trip_request(req);
  IF NOT COALESCE((res ->> 'already_converted')::boolean, false) THEN RAISE EXCEPTION 'second convert not idempotent: %', res; END IF;
  SELECT count(*) INTO n FROM trip_bookings WHERE trip_request_id = req;
  IF n <> 1 THEN RAISE EXCEPTION 'second convert created children'; END IF;

  -- ── 2. Ops view ──
  SELECT * INTO w FROM ops_work_items WHERE entity_type = 'trip_request' AND entity_id = req;
  IF NOT w.converted THEN RAISE EXCEPTION 'view: trips-only journey not converted'; END IF;
  IF w.payment_kind <> 'trip' THEN RAISE EXCEPTION 'view: payment_kind % (expected trip)', w.payment_kind; END IF;
  IF w.amount_total <> 1800 THEN RAISE EXCEPTION 'view: amount_total %', w.amount_total; END IF;
  SELECT count(*) INTO n FROM ops_work_items WHERE trip_request_id = req AND journey_component;
  IF n <> 1 THEN RAISE EXCEPTION 'view: expected 1 component row, got %', n; END IF;

  -- ── 3. Payment ownership ──
  SELECT id INTO tb_id FROM trip_bookings WHERE trip_request_id = req;
  BEGIN
    PERFORM weemap_record_payment('trip_booking', tb_id, 'received', 100, 'cash', 0, '', 'child');
    RAISE EXCEPTION 'child accepted a payment';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'component_of_journey' THEN RAISE; END IF;
  END;
  res := weemap_record_payment('trip_request', req, 'received', 1800, 'instapay', 0, 'IP-TO', 'full');
  IF res ->> 'payment_status' <> 'paid' THEN RAISE EXCEPTION 'parent payment status %', res; END IF;

  -- ── 4. Refusals ──
  INSERT INTO trip_requests (
    transport_mode, arrival_date, departure_date, adults, children, accommodation_id, room_allocations,
    experiences, quote_snapshot, quoted_total, payment_plan, customer_name, customer_phone)
  VALUES (
    'stay_only', '2026-10-10', '2026-10-12', 2, 0, NULL, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('kind', 'trip', 'id', trip1)),
    jsonb_build_object('total', 2800, 'num_people', 2,
      'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip1, 'name_en', 'x', 'price', 900))),
    2800, '{}'::jsonb, 'Trips Only Synthetic Bad', '01000000053')
  RETURNING id INTO bad;
  UPDATE trip_requests SET status = 'checking_availability' WHERE id = bad;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = bad;
  BEGIN
    PERFORM weemap_convert_trip_request(bad);
    RAISE EXCEPTION 'hidden 1000 EGP side amount accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'snapshot_mismatch' THEN RAISE; END IF;
  END;

  UPDATE trip_requests SET experiences = '[]'::jsonb, quote_snapshot = '{"total": 0}'::jsonb, quoted_total = 0 WHERE id = bad;
  BEGIN
    PERFORM weemap_convert_trip_request(bad);
    RAISE EXCEPTION 'empty self-arrival request converted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'missing_accommodation' THEN RAISE; END IF;
  END;

  -- ── 5. Amendments (a fresh unpaid trips-only journey) ──
  INSERT INTO trip_requests (
    transport_mode, arrival_date, departure_date, adults, children, accommodation_id, room_allocations,
    experiences, quote_snapshot, quoted_total, payment_plan, customer_name, customer_phone)
  VALUES (
    'stay_only', '2026-10-10', '2026-10-12', 1, 0, NULL, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('kind', 'trip', 'id', trip1)),
    jsonb_build_object('total', 900, 'num_people', 1,
      'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip1, 'name_en', 'x', 'price', 900))),
    900, '{}'::jsonb, 'Trips Only Synthetic Amend', '01000000054')
  RETURNING id INTO bad;
  UPDATE trip_requests SET status = 'checking_availability' WHERE id = bad;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = bad;
  PERFORM weemap_convert_trip_request(bad);

  journey := jsonb_build_object(
    'transport_mode', 'stay_only', 'arrival_date', '2026-10-10', 'departure_date', '2026-10-12',
    'adults', 3, 'children', 0, 'accommodation_id', NULL, 'room_allocations', '[]'::jsonb,
    'experiences', jsonb_build_array(jsonb_build_object('kind', 'trip', 'id', trip1)));
  res := weemap_amend_trip_request(bad, pg_temp.ts(bad), journey,
    jsonb_build_object('total', 2700, 'num_people', 3,
      'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip1, 'name_en', 'x', 'price', 900))),
    2700, '{}'::jsonb, 'three travellers');
  IF (SELECT final_price FROM trip_bookings WHERE trip_request_id = bad) <> 2700 THEN RAISE EXCEPTION 'trip child not re-priced'; END IF;
  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = bad;
  IF n <> 0 THEN RAISE EXCEPTION 'amendment created a bookings row'; END IF;
  IF (SELECT agreed_total FROM trip_requests WHERE id = bad) <> 2700 THEN RAISE EXCEPTION 'agreed_total did not follow'; END IF;

  BEGIN
    PERFORM weemap_amend_trip_request(bad, pg_temp.ts(bad), journey || jsonb_build_object('accommodation_id', acc_id),
      jsonb_build_object('total', 2700, 'accommodation_subtotal', 0, 'num_people', 3,
        'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip1, 'name_en', 'x', 'price', 900))),
      2700, '{}'::jsonb, 'add a stay');
    RAISE EXCEPTION 'shape change accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'amendment_changes_journey_shape' THEN RAISE; END IF;
  END;

  -- ── 6. Stay journeys are unchanged ──
  INSERT INTO trip_requests (
    transport_mode, arrival_date, departure_date, adults, children, accommodation_id, room_allocations,
    experiences, quote_snapshot, quoted_total, payment_plan, customer_name, customer_phone)
  VALUES (
    'stay_only', '2026-10-10', '2026-10-12', 2, 0, acc_id, '[{"type":"double","count":1}]'::jsonb,
    '[]'::jsonb, '{"total": 4000, "accommodation_subtotal": 4000}'::jsonb, 4000, '{}'::jsonb,
    'Stay Synthetic', '01000000055')
  RETURNING id INTO stay_req;
  UPDATE trip_requests SET status = 'checking_availability' WHERE id = stay_req;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = stay_req;
  PERFORM weemap_convert_trip_request(stay_req);
  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = stay_req;
  IF n <> 1 THEN RAISE EXCEPTION 'stay journey: expected 1 bookings child, got %', n; END IF;
  IF (SELECT payment_kind FROM ops_work_items WHERE entity_type = 'trip_request' AND entity_id = stay_req) <> 'journey' THEN
    RAISE EXCEPTION 'stay journey lost the journey payment kind';
  END IF;

  -- ── 7. Transport without accommodation (founder decision 2026-11-02) ──
  -- Quoted under the composition rule: kind 'transfer' (100% after confirmation).
  INSERT INTO trip_requests (
    transport_mode, origin_governorate_code, stay_pattern_code, arrival_date, departure_date, adults, children,
    accommodation_id, room_allocations, experiences, quote_snapshot, quoted_total, payment_plan,
    customer_name, customer_phone)
  VALUES (
    'hiace', 'cairo', NULL, '2026-10-10', '2026-10-12', 2, 0, NULL, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('kind', 'trip', 'id', trip1)),
    jsonb_build_object('total', 3200, 'transfer_subtotal', 1400, 'num_people', 2,
      'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip1, 'name_en', 'x', 'price', 900))),
    3200, '{"kind": "transfer", "upfrontPercent": 100}'::jsonb, 'Transport Synthetic', '01000000056')
  RETURNING id INTO bad;
  UPDATE trip_requests SET status = 'checking_availability' WHERE id = bad;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = bad;
  PERFORM weemap_convert_trip_request(bad);
  IF (SELECT payment_kind FROM ops_work_items WHERE entity_type = 'trip_request' AND entity_id = bad) <> 'transfer' THEN
    RAISE EXCEPTION 'transport + trips without accommodation is not 100%% (transfer)';
  END IF;
  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = bad AND booking_type = 'transfer-only';
  IF n <> 1 THEN RAISE EXCEPTION 'transport journey: expected 1 transfer-only child, got %', n; END IF;

  -- Quoted before the rule (stored 'journey' plan): its agreed 50/50 terms are preserved.
  UPDATE trip_requests SET payment_plan = '{"kind": "journey", "upfrontPercent": 50}'::jsonb WHERE id = bad;
  IF (SELECT payment_kind FROM ops_work_items WHERE entity_type = 'trip_request' AND entity_id = bad) <> 'journey' THEN
    RAISE EXCEPTION 'previously agreed journey terms were not preserved';
  END IF;
  -- No stored plan at all: the composition decides.
  UPDATE trip_requests SET payment_plan = NULL WHERE id = bad;
  IF (SELECT payment_kind FROM ops_work_items WHERE entity_type = 'trip_request' AND entity_id = bad) <> 'transfer' THEN
    RAISE EXCEPTION 'composition fallback did not give transfer';
  END IF;

  RAISE NOTICE 'trips_only_journeys: all checks passed';
END
$$;

ROLLBACK;
