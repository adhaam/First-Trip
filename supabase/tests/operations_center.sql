-- Operations Center invariants (migrations 035–036). Run by
-- scripts/db-bootstrap-check.sh against a disposable local database — never
-- production. Everything runs inside a transaction that is rolled back, so it
-- is also safe against the local acceptance stack.
--
-- Proves, independent of the app:
--   1. The actor header is trusted only for service_role; anon cannot claim one.
--   2. Staff access is revoked by trigger and the last owner cannot be removed.
--   3. Payments: no money before availability is confirmed, stale callers are
--      rejected, over-payment / over-refund rejected, status derived, ledger
--      append-only, payment_kind untouched.
--   4. Trip request conversion: refused before confirmation, prices come from
--      the frozen snapshot (not the catalogue), provenance kept, idempotent.
--   5. Audit log records catalogue edits with the actor.
\set ON_ERROR_STOP 1

BEGIN;

DO $$
DECLARE
  owner_id UUID;
  ops_id   UUID;
  acc_id   UUID;
  v_trip  UUID;
  pkg_id   UUID;
  req_id   UUID;
  bk_id    UUID;
  res      JSONB;
  res2     JSONB;
  v        INTEGER;
  got      TEXT;
  n        INTEGER;
BEGIN
  -- ── 1. Actor resolution ──
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.headers', '{"x-weemap-actor":"staff:11111111-2222-4333-8444-555555555555"}', true);
  IF weemap_current_actor() IS NOT NULL THEN
    RAISE EXCEPTION 'anon request was allowed to claim an actor';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  IF weemap_current_actor() IS DISTINCT FROM 'staff:11111111-2222-4333-8444-555555555555' THEN
    RAISE EXCEPTION 'service_role actor header was not honoured';
  END IF;
  PERFORM set_config('request.headers', '{"x-weemap-actor":"staff:not-a-uuid; drop table x"}', true);
  IF weemap_current_actor() IS NOT NULL THEN
    RAISE EXCEPTION 'malformed actor accepted';
  END IF;

  -- ── 2. Staff invariants ──
  INSERT INTO staff_users (email, display_name, role, password_hash)
    VALUES ('owner-test@weemap.local', 'Owner Test', 'owner', 'scrypt$x') RETURNING id INTO owner_id;
  INSERT INTO staff_users (email, display_name, role, password_hash)
    VALUES ('ops-test@weemap.local', 'Ops Test', 'operations', 'scrypt$x') RETURNING id INTO ops_id;
  UPDATE staff_users SET is_active = false WHERE id = ops_id RETURNING session_version INTO v;
  IF v <> 2 THEN RAISE EXCEPTION 'disabling staff did not bump session_version (got %)', v; END IF;
  UPDATE staff_users SET display_name = 'Ops Renamed' WHERE id = ops_id RETURNING session_version INTO v;
  IF v <> 2 THEN RAISE EXCEPTION 'a cosmetic edit bumped session_version'; END IF;
  -- Only owners created in this test exist when run on a fresh DB; on the
  -- acceptance stack other owners may exist, so only assert when alone.
  IF (SELECT count(*) FROM staff_users WHERE role = 'owner' AND is_active) = 1 THEN
    BEGIN
      UPDATE staff_users SET is_active = false WHERE id = owner_id;
      RAISE EXCEPTION 'the last active owner was disabled';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END IF;
  BEGIN
    INSERT INTO staff_users (email, display_name, role, password_hash)
      VALUES ('Mixed@Case.local', 'X', 'admin', 'scrypt$x');
    RAISE EXCEPTION 'un-normalised email accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Act as the owner for the rest.
  PERFORM set_config('request.headers', json_build_object('x-weemap-actor', 'staff:' || owner_id)::text, true);

  -- ── Fixtures ──
  INSERT INTO accommodations (name_ar, name_en, type) VALUES ('ops', 'ops', 'hotel') RETURNING id INTO acc_id;
  INSERT INTO sinai_trips (name_ar, name_en, price) VALUES ('t', 'Ops Trip', 900) RETURNING id INTO v_trip;
  INSERT INTO trip_packages (slug, name_ar, name_en) VALUES ('ops-pkg-' || gen_random_uuid(), 'p', 'Ops Pkg')
    RETURNING id INTO pkg_id;

  -- ── 5. Audit ──
  UPDATE sinai_trips SET price = 950 WHERE id = v_trip;
  SELECT actor INTO got FROM audit_log WHERE table_name = 'sinai_trips' AND row_id = v_trip::text
    AND action = 'update' ORDER BY id DESC LIMIT 1;
  IF got IS DISTINCT FROM 'staff:' || owner_id THEN
    RAISE EXCEPTION 'catalogue price change not audited with actor (got %)', got;
  END IF;
  BEGIN
    UPDATE staff_users SET password_hash = 'scrypt$new' WHERE id = ops_id;
    SELECT changes->'password_hash'->>1 INTO got FROM audit_log
      WHERE table_name = 'staff_users' AND row_id = ops_id::text ORDER BY id DESC LIMIT 1;
    IF got IS DISTINCT FROM '[redacted]' THEN RAISE EXCEPTION 'password hash leaked into audit log'; END IF;
  END;

  -- ── 4. Conversion ──
  INSERT INTO trip_requests (
    transport_mode, origin_governorate_code, arrival_date, departure_date, adults, children,
    accommodation_id, room_allocations, meal_plan_key, experiences, quote_snapshot, quoted_total,
    customer_name, customer_phone, notes)
  VALUES (
    'package_bus', 'cairo', '2026-10-04', '2026-10-08', 2, 0, acc_id,
    '[{"type":"double","count":1}]', 'breakfast',
    json_build_array(json_build_object('kind', 'trip', 'id', v_trip, 'preferred_date', '2026-10-05'),
                     json_build_object('kind', 'trip_package', 'id', pkg_id))::jsonb,
    json_build_object('total', 12760, 'nights', 4,
      'extra_trips', json_build_array(json_build_object('trip_id', v_trip, 'price', 900, 'name_en', 'Ops Trip')),
      'trip_packages', json_build_array(json_build_object('package_id', pkg_id, 'total', 2000, 'name_en', 'Ops Pkg',
        'trip_names_en', json_build_array())))::jsonb,
    12760, 'Ops Customer', '01000000000', 'Customer words')
  RETURNING id INTO req_id;

  BEGIN
    PERFORM weemap_convert_trip_request(req_id);
    RAISE EXCEPTION 'conversion allowed before availability was confirmed';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'request_not_confirmed' THEN RAISE; END IF;
  END;

  UPDATE trip_requests SET status = 'checking_availability' WHERE id = req_id;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = req_id;
  res := weemap_convert_trip_request(req_id);
  bk_id := (res->>'booking_id')::uuid;
  IF (res->>'already_converted')::boolean THEN RAISE EXCEPTION 'first conversion reported already_converted'; END IF;

  SELECT to_jsonb(b) INTO res2 FROM bookings b WHERE b.id = bk_id;
  -- 12760 - 900*2 - 2000 = 8960 for the stay/transport side, frozen snapshot prices
  -- even though the catalogue trip price is now 950.
  IF (res2->>'total_price')::numeric <> 8960 THEN
    RAISE EXCEPTION 'stay side total % instead of 8960', res2->>'total_price';
  END IF;
  IF res2->>'payment_kind' <> 'stay_package' OR res2->>'booking_type' <> 'package'
     OR res2->>'status' <> 'awaiting_payment' OR res2->>'trip_request_id' <> req_id::text THEN
    RAISE EXCEPTION 'converted booking wrong: %', res2;
  END IF;
  SELECT count(*) INTO n FROM trip_bookings WHERE trip_request_id = req_id;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 trip bookings, got %', n; END IF;
  SELECT final_price INTO got FROM trip_bookings WHERE trip_request_id = req_id AND trip_id = v_trip;
  IF got::numeric <> 1800 THEN RAISE EXCEPTION 'trip booking priced % instead of snapshot 1800', got; END IF;
  SELECT payment_kind INTO got FROM trip_bookings WHERE trip_request_id = req_id AND trip_package_id = pkg_id;
  IF got <> 'experience_package' THEN RAISE EXCEPTION 'package booking kind %', got; END IF;
  SELECT notes INTO got FROM trip_requests WHERE id = req_id;
  IF got <> 'Customer words' THEN RAISE EXCEPTION 'customer notes were changed by conversion'; END IF;

  res := weemap_convert_trip_request(req_id);
  IF NOT (res->>'already_converted')::boolean OR (res->>'booking_id')::uuid <> bk_id THEN
    RAISE EXCEPTION 'second conversion was not idempotent: %', res;
  END IF;
  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = req_id;
  IF n <> 1 THEN RAISE EXCEPTION 'duplicate bookings after retry (%)', n; END IF;
  SELECT count(*) INTO n FROM domain_events WHERE event_type = 'trip_request_converted' AND aggregate_id = req_id;
  IF n <> 1 THEN RAISE EXCEPTION 'expected one trip_request_converted event, got %', n; END IF;
  BEGIN
    INSERT INTO bookings (customer_name, customer_phone, booking_type, accommodation_id, trip_request_id)
      VALUES ('dup', '0100', 'package', acc_id, req_id);
    RAISE EXCEPTION 'a second booking for the same request was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- ── 3. Payments ──
  -- 50% of 8960 after confirmation.
  res := weemap_record_payment('accommodation_booking', bk_id, 'received', 4480, 'instapay', 0, 'IP-1', 'deposit');
  IF res->>'payment_status' <> 'partial' OR (res->>'amount_paid')::numeric <> 4480 THEN
    RAISE EXCEPTION 'deposit result %', res;
  END IF;
  SELECT actor INTO got FROM status_history WHERE entity_id = bk_id AND field = 'payment_status'
    ORDER BY id DESC LIMIT 1;
  IF got IS DISTINCT FROM 'staff:' || owner_id THEN RAISE EXCEPTION 'payment status change actor %', got; END IF;

  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'received', 100, 'cash', 0);
    RAISE EXCEPTION 'stale payment accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'received', 4481, 'cash', 4480);
    RAISE EXCEPTION 'over-payment accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'refunded', 5000, 'cash', 4480);
    RAISE EXCEPTION 'over-refund accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'received', 0, 'cash', 4480);
    RAISE EXCEPTION 'zero payment accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  res := weemap_record_payment('accommodation_booking', bk_id, 'received', 4480, 'cash', 4480);
  IF res->>'payment_status' <> 'paid' THEN RAISE EXCEPTION 'full payment status %', res; END IF;
  SELECT payment_kind INTO got FROM bookings WHERE id = bk_id;
  IF got <> 'stay_package' THEN RAISE EXCEPTION 'payment changed payment_kind'; END IF;

  BEGIN
    UPDATE payment_records SET amount = 1 WHERE entity_id = bk_id;
    RAISE EXCEPTION 'ledger row edited';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM payment_records WHERE entity_id = bk_id;
    RAISE EXCEPTION 'ledger row deleted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- No money before confirmation on a fresh request-state booking.
  INSERT INTO trip_bookings (trip_id, context, customer_name, customer_phone, quoted_price)
    VALUES (v_trip, 'standalone', 'B', '0101', 900) RETURNING id INTO bk_id;
  BEGIN
    PERFORM weemap_record_payment('trip_booking', bk_id, 'received', 900, 'cash', 0);
    RAISE EXCEPTION 'payment accepted before availability confirmation';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'payment_before_confirmation' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM domain_events WHERE event_type = 'payment_recorded';
  IF n < 2 THEN RAISE EXCEPTION 'payment_recorded events missing'; END IF;
  SELECT count(*) INTO n FROM ops_work_items WHERE trip_request_id = req_id;
  IF n <> 4 THEN RAISE EXCEPTION 'ops_work_items shows % rows for the request journey (expected 4)', n; END IF;
END $$;

ROLLBACK;
