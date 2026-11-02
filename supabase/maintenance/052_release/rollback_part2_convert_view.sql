-- 052 ROLLBACK, part 2/2 (convert + ops view) — restores the exact pre-052 definitions (049 / 051). Use only if the owner
-- decides to back 052 out. One atomic DO statement with hash guards, like the release parts.
-- Safe only while no trips-only journey has been converted (rollback re-adds the stay requirement).

DO $rollback$
DECLARE c TEXT := md5(regexp_replace(regexp_replace(pg_get_functiondef('public.weemap_convert_trip_request(uuid)'::regprocedure), '--[^\n]*', '', 'g'), '\s+', '', 'g')); v TEXT := md5(regexp_replace(pg_get_viewdef('public.ops_work_items'::regclass, true), '\s+', '', 'g')); a TEXT := md5(regexp_replace(regexp_replace(pg_get_functiondef('public.weemap_amend_trip_request(uuid,timestamptz,jsonb,jsonb,numeric,jsonb,text)'::regprocedure), '--[^\n]*', '', 'g'), '\s+', '', 'g'));
BEGIN
  IF current_database() <> 'postgres' THEN RAISE EXCEPTION '052 guard: unexpected database %', current_database(); END IF;
  IF a <> 'fa01afad9749ef7fb30fe12a34056957' THEN RAISE EXCEPTION '052 rollback part 2 preflight: run part 1 first (amend %)', a; END IF;
  IF c NOT IN ('44a6d6de89b786fdfc50a8a76f2d45a7', '3eed8dd24d3ca38c001ef3b29674a476') OR v NOT IN ('595d95bfdb4ca759609a5f94d2ce2f0e', '5735e2f93e11d5a9ba7f43ac06a3d9b3') THEN
    RAISE EXCEPTION '052 rollback preflight: unexpected convert % / view %', c, v;
  END IF;
  EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.weemap_convert_trip_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor         TEXT := public.weemap_current_actor();
  r             public.trip_requests%ROWTYPE;
  snap          JSONB;
  people        INTEGER;
  trips_total   NUMERIC := 0;
  pkgs_total    NUMERIC := 0;
  side_total    NUMERIC;
  b_type        TEXT;
  b_room        TEXT;
  b_id          UUID;
  tb_ids        UUID[] := '{}';
  tb_id         UUID;
  exp           JSONB;
  line          JSONB;
  line_total    NUMERIC;
BEGIN
  SELECT * INTO r FROM public.trip_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF r.converted_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_converted', true,
      'booking_id', r.converted_booking_id,
      'trip_booking_ids', COALESCE((SELECT jsonb_agg(id ORDER BY created_at)
                                      FROM public.trip_bookings WHERE trip_request_id = r.id), '[]'::jsonb));
  END IF;

  IF r.status NOT IN ('awaiting_payment', 'confirmed') THEN
    RAISE EXCEPTION 'request_not_confirmed' USING ERRCODE = 'check_violation';
  END IF;
  snap := r.quote_snapshot;
  IF snap IS NULL OR jsonb_typeof(snap->'total') <> 'number' THEN
    RAISE EXCEPTION 'missing_quote_snapshot' USING ERRCODE = 'check_violation';
  END IF;
  IF r.accommodation_id IS NULL
     AND (r.transport_mode = 'stay_only' OR COALESCE((snap->>'accommodation_subtotal')::numeric, 0) > 0) THEN
    RAISE EXCEPTION 'missing_accommodation' USING ERRCODE = 'check_violation';
  END IF;

  people := r.adults + r.children;
  SELECT COALESCE(sum((t->>'price')::numeric * people), 0) INTO trips_total
    FROM jsonb_array_elements(COALESCE(snap->'extra_trips', '[]'::jsonb)) t;
  SELECT COALESCE(sum((p->>'total')::numeric), 0) INTO pkgs_total
    FROM jsonb_array_elements(COALESCE(snap->'trip_packages', '[]'::jsonb)) p;
  side_total := (snap->>'total')::numeric - trips_total - pkgs_total;
  IF side_total < 0 THEN
    RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
  END IF;

  b_type := CASE
    WHEN r.transport_mode = 'stay_only' THEN 'accommodation-only'
    WHEN r.accommodation_id IS NULL THEN 'transfer-only'
    ELSE 'package'
  END;
  SELECT a->>'type' INTO b_room
    FROM jsonb_array_elements(r.room_allocations) a
   WHERE a->>'type' IN ('double', 'single', 'triple')
   LIMIT 1;

  INSERT INTO public.bookings (
    customer_name, customer_phone, customer_email, customer_id, booking_type, accommodation_id,
    governorate, trip_date, return_date, duration, nights, transfer_type, transfer_direction,
    room_type, meal_plan_key, num_people, notes, internal_notes, status, total_price, source,
    price_snapshot, trip_request_id)
  VALUES (
    r.customer_name, r.customer_phone, r.customer_email, r.customer_id, b_type, r.accommodation_id,
    r.origin_governorate_code, r.arrival_date, r.departure_date,
    CASE WHEN b_type = 'transfer-only' THEN NULL ELSE (r.departure_date - r.arrival_date) + 1 END,
    CASE WHEN b_type = 'transfer-only' THEN NULL ELSE r.departure_date - r.arrival_date END,
    CASE WHEN r.transport_mode = 'stay_only' THEN NULL ELSE r.transport_mode END,
    CASE WHEN r.transport_mode = 'stay_only' THEN NULL ELSE 'round_trip' END,
    b_room, r.meal_plan_key, people, COALESCE(r.notes, ''),
    'From Trip Builder request ' || r.reference, r.status, side_total, r.source,
    snap || jsonb_build_object(
      'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference),
      'booking_part', 'stay_transport', 'part_total', side_total),
    r.id)
  RETURNING id INTO b_id;

  FOR exp IN SELECT * FROM jsonb_array_elements(r.experiences) LOOP
    IF exp->>'kind' = 'trip' THEN
      SELECT t INTO line FROM jsonb_array_elements(COALESCE(snap->'extra_trips', '[]'::jsonb)) t
       WHERE t->>'trip_id' = exp->>'id' LIMIT 1;
      IF line IS NULL THEN
        RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
      END IF;
      line_total := (line->>'price')::numeric * people;
      INSERT INTO public.trip_bookings (
        customer_id, trip_id, customer_name, customer_phone, preferred_date, num_people, adults, children,
        context, quoted_price, final_price, source, notes, internal_notes, status, price_snapshot,
        trip_request_id)
      VALUES (
        r.customer_id, (exp->>'id')::uuid, r.customer_name, r.customer_phone,
        NULLIF(exp->>'preferred_date', '')::date, people, r.adults, r.children,
        'package_addon', line_total, line_total, r.source, '',
        'From Trip Builder request ' || r.reference, r.status,
        line || jsonb_build_object('num_people', people, 'total', line_total,
          'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference)),
        r.id)
      RETURNING id INTO tb_id;
    ELSIF exp->>'kind' = 'trip_package' THEN
      SELECT p INTO line FROM jsonb_array_elements(COALESCE(snap->'trip_packages', '[]'::jsonb)) p
       WHERE p->>'package_id' = exp->>'id' LIMIT 1;
      IF line IS NULL THEN
        RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
      END IF;
      line_total := (line->>'total')::numeric;
      INSERT INTO public.trip_bookings (
        customer_id, trip_package_id, customer_name, customer_phone, preferred_date, num_people, adults,
        children, context, quoted_price, final_price, source, notes, internal_notes, status,
        package_snapshot, price_snapshot, trip_request_id)
      VALUES (
        r.customer_id, (exp->>'id')::uuid, r.customer_name, r.customer_phone,
        NULLIF(exp->>'preferred_date', '')::date, people, r.adults, r.children,
        'package', line_total, line_total, r.source, '',
        'From Trip Builder request ' || r.reference, r.status, line,
        line || jsonb_build_object('num_people', people,
          'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference)),
        r.id)
      RETURNING id INTO tb_id;
    ELSE
      RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
    END IF;
    tb_ids := tb_ids || tb_id;
    line := NULL;
  END LOOP;

  PERFORM set_config('weemap.payment_maintenance', 'on', true);
  UPDATE public.trip_requests
     SET converted_booking_id = b_id, converted_at = NOW(), converted_by = actor,
         agreed_total = CASE WHEN agreed_total IS NULL THEN (snap->>'total')::numeric ELSE agreed_total END,
         payment_status = CASE WHEN agreed_total IS NULL AND amount_paid = 0 THEN 'unpaid' ELSE payment_status END
   WHERE id = r.id;
  PERFORM set_config('weemap.payment_maintenance', 'off', true);

  INSERT INTO public.domain_events (event_type, aggregate_type, aggregate_id, payload)
  VALUES ('trip_request_converted', 'trip_request', r.id, jsonb_strip_nulls(jsonb_build_object(
    'reference', r.reference, 'customer_id', r.customer_id, 'booking_id', b_id,
    'trip_booking_ids', to_jsonb(tb_ids), 'actor', actor)));

  RETURN jsonb_build_object('already_converted', false, 'booking_id', b_id, 'trip_booking_ids', to_jsonb(tb_ids));
END
$$
$ddl$;
  EXECUTE $ddl$REVOKE ALL ON FUNCTION public.weemap_convert_trip_request(UUID) FROM PUBLIC, anon, authenticated
$ddl$;
  EXECUTE $ddl$GRANT EXECUTE ON FUNCTION public.weemap_convert_trip_request(UUID) TO service_role
$ddl$;
  EXECUTE $ddl$CREATE OR REPLACE VIEW public.ops_work_items
WITH (security_invoker = true) AS
SELECT
  'accommodation_booking'::text AS entity_type, b.id AS entity_id,
  'BK-' || upper(left(b.id::text, 8)) AS reference, b.booking_type AS subtype, b.payment_kind,
  b.customer_id, b.customer_name, b.customer_phone,
  b.status, b.payment_status, b.total_price AS amount_total, b.amount_paid,
  b.trip_date AS start_date, b.return_date AS end_date, b.num_people AS people,
  COALESCE(a.name_en, '') AS title_en, COALESCE(a.name_ar, '') AS title_ar,
  b.transfer_type, b.source, b.trip_request_id, b.created_at, b.updated_at,
  (b.trip_request_id IS NOT NULL) AS journey_component, false AS converted
FROM public.bookings b
LEFT JOIN public.accommodations a ON a.id = b.accommodation_id
UNION ALL
SELECT
  'trip_booking', tb.id, 'TB-' || upper(left(tb.id::text, 8)),
  CASE WHEN tb.trip_package_id IS NOT NULL THEN 'package' ELSE 'trip' END, tb.payment_kind,
  tb.customer_id, tb.customer_name, tb.customer_phone,
  tb.status, tb.payment_status, COALESCE(tb.final_price, tb.quoted_price), tb.amount_paid,
  tb.preferred_date, NULL::date, tb.num_people,
  COALESCE(st.name_en, tp.name_en, ''), COALESCE(st.name_ar, tp.name_ar, ''),
  NULL, tb.source, tb.trip_request_id, tb.created_at, tb.updated_at,
  (tb.trip_request_id IS NOT NULL) AS journey_component, false AS converted
FROM public.trip_bookings tb
LEFT JOIN public.sinai_trips st ON st.id = tb.trip_id
LEFT JOIN public.trip_packages tp ON tp.id = tb.trip_package_id
UNION ALL
SELECT
  'signature_request', eb.id, 'SG-' || upper(left(eb.id::text, 8)),
  CASE WHEN eb.is_custom_request THEN 'custom' ELSE 'experience' END, 'signature',
  eb.customer_id, eb.full_name, eb.phone,
  eb.status, eb.payment_status, eb.quoted_price, eb.amount_paid,
  COALESCE(ed.start_date, eb.preferred_date), ed.end_date, eb.spots_requested,
  COALESCE(e.title_en, ''), COALESCE(e.title_ar, ''),
  NULL, eb.source, NULL::uuid, eb.created_at, eb.updated_at,
  false AS journey_component, false AS converted
FROM public.experience_bookings eb
LEFT JOIN public.experiences e ON e.id = eb.experience_id
LEFT JOIN public.experience_dates ed ON ed.id = eb.experience_date_id
UNION ALL
SELECT
  'trip_request', tr.id, tr.reference, tr.transport_mode,
  CASE WHEN tr.converted_booking_id IS NOT NULL THEN 'journey' ELSE NULL END,
  tr.customer_id, tr.customer_name, tr.customer_phone,
  tr.status,
  CASE WHEN tr.converted_booking_id IS NOT NULL THEN COALESCE(tr.payment_status, 'converted') ELSE NULL END,
  COALESCE(tr.agreed_total, tr.quoted_total), tr.amount_paid,
  tr.arrival_date, tr.departure_date, tr.adults + tr.children,
  COALESCE(a.name_en, ''), COALESCE(a.name_ar, ''),
  NULLIF(tr.transport_mode, 'stay_only'), tr.source, tr.id, tr.submitted_at, tr.updated_at,
  false AS journey_component, (tr.converted_booking_id IS NOT NULL) AS converted
FROM public.trip_requests tr
LEFT JOIN public.accommodations a ON a.id = tr.accommodation_id
UNION ALL
SELECT
  'commerce_order', co.id, co.order_number, co.order_type, 'commerce',
  co.customer_id, COALESCE(c.name, ''), COALESCE(c.phone, ''),
  co.status, co.payment_status, co.total_price, co.amount_paid,
  (SELECT min(rr.start_date) FROM public.rental_reservations rr
     JOIN public.commerce_order_items oi ON oi.id = rr.order_item_id
    WHERE oi.order_id = co.id),
  (SELECT max(rr.end_date) FROM public.rental_reservations rr
     JOIN public.commerce_order_items oi ON oi.id = rr.order_item_id
    WHERE oi.order_id = co.id),
  NULL::integer, '', '', NULL, co.source, NULL::uuid, co.created_at, co.updated_at,
  false AS journey_component, false AS converted
FROM public.commerce_orders co
LEFT JOIN public.customers c ON c.id = co.customer_id
UNION ALL
SELECT
  'edition_request', er.id, 'ER-' || upper(left(er.id::text, 8)), lower(er.intent), NULL,
  NULL::uuid, er.customer_name, er.phone,
  er.status, NULL, NULL::numeric, NULL::numeric,
  er.requested_start_date, NULL::date, er.travelers,
  COALESCE(ed.title_en, er.edition_title_snapshot, ''), COALESCE(ed.title_ar, er.edition_title_snapshot, ''),
  NULL, er.source, NULL::uuid, er.created_at, er.created_at,
  false AS journey_component, false AS converted
FROM public.edition_requests er
LEFT JOIN public.editions ed ON ed.id = er.edition_id
$ddl$;
  EXECUTE $ddl$COMMENT ON VIEW public.ops_work_items IS
  'Operations Center queue: one normalised row per request/booking/order (read-only).'
$ddl$;
  EXECUTE $ddl$REVOKE ALL ON public.ops_work_items FROM anon, authenticated
$ddl$;
  EXECUTE $ddl$GRANT SELECT ON public.ops_work_items TO service_role
$ddl$;
  c := md5(regexp_replace(regexp_replace(pg_get_functiondef('public.weemap_convert_trip_request(uuid)'::regprocedure), '--[^\n]*', '', 'g'), '\s+', '', 'g')); v := md5(regexp_replace(pg_get_viewdef('public.ops_work_items'::regclass, true), '\s+', '', 'g'));
  IF c <> '3eed8dd24d3ca38c001ef3b29674a476' OR v <> '5735e2f93e11d5a9ba7f43ac06a3d9b3' THEN RAISE EXCEPTION '052 rollback post-check failed (convert %, view %)', c, v; END IF;
  RAISE NOTICE '052 rollback part 2 applied: convert %, view %', c, v;
END
$rollback$;
