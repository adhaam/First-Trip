-- 052_trips_only_journeys.sql
-- Trips-only Build Your Trip journeys: a self-arriving customer (transport
-- mode 'stay_only' = "I'll get there myself") who books Sinai trips / trip
-- packages with NO accommodation (Experience & Operations stabilization, B2).
--
-- WHY
--   A guest already staying in Dahab could not request excursions without
--   picking a hotel: the builder, the request schema and this database all
--   assumed stay_only ⇒ accommodation. The app now accepts a stay_only
--   request with no accommodation_id provided it has ≥1 experience, and
--   prices it with the trips only (no stay, room, meal or transfer line).
--   Without this migration Ops could not convert such a request
--   (weemap_convert_trip_request raised 'missing_accommodation'), and if that
--   guard were simply dropped the conversion would create a zero-value
--   "accommodation-only" bookings child — a phantom stay booking.
--
-- CONTRACT (minimal diffs on the latest definitions: convert from 049, the
-- ops view from 049, amend from 051 — every other line is verbatim)
--   * weemap_convert_trip_request():
--       - already-converted check also honours converted_at (a trips-only
--         journey has converted_booking_id NULL forever);
--       - trips_only := transport_mode = 'stay_only' AND accommodation_id IS
--         NULL. 'missing_accommodation' is raised for stay_only only when the
--         request has no experiences at all (unchanged for every other case);
--       - a trips-only snapshot must carry nothing but its trips/packages
--         (stay/transport side_total = 0, else 'snapshot_mismatch');
--       - trips-only: NO bookings row is inserted; trip_bookings children
--         are created exactly as before; converted_at / agreed_total are set.
--   * ops_work_items (same columns, same order): the trip_request branch
--     treats converted_booking_id OR converted_at as "converted"; a converted
--     trips-only journey has payment_kind 'trip' (the approved standalone
--     Sinai trips policy: 100% after availability confirmation) instead of
--     'journey' (50% after confirmation / 50% on arrival). The parent
--     trip_request stays the only payment owner either way.
--   * weemap_amend_trip_request(): "converted" also honours converted_at;
--     a converted trips-only journey amends in place (no bookings child to
--     re-sync); an amendment that would turn a converted trips-only journey
--     into a stay/transport journey or back raises
--     'amendment_changes_journey_shape' (staff cancel and re-request).
--   * No table, column, constraint, policy, payment record or data change.
--     Existing journeys (all have accommodation or transport) behave exactly
--     as before.
--
-- Safe to re-run (CREATE OR REPLACE only).

CREATE OR REPLACE FUNCTION public.weemap_convert_trip_request(p_request_id UUID)
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
  trips_only    BOOLEAN;
BEGIN
  SELECT * INTO r FROM public.trip_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF r.converted_booking_id IS NOT NULL OR r.converted_at IS NOT NULL THEN
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
  -- 052: self-arrival with no accommodation is a trips-only journey — valid
  -- as long as it carries at least one trip / trip package.
  trips_only := r.transport_mode = 'stay_only' AND r.accommodation_id IS NULL;
  IF r.accommodation_id IS NULL
     AND ((trips_only AND jsonb_array_length(COALESCE(r.experiences, '[]'::jsonb)) = 0)
          OR COALESCE((snap->>'accommodation_subtotal')::numeric, 0) > 0) THEN
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
  -- 052: a trips-only journey has nothing but its trips to charge for.
  IF trips_only AND side_total <> 0 THEN
    RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
  END IF;

  -- 052: no stay and no WEEMAP transport -> no phantom stay/transfer booking;
  -- converted_booking_id stays NULL and converted_at marks the conversion.
  IF NOT trips_only THEN
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
  END IF;

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

  -- 049: price the journey as one commercial unit the moment it becomes
  -- real (never overwrites an agreed_total a prior conversion/backfill/
  -- manual review already set). Not a payment — runs under the maintenance
  -- flag, same as any other non-ledger system write to these columns.
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
$$;

REVOKE ALL ON FUNCTION public.weemap_convert_trip_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_convert_trip_request(UUID) TO service_role;


-- ─── B. ops_work_items: trips-only journeys are converted and pay 100% ───
CREATE OR REPLACE VIEW public.ops_work_items
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
  CASE WHEN (tr.converted_booking_id IS NOT NULL OR tr.converted_at IS NOT NULL)
       THEN CASE WHEN tr.transport_mode = 'stay_only' AND tr.accommodation_id IS NULL THEN 'trip' ELSE 'journey' END
       ELSE NULL END,
  tr.customer_id, tr.customer_name, tr.customer_phone,
  tr.status,
  CASE WHEN (tr.converted_booking_id IS NOT NULL OR tr.converted_at IS NOT NULL) THEN COALESCE(tr.payment_status, 'converted') ELSE NULL END,
  COALESCE(tr.agreed_total, tr.quoted_total), tr.amount_paid,
  tr.arrival_date, tr.departure_date, tr.adults + tr.children,
  COALESCE(a.name_en, ''), COALESCE(a.name_ar, ''),
  NULLIF(tr.transport_mode, 'stay_only'), tr.source, tr.id, tr.submitted_at, tr.updated_at,
  false AS journey_component, (tr.converted_booking_id IS NOT NULL OR tr.converted_at IS NOT NULL) AS converted
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
LEFT JOIN public.editions ed ON ed.id = er.edition_id;

COMMENT ON VIEW public.ops_work_items IS
  'Operations Center queue: one normalised row per request/booking/order (read-only).';
REVOKE ALL ON public.ops_work_items FROM anon, authenticated;
GRANT SELECT ON public.ops_work_items TO service_role;


-- ─── C. weemap_amend_trip_request(): trips-only journeys amend in place ───
CREATE OR REPLACE FUNCTION public.weemap_amend_trip_request(
  p_request_id          UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_journey             JSONB,
  p_quote_snapshot      JSONB,
  p_quoted_total        NUMERIC,
  p_payment_plan        JSONB,
  p_reason              TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor            TEXT := public.weemap_current_actor();
  r                public.trip_requests%ROWTYPE;
  v_reason         TEXT;
  num              NUMERIC;
  -- new journey values (default: current)
  n_transport      TEXT;
  n_origin         TEXT;
  n_pattern        TEXT;
  n_arrival        DATE;
  n_departure      DATE;
  n_adults         SMALLINT;
  n_children       SMALLINT;
  n_acc            UUID;
  n_rooms          JSONB;
  n_meal           TEXT;
  n_exps           JSONB;
  exp              JSONB;
  exp_ids          UUID[] := '{}';
  exp_id           UUID;
  -- revisions
  rev_no           INTEGER;
  prev_total       NUMERIC;
  diff             NUMERIC;
  new_status       TEXT;
  regress          BOOLEAN;
  converted        BOOLEAN;
  -- conversion-style split
  snap             JSONB := p_quote_snapshot;
  people           INTEGER;
  trips_total      NUMERIC := 0;
  pkgs_total       NUMERIC := 0;
  side_total       NUMERIC;
  b_type           TEXT;
  b_room           TEXT;
  b_id             UUID;
  tb_id            UUID;
  tb_ids           UUID[] := '{}';
  removed_ids      UUID[] := '{}';
  line             JSONB;
  line_total       NUMERIC;
  prev_kind_maint  TEXT;
  prev_pay_maint   TEXT;
  trips_only       BOOLEAN := false;
BEGIN
  -- 1. Lock the request.
  SELECT * INTO r FROM public.trip_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
  END IF;

  -- 2. Optimistic concurrency (to the millisecond: a JS Date round-trip
  --    truncates microseconds).
  IF p_expected_updated_at IS NULL
     OR date_trunc('milliseconds', p_expected_updated_at) IS DISTINCT FROM date_trunc('milliseconds', r.updated_at) THEN
    RAISE EXCEPTION 'stale_request' USING ERRCODE = 'PT409';
  END IF;

  -- 3. Closed journeys are not amended.
  IF r.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'amendment_closed' USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Paid guard: the journey, or any fulfilment child, ever received money.
  IF COALESCE(r.amount_paid, 0) > 0
     OR EXISTS (SELECT 1 FROM public.payment_records pr
                 WHERE pr.entity_type = 'trip_request' AND pr.entity_id = r.id)
     OR EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.trip_request_id = r.id
                   AND (COALESCE(b.amount_paid, 0) > 0
                        OR EXISTS (SELECT 1 FROM public.payment_records pr
                                    WHERE pr.entity_type = 'accommodation_booking' AND pr.entity_id = b.id)))
     OR EXISTS (SELECT 1 FROM public.trip_bookings tb
                 WHERE tb.trip_request_id = r.id
                   AND (COALESCE(tb.amount_paid, 0) > 0
                        OR EXISTS (SELECT 1 FROM public.payment_records pr
                                    WHERE pr.entity_type = 'trip_booking' AND pr.entity_id = tb.id))) THEN
    RAISE EXCEPTION 'amendment_paid_journey' USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Validate inputs.
  n_transport := r.transport_mode;   n_origin   := r.origin_governorate_code;
  n_pattern   := r.stay_pattern_code; n_arrival := r.arrival_date;
  n_departure := r.departure_date;   n_adults   := r.adults;
  n_children  := r.children;         n_acc      := r.accommodation_id;
  n_rooms     := r.room_allocations; n_meal     := r.meal_plan_key;
  n_exps      := r.experiences;

  BEGIN
    v_reason := btrim(p_reason);
    IF v_reason IS NULL OR v_reason = '' OR char_length(v_reason) > 500 THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_quoted_total IS NULL OR p_quoted_total < 0 OR p_quoted_total <> round(p_quoted_total, 2) THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_quote_snapshot IS NULL OR jsonb_typeof(p_quote_snapshot) <> 'object'
       OR jsonb_typeof(p_quote_snapshot -> 'total') IS DISTINCT FROM 'number'
       OR (p_quote_snapshot ->> 'total')::numeric <> p_quoted_total THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_payment_plan IS NOT NULL AND jsonb_typeof(p_payment_plan) NOT IN ('object', 'null') THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey IS NULL OR jsonb_typeof(p_journey) <> 'object' THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'transport_mode' THEN
      IF jsonb_typeof(p_journey -> 'transport_mode') <> 'string' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      n_transport := p_journey ->> 'transport_mode';
    END IF;
    IF n_transport NOT IN ('package_bus', 'hiace', 'stay_only') THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'origin_governorate_code' THEN
      n_origin := NULLIF(btrim(p_journey ->> 'origin_governorate_code'), '');
    END IF;
    IF n_transport <> 'stay_only' AND n_origin IS NULL THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'stay_pattern_code' THEN
      n_pattern := NULLIF(btrim(p_journey ->> 'stay_pattern_code'), '');
    END IF;
    IF n_pattern IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.stay_patterns WHERE code = n_pattern) THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'arrival_date' THEN
      IF jsonb_typeof(p_journey -> 'arrival_date') <> 'string'
         OR (p_journey ->> 'arrival_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      n_arrival := (p_journey ->> 'arrival_date')::date;
    END IF;
    IF p_journey ? 'departure_date' THEN
      IF jsonb_typeof(p_journey -> 'departure_date') <> 'string'
         OR (p_journey ->> 'departure_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      n_departure := (p_journey ->> 'departure_date')::date;
    END IF;
    IF n_departure < n_arrival THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'adults' THEN
      IF jsonb_typeof(p_journey -> 'adults') <> 'number' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      num := (p_journey ->> 'adults')::numeric;
      IF num <> trunc(num) THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      n_adults := num::smallint;
    END IF;
    IF p_journey ? 'children' THEN
      IF jsonb_typeof(p_journey -> 'children') <> 'number' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      num := (p_journey ->> 'children')::numeric;
      IF num <> trunc(num) THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      n_children := num::smallint;
    END IF;
    IF n_adults < 1 OR n_children < 0 THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'accommodation_id' THEN
      n_acc := NULLIF(btrim(p_journey ->> 'accommodation_id'), '')::uuid;
    END IF;
    IF n_acc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accommodations WHERE id = n_acc) THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'room_allocations' THEN
      n_rooms := p_journey -> 'room_allocations';
    END IF;
    IF jsonb_typeof(n_rooms) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF p_journey ? 'meal_plan_key' THEN
      n_meal := NULLIF(btrim(p_journey ->> 'meal_plan_key'), '');
    END IF;

    IF p_journey ? 'experiences' THEN
      n_exps := p_journey -> 'experiences';
    END IF;
    IF jsonb_typeof(n_exps) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    FOR exp IN SELECT * FROM jsonb_array_elements(n_exps) LOOP
      IF jsonb_typeof(exp) <> 'object' OR (exp ->> 'kind') NOT IN ('trip', 'trip_package')
         OR jsonb_typeof(exp -> 'id') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      IF COALESCE(exp ->> 'preferred_date', '') <> '' AND (exp ->> 'preferred_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      exp_id := (exp ->> 'id')::uuid;
      IF exp_id = ANY (exp_ids) THEN
        RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      exp_ids := exp_ids || exp_id;
    END LOOP;
  EXCEPTION WHEN data_exception THEN
    -- Any malformed cast (uuid, date, number, smallint overflow, …).
    RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value';
  END;

  converted := r.converted_booking_id IS NOT NULL OR r.converted_at IS NOT NULL;
  people := n_adults + n_children;

  -- Converted journeys: split the new quote exactly as conversion does,
  -- before anything is written.
  IF converted THEN
    trips_only := n_transport = 'stay_only' AND n_acc IS NULL;
    IF n_acc IS NULL
       AND ((trips_only AND jsonb_array_length(COALESCE(n_exps, '[]'::jsonb)) = 0)
            OR COALESCE((snap ->> 'accommodation_subtotal')::numeric, 0) > 0) THEN
      RAISE EXCEPTION 'missing_accommodation' USING ERRCODE = 'check_violation';
    END IF;
    -- 052: a converted journey keeps its shape. Turning a trips-only journey
    -- into one with a stay/transport (or back) would need a booking child
    -- created or retired; staff cancel and re-request instead.
    IF trips_only IS DISTINCT FROM (NOT EXISTS (SELECT 1 FROM public.bookings WHERE trip_request_id = r.id)) THEN
      RAISE EXCEPTION 'amendment_changes_journey_shape' USING ERRCODE = 'check_violation';
    END IF;
    BEGIN
      SELECT COALESCE(sum((t ->> 'price')::numeric * people), 0) INTO trips_total
        FROM jsonb_array_elements(COALESCE(snap -> 'extra_trips', '[]'::jsonb)) t;
      SELECT COALESCE(sum((p ->> 'total')::numeric), 0) INTO pkgs_total
        FROM jsonb_array_elements(COALESCE(snap -> 'trip_packages', '[]'::jsonb)) p;
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
    END;
    side_total := p_quoted_total - trips_total - pkgs_total;
    IF side_total < 0 OR (trips_only AND side_total <> 0) THEN
      RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 6. Revision 1 ('original') from the CURRENT row, once.
  SELECT COALESCE(max(revision_number), 0) INTO rev_no
    FROM public.trip_request_revisions WHERE trip_request_id = r.id;
  IF rev_no = 0 THEN
    INSERT INTO public.trip_request_revisions (
      trip_request_id, revision_number, kind, journey, quote_snapshot, quoted_total, payment_plan,
      previous_total, difference, reason, status_at_revision, availability_confirmed, created_by, created_at)
    VALUES (
      r.id, 1, 'original',
      jsonb_build_object(
        'transport_mode', r.transport_mode, 'origin_governorate_code', r.origin_governorate_code,
        'stay_pattern_code', r.stay_pattern_code, 'arrival_date', r.arrival_date,
        'departure_date', r.departure_date, 'adults', r.adults, 'children', r.children,
        'accommodation_id', r.accommodation_id, 'room_allocations', r.room_allocations,
        'meal_plan_key', r.meal_plan_key, 'experiences', r.experiences),
      COALESCE(r.quote_snapshot, '{}'::jsonb),
      COALESCE(r.quoted_total, (r.quote_snapshot ->> 'total')::numeric, 0),
      r.payment_plan, NULL, NULL, NULL,
      r.status, r.status IN ('awaiting_payment', 'confirmed', 'completed'),
      'customer:' || r.source, r.created_at);
    rev_no := 1;
  END IF;
  rev_no := rev_no + 1;

  -- 7. Availability must be re-confirmed for a revised journey.
  regress := r.status IN ('awaiting_payment', 'confirmed');
  new_status := CASE WHEN regress THEN 'checking_availability' ELSE r.status END;

  prev_total := COALESCE(r.agreed_total, r.quoted_total);
  diff := CASE WHEN prev_total IS NULL THEN NULL ELSE p_quoted_total - prev_total END;

  -- 8. Update the parent.
  IF converted THEN
    -- agreed_total follows the new quote. Not a payment: amount_paid is 0
    -- (guard 4) and payment_status stays as it is.
    prev_pay_maint := COALESCE(current_setting('weemap.payment_maintenance', true), 'off');
    PERFORM set_config('weemap.payment_maintenance', 'on', true);
  END IF;
  UPDATE public.trip_requests SET
    origin_governorate_code = n_origin, transport_mode = n_transport, stay_pattern_code = n_pattern,
    arrival_date = n_arrival, departure_date = n_departure, adults = n_adults, children = n_children,
    accommodation_id = n_acc, room_allocations = n_rooms, meal_plan_key = n_meal, experiences = n_exps,
    quote_snapshot = p_quote_snapshot, quoted_total = p_quoted_total, payment_plan = p_payment_plan,
    agreed_total = CASE WHEN converted THEN p_quoted_total ELSE agreed_total END,
    status = new_status,
    confirmed_at = CASE WHEN regress THEN NULL ELSE confirmed_at END
  WHERE id = r.id;
  IF converted THEN
    PERFORM set_config('weemap.payment_maintenance', prev_pay_maint, true);
  END IF;

  -- 9. Converted journeys: re-sync the fulfilment children in place.
  IF converted THEN
    -- 052: a trips-only journey has no stay/transport child to re-sync.
    IF NOT trips_only THEN
      SELECT id INTO b_id FROM public.bookings WHERE trip_request_id = r.id FOR UPDATE;
      IF b_id IS NULL THEN
        RAISE EXCEPTION 'journey_children_missing' USING ERRCODE = 'check_violation';
      END IF;

      b_type := CASE
        WHEN n_transport = 'stay_only' THEN 'accommodation-only'
        WHEN n_acc IS NULL THEN 'transfer-only'
        ELSE 'package'
      END;
      SELECT a ->> 'type' INTO b_room
        FROM jsonb_array_elements(n_rooms) a
       WHERE a ->> 'type' IN ('double', 'single', 'triple')
       LIMIT 1;

      prev_kind_maint := COALESCE(current_setting('weemap.payment_kind_maintenance', true), 'off');
      PERFORM set_config('weemap.payment_kind_maintenance', 'on', true);
      UPDATE public.bookings SET
        booking_type = b_type,
        payment_kind = public.weemap_booking_payment_kind(b_type),
        accommodation_id = n_acc,
        governorate = n_origin,
        trip_date = n_arrival,
        return_date = n_departure,
        duration = CASE WHEN b_type = 'transfer-only' THEN NULL ELSE (n_departure - n_arrival) + 1 END,
        nights = CASE WHEN b_type = 'transfer-only' THEN NULL ELSE n_departure - n_arrival END,
        transfer_type = CASE WHEN n_transport = 'stay_only' THEN NULL ELSE n_transport END,
        transfer_direction = CASE WHEN n_transport = 'stay_only' THEN NULL ELSE 'round_trip' END,
        room_type = b_room,
        meal_plan_key = n_meal,
        num_people = people,
        total_price = side_total,
        status = new_status,
        confirmed_at = CASE WHEN regress THEN NULL ELSE confirmed_at END,
        price_snapshot = snap || jsonb_build_object(
          'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference),
          'booking_part', 'stay_transport', 'part_total', side_total, 'amended_revision', rev_no)
      WHERE id = b_id;
      PERFORM set_config('weemap.payment_kind_maintenance', prev_kind_maint, true);
    END IF;

    FOR exp IN SELECT * FROM jsonb_array_elements(n_exps) LOOP
      exp_id := (exp ->> 'id')::uuid;
      tb_id := NULL;
      SELECT id INTO tb_id FROM public.trip_bookings
       WHERE trip_request_id = r.id AND COALESCE(trip_id, trip_package_id) = exp_id
       FOR UPDATE;

      IF exp ->> 'kind' = 'trip' THEN
        SELECT t INTO line FROM jsonb_array_elements(COALESCE(snap -> 'extra_trips', '[]'::jsonb)) t
         WHERE t ->> 'trip_id' = exp ->> 'id' LIMIT 1;
        IF line IS NULL THEN
          RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
        END IF;
        line_total := (line ->> 'price')::numeric * people;
        IF tb_id IS NOT NULL THEN
          UPDATE public.trip_bookings SET
            num_people = people, adults = n_adults, children = n_children,
            preferred_date = NULLIF(exp ->> 'preferred_date', '')::date,
            quoted_price = line_total, final_price = line_total,
            price_snapshot = line || jsonb_build_object('num_people', people, 'total', line_total,
              'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference),
              'amended_revision', rev_no),
            status = new_status,
            confirmed_at = CASE WHEN regress THEN NULL ELSE confirmed_at END,
            cancelled_at = NULL
          WHERE id = tb_id;
        ELSE
          INSERT INTO public.trip_bookings (
            customer_id, trip_id, customer_name, customer_phone, preferred_date, num_people, adults, children,
            context, quoted_price, final_price, source, notes, internal_notes, status, price_snapshot,
            trip_request_id)
          VALUES (
            r.customer_id, exp_id, r.customer_name, r.customer_phone,
            NULLIF(exp ->> 'preferred_date', '')::date, people, n_adults, n_children,
            'package_addon', line_total, line_total, r.source, '',
            'From Trip Builder request ' || r.reference || ' (added by amendment rev ' || rev_no || ')',
            new_status,
            line || jsonb_build_object('num_people', people, 'total', line_total,
              'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference),
              'amended_revision', rev_no),
            r.id)
          RETURNING id INTO tb_id;
        END IF;
      ELSE
        SELECT p INTO line FROM jsonb_array_elements(COALESCE(snap -> 'trip_packages', '[]'::jsonb)) p
         WHERE p ->> 'package_id' = exp ->> 'id' LIMIT 1;
        IF line IS NULL THEN
          RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';
        END IF;
        line_total := (line ->> 'total')::numeric;
        IF tb_id IS NOT NULL THEN
          UPDATE public.trip_bookings SET
            num_people = people, adults = n_adults, children = n_children,
            preferred_date = NULLIF(exp ->> 'preferred_date', '')::date,
            quoted_price = line_total, final_price = line_total,
            package_snapshot = line,
            price_snapshot = line || jsonb_build_object('num_people', people,
              'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference),
              'amended_revision', rev_no),
            status = new_status,
            confirmed_at = CASE WHEN regress THEN NULL ELSE confirmed_at END,
            cancelled_at = NULL
          WHERE id = tb_id;
        ELSE
          INSERT INTO public.trip_bookings (
            customer_id, trip_package_id, customer_name, customer_phone, preferred_date, num_people, adults,
            children, context, quoted_price, final_price, source, notes, internal_notes, status,
            package_snapshot, price_snapshot, trip_request_id)
          VALUES (
            r.customer_id, exp_id, r.customer_name, r.customer_phone,
            NULLIF(exp ->> 'preferred_date', '')::date, people, n_adults, n_children,
            'package', line_total, line_total, r.source, '',
            'From Trip Builder request ' || r.reference || ' (added by amendment rev ' || rev_no || ')',
            new_status, line,
            line || jsonb_build_object('num_people', people,
              'converted_from', jsonb_build_object('trip_request_id', r.id, 'reference', r.reference),
              'amended_revision', rev_no),
            r.id)
          RETURNING id INTO tb_id;
        END IF;
      END IF;
      tb_ids := tb_ids || tb_id;
      line := NULL;
    END LOOP;

    -- Items no longer in the journey: cancel, never delete.
    WITH removed AS (
      UPDATE public.trip_bookings SET
        status = 'cancelled',
        internal_notes = btrim(COALESCE(internal_notes, '') || E'\nRemoved by amendment rev ' || rev_no)
      WHERE trip_request_id = r.id
        AND status <> 'cancelled'
        AND NOT (COALESCE(trip_id, trip_package_id) = ANY (exp_ids))
      RETURNING id)
    SELECT COALESCE(array_agg(id), '{}') INTO removed_ids FROM removed;
  END IF;

  -- 10. Revision N+1.
  INSERT INTO public.trip_request_revisions (
    trip_request_id, revision_number, kind, journey, quote_snapshot, quoted_total, payment_plan,
    previous_total, difference, reason, status_at_revision, availability_confirmed, created_by)
  VALUES (
    r.id, rev_no, 'amendment',
    jsonb_build_object(
      'transport_mode', n_transport, 'origin_governorate_code', n_origin,
      'stay_pattern_code', n_pattern, 'arrival_date', n_arrival, 'departure_date', n_departure,
      'adults', n_adults, 'children', n_children, 'accommodation_id', n_acc,
      'room_allocations', n_rooms, 'meal_plan_key', n_meal, 'experiences', n_exps),
    p_quote_snapshot, p_quoted_total, p_payment_plan,
    prev_total, diff, v_reason,
    new_status, new_status IN ('awaiting_payment', 'confirmed', 'completed'), actor);

  -- 11. Outbox event.
  INSERT INTO public.domain_events (event_type, aggregate_type, aggregate_id, payload)
  VALUES ('trip_request_amended', 'trip_request', r.id, jsonb_strip_nulls(jsonb_build_object(
    'reference', r.reference, 'revision_number', rev_no, 'previous_total', prev_total,
    'new_total', p_quoted_total, 'difference', diff, 'status', new_status, 'actor', actor)));

  -- 12. Result.
  RETURN jsonb_build_object(
    'revision_number', rev_no,
    'previous_total', prev_total,
    'new_total', p_quoted_total,
    'difference', diff,
    'status', new_status,
    'converted', converted,
    'booking_id', b_id,
    'trip_booking_ids', to_jsonb(tb_ids),
    'removed_trip_booking_ids', to_jsonb(removed_ids),
    'updated_at', (SELECT updated_at FROM public.trip_requests WHERE id = r.id));
END
$$;

REVOKE ALL ON FUNCTION public.weemap_amend_trip_request(UUID, TIMESTAMPTZ, JSONB, JSONB, NUMERIC, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_amend_trip_request(UUID, TIMESTAMPTZ, JSONB, JSONB, NUMERIC, JSONB, TEXT)
  TO service_role;

