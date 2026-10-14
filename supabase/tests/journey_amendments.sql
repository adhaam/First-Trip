-- Journey amendment invariants (migration 051). Run by
-- scripts/db-bootstrap-check.sh against a disposable local database — never
-- production. Everything runs inside a transaction that is rolled back, so it
-- is also safe against the local acceptance stack.
--
-- Proves, independent of the app, for weemap_amend_trip_request():
--   1. Unconverted journey: revisions 1 ('original') + 2 ('amendment'), same
--      reference, new quote/journey stored, agreed_total stays NULL, event.
--   2. A stale updated_at is refused (PT409) and writes nothing.
--   3. Cancelled journeys are refused; awaiting_payment goes back to
--      checking_availability with availability_confirmed recorded per status.
--   4. Invalid inputs are refused (invalid_amendment) and write nothing.
--   5. Converted unpaid journey: bookings child re-synced in place (total,
--      dates, people, status), agreed_total follows, removed trip child
--      cancelled, new one added, removed one re-opened later, still exactly
--      one bookings child, same reference, one ops_work_items row, no
--      payment_records written.
--   6. A journey that received money is refused and nothing moves.
--   7. Revisions are append-only; deleting an unpaid request cascades them.
\set ON_ERROR_STOP 1

BEGIN;

CREATE FUNCTION pg_temp.ts(p_id UUID) RETURNS TIMESTAMPTZ LANGUAGE sql AS $$
  SELECT updated_at FROM public.trip_requests WHERE id = p_id
$$;

DO $$
DECLARE
  owner_id  UUID := '11111111-2222-4333-8444-555555555555';
  acc_id    UUID;
  trip1     UUID;
  trip2     UUID;
  pkg_id    UUID;
  req       UUID;
  req2      UUID;
  req3      UUID;
  req4      UUID;
  ref0      TEXT;
  bk_id     UUID;
  tb_trip1  UUID;
  res       JSONB;
  convres   JSONB;
  got       TEXT;
  n         INTEGER;
  pay_before INTEGER;
  rev       RECORD;
  tr        RECORD;
  bk        RECORD;
  journey   JSONB;
  snap      JSONB;
BEGIN
  PERFORM set_config('weemap.actor', 'staff:' || owner_id, true);

  INSERT INTO accommodations (name_ar, name_en, type) VALUES ('amend', 'amend', 'hotel') RETURNING id INTO acc_id;
  INSERT INTO sinai_trips (name_ar, name_en, price) VALUES ('t1', 'Amend Trip 1', 900) RETURNING id INTO trip1;
  INSERT INTO sinai_trips (name_ar, name_en, price) VALUES ('t2', 'Amend Trip 2', 700) RETURNING id INTO trip2;
  INSERT INTO trip_packages (slug, name_ar, name_en) VALUES ('amend-pkg-' || gen_random_uuid(), 'p', 'Amend Pkg')
    RETURNING id INTO pkg_id;

  -- ── 1. Unconverted journey ──
  INSERT INTO trip_requests (
    transport_mode, origin_governorate_code, arrival_date, departure_date, adults, children,
    accommodation_id, room_allocations, meal_plan_key, experiences, quote_snapshot, quoted_total,
    payment_plan, customer_name, customer_phone)
  VALUES (
    'package_bus', 'cairo', '2026-10-04', '2026-10-08', 2, 0, acc_id,
    '[{"type":"double","count":1}]', 'breakfast', '[]'::jsonb,
    '{"total": 8960}'::jsonb, 8960, '{"upfront_percent":50}'::jsonb, 'Amend Customer', '01000000001')
  RETURNING id, reference INTO req, ref0;

  journey := jsonb_build_object(
    'transport_mode', 'package_bus', 'origin_governorate_code', 'cairo',
    'arrival_date', '2026-10-11', 'departure_date', '2026-10-15', 'adults', 3, 'children', 1,
    'accommodation_id', acc_id, 'room_allocations', '[{"type":"double","count":2}]'::jsonb,
    'meal_plan_key', 'half_board', 'experiences', '[]'::jsonb);

  -- invalid inputs first: each must be refused and write nothing
  DECLARE
    bad RECORD;
  BEGIN
    FOR bad IN
      SELECT * FROM (VALUES
        ('total mismatch',   journey, '{"total": 9000}'::jsonb, 10000::numeric, 'why'),
        ('negative total',   journey, '{"total": -5}'::jsonb,   -5::numeric,    'why'),
        ('snapshot no total',journey, '{"x": 1}'::jsonb,        10000::numeric, 'why'),
        ('empty reason',     journey, '{"total": 10000}'::jsonb, 10000::numeric, '   '),
        ('long reason',      journey, '{"total": 10000}'::jsonb, 10000::numeric, repeat('x', 501)),
        ('adults zero',      journey || '{"adults": 0}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('adults fraction',  journey || '{"adults": 1.5}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('children negative',journey || '{"children": -1}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('departure before', journey || '{"departure_date": "2026-10-01"}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('bad date',         journey || '{"arrival_date": "soon"}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('bad transport',    journey || '{"transport_mode": "boat"}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('no origin',        journey || '{"origin_governorate_code": null}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('bad experiences',  journey || '{"experiences": {"a": 1}}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('bad experience id',journey || '{"experiences": [{"kind":"trip","id":"nope"}]}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('bad experience kind', journey || '{"experiences": [{"kind":"yacht","id":"6f9619ff-8b86-d011-b42d-00c04fc964ff"}]}', '{"total": 10000}'::jsonb, 10000::numeric, 'why'),
        ('unknown accommodation', journey || '{"accommodation_id": "6f9619ff-8b86-d011-b42d-00c04fc964ff"}', '{"total": 10000}'::jsonb, 10000::numeric, 'why')
      ) AS t(label, j, s, tot, reason)
    LOOP
      BEGIN
        PERFORM weemap_amend_trip_request(req, pg_temp.ts(req), bad.j, bad.s, bad.tot, NULL, bad.reason);
        RAISE EXCEPTION 'invalid amendment accepted: %', bad.label;
      EXCEPTION WHEN invalid_parameter_value THEN
        IF SQLERRM <> 'invalid_amendment' THEN RAISE EXCEPTION '% raised %', bad.label, SQLERRM; END IF;
      END;
    END LOOP;
  END;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req;
  IF n <> 0 THEN RAISE EXCEPTION 'refused amendments left % revision rows', n; END IF;
  IF (SELECT adults FROM trip_requests WHERE id = req) <> 2 THEN RAISE EXCEPTION 'refused amendment changed the journey'; END IF;

  BEGIN
    PERFORM weemap_amend_trip_request(gen_random_uuid(), now(), journey, '{"total": 10000}'::jsonb, 10000, NULL, 'x');
    RAISE EXCEPTION 'amending a missing request was accepted';
  EXCEPTION WHEN no_data_found THEN
    IF SQLERRM <> 'not_found' THEN RAISE; END IF;
  END;

  -- ── 2. Stale updated_at ──
  BEGIN
    PERFORM weemap_amend_trip_request(req, pg_temp.ts(req) - interval '1 second', journey,
      '{"total": 10000}'::jsonb, 10000, NULL, 'late');
    RAISE EXCEPTION 'stale amendment accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    IF SQLERRM <> 'stale_request' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM weemap_amend_trip_request(req, NULL, journey, '{"total": 10000}'::jsonb, 10000, NULL, 'late');
    RAISE EXCEPTION 'amendment without expected updated_at accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req;
  IF n <> 0 THEN RAISE EXCEPTION 'stale amendments left revision rows'; END IF;

  -- a JS Date round-trip keeps milliseconds only: must still match
  res := weemap_amend_trip_request(req, date_trunc('milliseconds', pg_temp.ts(req)), journey,
    '{"total": 10000, "nights": 4}'::jsonb, 10000, '{"upfront_percent":50,"v":2}'::jsonb, '  add a traveller  ');

  IF (res->>'revision_number')::int <> 2 OR (res->>'previous_total')::numeric <> 8960
     OR (res->>'new_total')::numeric <> 10000 OR (res->>'difference')::numeric <> 1040
     OR res->>'status' <> 'new' OR (res->>'converted')::boolean THEN
    RAISE EXCEPTION 'unconverted amend result %', res;
  END IF;
  SELECT * INTO tr FROM trip_requests WHERE id = req;
  IF tr.reference <> ref0 THEN RAISE EXCEPTION 'reference changed on amend'; END IF;
  IF tr.adults <> 3 OR tr.children <> 1 OR tr.arrival_date <> '2026-10-11' OR tr.departure_date <> '2026-10-15'
     OR tr.meal_plan_key <> 'half_board' OR tr.quoted_total <> 10000 OR (tr.quote_snapshot->>'nights') <> '4'
     OR (tr.payment_plan->>'v') <> '2' THEN
    RAISE EXCEPTION 'parent journey not updated: %', to_jsonb(tr);
  END IF;
  IF tr.agreed_total IS NOT NULL OR tr.amount_paid <> 0 OR tr.converted_booking_id IS NOT NULL THEN
    RAISE EXCEPTION 'unconverted amend touched commercial columns: %', to_jsonb(tr);
  END IF;
  SELECT count(*) INTO n FROM trip_requests WHERE reference = ref0;
  IF n <> 1 THEN RAISE EXCEPTION 'reference not unique after amend'; END IF;

  SELECT * INTO rev FROM trip_request_revisions WHERE trip_request_id = req AND revision_number = 1;
  IF rev.kind <> 'original' OR rev.quoted_total <> 8960 OR (rev.journey->>'adults')::int <> 2
     OR rev.journey->>'arrival_date' <> '2026-10-04' OR rev.status_at_revision <> 'new'
     OR rev.availability_confirmed OR rev.previous_total IS NOT NULL OR rev.created_by <> 'customer:website'
     OR (rev.payment_plan->>'upfront_percent') <> '50' THEN
    RAISE EXCEPTION 'original revision wrong: %', to_jsonb(rev);
  END IF;
  SELECT * INTO rev FROM trip_request_revisions WHERE trip_request_id = req AND revision_number = 2;
  IF rev.kind <> 'amendment' OR rev.quoted_total <> 10000 OR (rev.journey->>'adults')::int <> 3
     OR rev.previous_total <> 8960 OR rev.difference <> 1040 OR rev.reason <> 'add a traveller'
     OR rev.status_at_revision <> 'new' OR rev.availability_confirmed
     OR rev.created_by IS DISTINCT FROM 'staff:' || owner_id THEN
    RAISE EXCEPTION 'amendment revision wrong: %', to_jsonb(rev);
  END IF;
  SELECT count(*) INTO n FROM domain_events
   WHERE event_type = 'trip_request_amended' AND aggregate_type = 'trip_request' AND aggregate_id = req
     AND (payload->>'revision_number')::int = 2 AND (payload->>'new_total')::numeric = 10000
     AND (payload->>'previous_total')::numeric = 8960 AND payload->>'reference' = ref0;
  IF n <> 1 THEN RAISE EXCEPTION 'expected one trip_request_amended event, got %', n; END IF;

  -- second amendment on the same request: revision 3, no second 'original'
  res := weemap_amend_trip_request(req, pg_temp.ts(req), journey, '{"total": 9500}'::jsonb, 9500, NULL, 'cheaper');
  IF (res->>'revision_number')::int <> 3 OR (res->>'previous_total')::numeric <> 10000
     OR (res->>'difference')::numeric <> -500 THEN
    RAISE EXCEPTION 'third revision result %', res;
  END IF;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req AND kind = 'original';
  IF n <> 1 THEN RAISE EXCEPTION 'more than one original revision (%)', n; END IF;

  -- ── 7. Revisions are append-only; deleting the unpaid request cascades them ──
  BEGIN
    UPDATE trip_request_revisions SET reason = 'edited' WHERE trip_request_id = req AND revision_number = 2;
    RAISE EXCEPTION 'a revision was updated';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'revision_append_only' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM trip_request_revisions WHERE trip_request_id = req AND revision_number = 3;
    RAISE EXCEPTION 'a revision was deleted while its request exists';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'revision_append_only' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req;
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 revisions, got %', n; END IF;
  DELETE FROM trip_requests WHERE id = req;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req;
  IF n <> 0 THEN RAISE EXCEPTION 'revisions survived deleting their request (%)', n; END IF;

  -- ── 3. Cancelled refused; awaiting_payment → checking_availability ──
  INSERT INTO trip_requests (
    transport_mode, origin_governorate_code, arrival_date, departure_date, adults, children,
    accommodation_id, room_allocations, experiences, quote_snapshot, quoted_total, status,
    customer_name, customer_phone)
  VALUES ('package_bus', 'cairo', '2026-10-04', '2026-10-08', 2, 0, acc_id, '[]', '[]',
          '{"total": 5000}'::jsonb, 5000, 'cancelled', 'Cancelled Customer', '01000000002')
  RETURNING id INTO req2;
  BEGIN
    PERFORM weemap_amend_trip_request(req2, pg_temp.ts(req2), journey, '{"total": 10000}'::jsonb, 10000, NULL, 'x');
    RAISE EXCEPTION 'cancelled journey was amended';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'amendment_closed' THEN RAISE; END IF;
  END;
  UPDATE trip_requests SET status = 'completed' WHERE id = req2;
  BEGIN
    PERFORM weemap_amend_trip_request(req2, pg_temp.ts(req2), journey, '{"total": 10000}'::jsonb, 10000, NULL, 'x');
    RAISE EXCEPTION 'completed journey was amended';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'amendment_closed' THEN RAISE; END IF;
  END;

  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = req2;
  UPDATE trip_requests SET confirmed_at = now() WHERE id = req2;
  res := weemap_amend_trip_request(req2, pg_temp.ts(req2), journey, '{"total": 10000}'::jsonb, 10000, NULL, 'dates moved');
  IF res->>'status' <> 'checking_availability' THEN RAISE EXCEPTION 'awaiting_payment not sent back: %', res; END IF;
  SELECT * INTO tr FROM trip_requests WHERE id = req2;
  IF tr.status <> 'checking_availability' OR tr.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'parent not re-opened: status %, confirmed_at %', tr.status, tr.confirmed_at;
  END IF;
  SELECT * INTO rev FROM trip_request_revisions WHERE trip_request_id = req2 AND revision_number = 1;
  IF rev.status_at_revision <> 'awaiting_payment' OR NOT rev.availability_confirmed THEN
    RAISE EXCEPTION 'original of an awaiting_payment journey must record confirmed availability: %', to_jsonb(rev);
  END IF;
  SELECT * INTO rev FROM trip_request_revisions WHERE trip_request_id = req2 AND revision_number = 2;
  IF rev.status_at_revision <> 'checking_availability' OR rev.availability_confirmed THEN
    RAISE EXCEPTION 'amendment must record unconfirmed availability: %', to_jsonb(rev);
  END IF;
  SELECT count(*) INTO n FROM status_history
   WHERE entity_type = 'trip_request' AND entity_id = req2 AND field = 'status'
     AND from_value = 'awaiting_payment' AND to_value = 'checking_availability';
  IF n <> 1 THEN RAISE EXCEPTION 'status regression not recorded in status_history'; END IF;
  -- 'confirmed' also goes back
  UPDATE trip_requests SET status = 'confirmed' WHERE id = req2;
  res := weemap_amend_trip_request(req2, pg_temp.ts(req2), journey, '{"total": 10000}'::jsonb, 10000, NULL, 'again');
  IF res->>'status' <> 'checking_availability' THEN RAISE EXCEPTION 'confirmed not sent back: %', res; END IF;
  -- an open status that is not awaiting_payment/confirmed is unchanged
  UPDATE trip_requests SET status = 'alternatives_required' WHERE id = req2;
  res := weemap_amend_trip_request(req2, pg_temp.ts(req2), journey, '{"total": 10000}'::jsonb, 10000, NULL, 'alt');
  IF res->>'status' <> 'alternatives_required' THEN RAISE EXCEPTION 'open status changed: %', res; END IF;

  -- ── 5. Converted, unpaid journey ──
  INSERT INTO trip_requests (
    transport_mode, origin_governorate_code, arrival_date, departure_date, adults, children,
    accommodation_id, room_allocations, meal_plan_key, experiences, quote_snapshot, quoted_total,
    customer_name, customer_phone)
  VALUES (
    'package_bus', 'cairo', '2026-10-04', '2026-10-08', 2, 0, acc_id,
    '[{"type":"double","count":1}]', 'breakfast',
    json_build_array(json_build_object('kind', 'trip', 'id', trip1, 'preferred_date', '2026-10-05'),
                     json_build_object('kind', 'trip_package', 'id', pkg_id))::jsonb,
    json_build_object('total', 12760, 'nights', 4,
      'extra_trips', json_build_array(json_build_object('trip_id', trip1, 'price', 900, 'name_en', 'Amend Trip 1')),
      'trip_packages', json_build_array(json_build_object('package_id', pkg_id, 'total', 2000, 'name_en', 'Amend Pkg',
        'trip_names_en', json_build_array())))::jsonb,
    12760, 'Converted Customer', '01000000003')
  RETURNING id, reference INTO req3, ref0;
  UPDATE trip_requests SET status = 'checking_availability' WHERE id = req3;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = req3;
  convres := weemap_convert_trip_request(req3);
  bk_id := (convres->>'booking_id')::uuid;
  SELECT id INTO tb_trip1 FROM trip_bookings WHERE trip_request_id = req3 AND trip_id = trip1;

  SELECT count(*) INTO pay_before FROM payment_records;

  -- the journey: 3 adults + 1 child, new dates, trip1 removed, trip2 added, package kept
  journey := jsonb_build_object(
    'transport_mode', 'package_bus', 'origin_governorate_code', 'cairo',
    'arrival_date', '2026-11-04', 'departure_date', '2026-11-09', 'adults', 3, 'children', 0,
    'accommodation_id', acc_id,
    'room_allocations', '[{"type":"double","count":1},{"type":"single","count":1}]'::jsonb,
    'meal_plan_key', 'half_board',
    'experiences', jsonb_build_array(
      jsonb_build_object('kind', 'trip_package', 'id', pkg_id),
      jsonb_build_object('kind', 'trip', 'id', trip2, 'preferred_date', '2026-11-06')));
  snap := jsonb_build_object('total', 15000, 'nights', 5,
    'extra_trips', jsonb_build_array(jsonb_build_object('trip_id', trip2, 'price', 700, 'name_en', 'Amend Trip 2')),
    'trip_packages', jsonb_build_array(jsonb_build_object('package_id', pkg_id, 'total', 2000, 'name_en', 'Amend Pkg',
      'trip_names_en', jsonb_build_array())));

  -- a quote that cannot be split into stay side + trip lines is refused, writing nothing
  BEGIN
    PERFORM weemap_amend_trip_request(req3, pg_temp.ts(req3), journey,
      jsonb_set(snap, '{total}', '3000'), 3000, NULL, 'too small');
    RAISE EXCEPTION 'unsplittable quote accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'snapshot_mismatch' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM weemap_amend_trip_request(req3, pg_temp.ts(req3),
      journey || jsonb_build_object('experiences', jsonb_build_array(jsonb_build_object('kind', 'trip', 'id', trip1))),
      snap, 15000, NULL, 'trip not in snapshot');
    RAISE EXCEPTION 'experience missing from the snapshot accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'snapshot_mismatch' THEN RAISE; END IF;
  END;
  IF (SELECT adults FROM trip_requests WHERE id = req3) <> 2
     OR (SELECT total_price FROM bookings WHERE id = bk_id) <> 8960 THEN
    RAISE EXCEPTION 'refused converted amendments changed rows';
  END IF;

  res := weemap_amend_trip_request(req3, pg_temp.ts(req3), journey, snap, 15000, NULL, 'bigger group');
  IF (res->>'revision_number')::int <> 2 OR (res->>'previous_total')::numeric <> 12760
     OR (res->>'difference')::numeric <> 2240 OR NOT (res->>'converted')::boolean
     OR (res->>'booking_id')::uuid <> bk_id OR res->>'status' <> 'checking_availability'
     OR jsonb_array_length(res->'trip_booking_ids') <> 2 OR jsonb_array_length(res->'removed_trip_booking_ids') <> 1 THEN
    RAISE EXCEPTION 'converted amend result %', res;
  END IF;

  SELECT * INTO tr FROM trip_requests WHERE id = req3;
  IF tr.reference <> ref0 OR tr.agreed_total <> 15000 OR tr.quoted_total <> 15000 OR tr.payment_status <> 'unpaid'
     OR tr.amount_paid <> 0 OR tr.status <> 'checking_availability' OR tr.converted_booking_id <> bk_id THEN
    RAISE EXCEPTION 'converted parent wrong: %', to_jsonb(tr);
  END IF;
  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = req3;
  IF n <> 1 THEN RAISE EXCEPTION 'expected exactly one bookings child, got %', n; END IF;
  SELECT * INTO bk FROM bookings WHERE id = bk_id;
  -- 15000 - 700*3 - 2000 = 10900 for the stay/transport side
  IF bk.total_price <> 10900 OR bk.num_people <> 3 OR bk.trip_date <> '2026-11-04' OR bk.return_date <> '2026-11-09'
     OR bk.duration <> 6 OR bk.nights <> 5 OR bk.status <> 'checking_availability'
     OR bk.meal_plan_key <> 'half_board' OR bk.room_type <> 'double' OR bk.booking_type <> 'package'
     OR bk.payment_kind <> 'stay_package' OR bk.amount_paid <> 0 OR bk.trip_request_id <> req3
     OR (bk.price_snapshot->>'amended_revision')::int <> 2 OR (bk.price_snapshot->>'part_total')::numeric <> 10900 THEN
    RAISE EXCEPTION 'bookings child not re-synced: %', to_jsonb(bk);
  END IF;

  SELECT status, internal_notes INTO tr FROM trip_bookings WHERE id = tb_trip1;
  IF tr.status <> 'cancelled' OR tr.internal_notes NOT LIKE '%Removed by amendment rev 2%' THEN
    RAISE EXCEPTION 'removed trip child not cancelled/noted: %', to_jsonb(tr);
  END IF;
  SELECT count(*) INTO n FROM trip_bookings WHERE trip_request_id = req3;
  IF n <> 3 THEN RAISE EXCEPTION 'children must never be deleted: expected 3 rows, got %', n; END IF;
  SELECT final_price, num_people, status, preferred_date INTO tr FROM trip_bookings
   WHERE trip_request_id = req3 AND trip_id = trip2;
  IF NOT FOUND OR tr.final_price <> 2100 OR tr.num_people <> 3 OR tr.status <> 'checking_availability'
     OR tr.preferred_date <> '2026-11-06' THEN
    RAISE EXCEPTION 'new trip child wrong: %', to_jsonb(tr);
  END IF;
  SELECT final_price, num_people, status INTO tr FROM trip_bookings
   WHERE trip_request_id = req3 AND trip_package_id = pkg_id;
  IF tr.final_price <> 2000 OR tr.num_people <> 3 OR tr.status <> 'checking_availability' THEN
    RAISE EXCEPTION 'package child not updated: %', to_jsonb(tr);
  END IF;
  -- the live children add up to exactly the new quote
  SELECT (SELECT total_price FROM bookings WHERE id = bk_id)
         + (SELECT SUM(final_price) FROM trip_bookings WHERE trip_request_id = req3 AND status <> 'cancelled') INTO got;
  IF got::numeric <> 15000 THEN RAISE EXCEPTION 'live children sum to % instead of 15000', got; END IF;

  SELECT count(*) INTO n FROM ops_work_items WHERE entity_type = 'trip_request' AND entity_id = req3;
  IF n <> 1 THEN RAISE EXCEPTION 'ops_work_items shows % trip_request rows for the journey', n; END IF;
  SELECT count(*) INTO n FROM ops_work_items WHERE trip_request_id = req3 AND journey_component;
  IF n <> 4 THEN RAISE EXCEPTION 'expected 4 journey components in the queue, got %', n; END IF;
  IF (SELECT count(*) FROM payment_records) <> pay_before THEN
    RAISE EXCEPTION 'amendment wrote payment_records';
  END IF;

  -- put the removed trip back: the SAME child is re-opened, not duplicated
  journey := journey || jsonb_build_object('experiences', jsonb_build_array(
    jsonb_build_object('kind', 'trip_package', 'id', pkg_id),
    jsonb_build_object('kind', 'trip', 'id', trip2, 'preferred_date', '2026-11-06'),
    jsonb_build_object('kind', 'trip', 'id', trip1)));
  snap := jsonb_build_object('total', 17700, 'nights', 5,
    'extra_trips', jsonb_build_array(
      jsonb_build_object('trip_id', trip2, 'price', 700, 'name_en', 'Amend Trip 2'),
      jsonb_build_object('trip_id', trip1, 'price', 900, 'name_en', 'Amend Trip 1')),
    'trip_packages', jsonb_build_array(jsonb_build_object('package_id', pkg_id, 'total', 2000, 'name_en', 'Amend Pkg',
      'trip_names_en', jsonb_build_array())));
  res := weemap_amend_trip_request(req3, pg_temp.ts(req3), journey, snap, 17700, NULL, 'trip back in');
  IF (res->>'revision_number')::int <> 3 OR jsonb_array_length(res->'trip_booking_ids') <> 3
     OR jsonb_array_length(res->'removed_trip_booking_ids') <> 0 THEN
    RAISE EXCEPTION 'second converted amend result %', res;
  END IF;
  SELECT count(*) INTO n FROM trip_bookings WHERE trip_request_id = req3;
  IF n <> 3 THEN RAISE EXCEPTION 'restoring a trip created a duplicate child (% rows)', n; END IF;
  SELECT status, final_price, cancelled_at INTO tr FROM trip_bookings WHERE id = tb_trip1;
  IF tr.status <> 'checking_availability' OR tr.final_price <> 2700 OR tr.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'restored trip child wrong: %', to_jsonb(tr);
  END IF;
  SELECT count(*) INTO n FROM bookings WHERE trip_request_id = req3;
  IF n <> 1 THEN RAISE EXCEPTION 'bookings child count % after second amend', n; END IF;
  IF (SELECT total_price FROM bookings WHERE id = bk_id) <> 17700 - 2100 - 2700 - 2000 THEN
    RAISE EXCEPTION 'stay side wrong after second amend';
  END IF;
  IF (SELECT agreed_total FROM trip_requests WHERE id = req3) <> 17700 THEN
    RAISE EXCEPTION 'agreed_total did not follow the second amendment';
  END IF;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req3;
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 revisions for the converted journey, got %', n; END IF;
  SELECT quoted_total, previous_total INTO tr FROM trip_request_revisions
   WHERE trip_request_id = req3 AND revision_number = 3;
  IF tr.quoted_total <> 17700 OR tr.previous_total <> 15000 THEN
    RAISE EXCEPTION 'revision 3 totals wrong: %', to_jsonb(tr);
  END IF;
  -- the original revision froze the pre-amendment journey
  SELECT quoted_total, (trip_request_revisions.journey->>'adults')::int AS adults INTO tr FROM trip_request_revisions
   WHERE trip_request_id = req3 AND revision_number = 1;
  IF tr.quoted_total <> 12760 OR tr.adults <> 2 THEN RAISE EXCEPTION 'converted original revision wrong'; END IF;
  IF (SELECT count(*) FROM payment_records) <> pay_before THEN RAISE EXCEPTION 'payment_records changed'; END IF;

  -- ── 6. A journey that received money is never amended ──
  INSERT INTO trip_requests (
    transport_mode, origin_governorate_code, arrival_date, departure_date, adults, children,
    accommodation_id, room_allocations, meal_plan_key, experiences, quote_snapshot, quoted_total,
    customer_name, customer_phone)
  VALUES (
    'package_bus', 'cairo', '2026-10-04', '2026-10-08', 2, 0, acc_id,
    '[{"type":"double","count":1}]', 'breakfast',
    json_build_array(json_build_object('kind', 'trip', 'id', trip1, 'preferred_date', '2026-10-05'))::jsonb,
    json_build_object('total', 10760, 'nights', 4,
      'extra_trips', json_build_array(json_build_object('trip_id', trip1, 'price', 900, 'name_en', 'Amend Trip 1')))::jsonb,
    10760, 'Paid Customer', '01000000004')
  RETURNING id INTO req4;
  UPDATE trip_requests SET status = 'checking_availability' WHERE id = req4;
  UPDATE trip_requests SET status = 'awaiting_payment' WHERE id = req4;
  PERFORM weemap_convert_trip_request(req4);
  res := weemap_record_payment('trip_request', req4, 'received', 5380, 'instapay', 0, 'IP-AMEND', 'deposit');
  IF (res->>'amount_paid')::numeric <> 5380 THEN RAISE EXCEPTION 'deposit result %', res; END IF;
  SELECT count(*) INTO pay_before FROM payment_records;

  BEGIN
    PERFORM weemap_amend_trip_request(req4, pg_temp.ts(req4), journey, snap, 17700, NULL, 'too late');
    RAISE EXCEPTION 'a paid journey was amended';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'amendment_paid_journey' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM payment_records) <> pay_before THEN RAISE EXCEPTION 'paid guard changed payment_records'; END IF;
  SELECT * INTO tr FROM trip_requests WHERE id = req4;
  IF tr.agreed_total <> 10760 OR tr.amount_paid <> 5380 OR tr.adults <> 2 OR tr.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'paid guard let the journey move: %', to_jsonb(tr);
  END IF;
  SELECT count(*) INTO n FROM trip_request_revisions WHERE trip_request_id = req4;
  IF n <> 0 THEN RAISE EXCEPTION 'refused paid amendment left revisions'; END IF;
  -- refunding to zero does not re-open it: the ledger still shows money moved
  PERFORM weemap_record_payment('trip_request', req4, 'refunded', 5380, 'instapay', 5380, 'IP-AMEND-R', 'refund');
  BEGIN
    PERFORM weemap_amend_trip_request(req4, pg_temp.ts(req4), journey, snap, 17700, NULL, 'after refund');
    RAISE EXCEPTION 'a journey with a payment history was amended';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'amendment_paid_journey' THEN RAISE; END IF;
  END;

  -- the function and table are server-only
  IF has_function_privilege('anon', 'public.weemap_amend_trip_request(uuid, timestamptz, jsonb, jsonb, numeric, jsonb, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.weemap_amend_trip_request(uuid, timestamptz, jsonb, jsonb, numeric, jsonb, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.weemap_amend_trip_request(uuid, timestamptz, jsonb, jsonb, numeric, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'weemap_amend_trip_request privileges wrong';
  END IF;
  IF has_table_privilege('anon', 'public.trip_request_revisions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.trip_request_revisions', 'SELECT')
     OR has_table_privilege('service_role', 'public.trip_request_revisions', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.trip_request_revisions', 'SELECT') THEN
    RAISE EXCEPTION 'trip_request_revisions privileges wrong';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trip_request_revisions'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_request_revisions') THEN
    RAISE EXCEPTION 'trip_request_revisions must have RLS on and no policies';
  END IF;
END
$$;

ROLLBACK;
