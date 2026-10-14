-- 051_journey_amendments.sql
-- A customer (or an operator on their behalf) can amend a Build Your Trip
-- journey in place: same reference, same parent trip_request, a new quote,
-- and an append-only quotation history (WEEMAP Journeys · M5).
--
-- WHY
--   Until now a journey was frozen at submission. Changing dates, travellers,
--   room, meal plan or experiences meant cancelling and re-submitting, which
--   produced a second reference, a second set of fulfilment rows and no
--   record that the two were the same trip. Under 049 the parent trip_request
--   is the only commercial payment owner of a journey, so the parent is the
--   right — and only — thing to amend. Its fulfilment children are re-synced
--   in place; nothing is duplicated and no money ledger is touched.
--
-- CONTRACT
--   * trip_request_revisions: append-only quotation history of ONE journey.
--     Revision 1 ('original') is written lazily from the CURRENT parent row
--     the first time the journey is amended, so journeys that were never
--     amended carry no revision rows and existing data needs no backfill.
--     Every later revision is kind 'amendment'. Rows hold the journey fields,
--     the frozen quote_snapshot / quoted_total / payment_plan of that
--     revision, the previous total and the difference, the reason, the
--     request status at the time and whether availability had been confirmed
--     (true when the status was awaiting_payment / confirmed / completed).
--     UPDATE is always refused ('revision_append_only'); DELETE is refused
--     unless the parent request no longer exists (ON DELETE CASCADE of an
--     unpaid request) or a deliberate weemap.payment_maintenance transaction
--     is running. Server-only: RLS on, no policies, anon/authenticated have
--     no access, service_role may only SELECT (rows are written solely by
--     weemap_amend_trip_request()).
--   * weemap_amend_trip_request(p_request_id, p_expected_updated_at,
--     p_journey, p_quote_snapshot, p_quoted_total, p_payment_plan, p_reason)
--     → jsonb {revision_number, previous_total, new_total, difference,
--     status, converted, booking_id, trip_booking_ids,
--     removed_trip_booking_ids, updated_at}. One transaction, service_role
--     only (SECURITY DEFINER). Errors (machine message, SQLSTATE):
--       not_found               no_data_found       no such request
--       stale_request           PT409               p_expected_updated_at <>
--                                                   updated_at (compared to
--                                                   the millisecond so a JS
--                                                   Date round-trip matches)
--       amendment_closed        check_violation     cancelled / completed
--       amendment_paid_journey  check_violation     the journey, or any of its
--                                                   children, has received
--                                                   money (amount_paid > 0 or
--                                                   any payment_records row).
--                                                   Paid journeys are never
--                                                   amended by this function.
--       invalid_amendment       invalid_parameter_value  bad inputs (quote
--                                                   total mismatch, empty or
--                                                   >500-char reason,
--                                                   adults < 1, bad dates,
--                                                   unknown transport mode,
--                                                   malformed experiences…)
--       missing_accommodation / snapshot_mismatch /
--       journey_children_missing check_violation    converted journeys only:
--                                                   the new quote cannot be
--                                                   split into the stay side
--                                                   and the trip lines, or a
--                                                   converted journey has lost
--                                                   its bookings child.
--     p_journey carries the journey fields; a key that is ABSENT keeps the
--     current value, a present key replaces it (JSON null clears the
--     nullable ones). It never touches payment_records, amount_paid,
--     payment_status or payment_kind of the parent.
--   * Status: a journey that was awaiting_payment or confirmed goes back to
--     checking_availability, because availability must be re-confirmed for
--     the revised journey (its confirmed_at is cleared). Any other open
--     status is unchanged. This is a system transition: no database trigger
--     restricts trip_requests / bookings / trip_bookings transitions (only
--     commerce orders have one, 039), but src/lib/request-workflow.ts does
--     not list awaiting_payment/confirmed → checking_availability for
--     operators, so staff cannot do it by hand.
--   * Converted journeys (converted_booking_id NOT NULL; unpaid by the paid
--     guard): agreed_total follows the new quote (under
--     weemap.payment_maintenance, payment_status stays 'unpaid'), the single
--     bookings child is updated in place (dates, people, stay, room, meal,
--     transfer, total_price = the stay/transport side of the new quote,
--     price_snapshot, status) and trip_bookings children are matched by
--     (trip_request_id, COALESCE(trip_id, trip_package_id)): existing items
--     are updated and re-opened, new items inserted exactly as
--     weemap_convert_trip_request() does, items no longer in the journey are
--     set to 'cancelled' with 'Removed by amendment rev N' appended to
--     internal_notes. Rows are never deleted. A bookings child whose
--     booking_type changes (package / accommodation-only / transfer-only)
--     has its payment_kind re-derived under
--     weemap.payment_kind_maintenance so the two stay consistent.
--     Unconverted journeys keep agreed_total NULL.
--   * domain_events 'trip_request_amended' (aggregate trip_request) with the
--     reference, revision number, previous/new total, difference, status and
--     actor — identifiers and numbers only. domain_events.event_type has no
--     CHECK constraint, so nothing is widened; the vocabulary mirror in
--     src/lib/domain-events.ts must list the new type.
--
-- Additive only. Safe to re-run (CREATE ... IF NOT EXISTS / OR REPLACE,
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER).

-- ════════════════════════════════════════════════════════════════════════
-- A. trip_request_revisions
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.trip_request_revisions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_request_id        UUID NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  revision_number        INTEGER NOT NULL CHECK (revision_number >= 1),
  kind                   TEXT NOT NULL CHECK (kind IN ('original', 'amendment')),
  journey                JSONB NOT NULL,
  quote_snapshot         JSONB NOT NULL,
  quoted_total           NUMERIC(12,2) NOT NULL CHECK (quoted_total >= 0),
  payment_plan           JSONB,
  previous_total         NUMERIC(12,2),
  difference             NUMERIC(12,2),
  reason                 TEXT,
  status_at_revision     TEXT NOT NULL,
  availability_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_request_revisions_unique_number UNIQUE (trip_request_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_trip_request_revisions_request
  ON public.trip_request_revisions (trip_request_id, revision_number DESC);

COMMENT ON TABLE public.trip_request_revisions IS
  'Append-only quotation history of a journey. Written only by weemap_amend_trip_request().';

ALTER TABLE public.trip_request_revisions ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: server-only. service_role bypasses RLS and may read.
REVOKE ALL ON public.trip_request_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.trip_request_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.weemap_trip_request_revisions_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'revision_append_only' USING ERRCODE = 'check_violation';
  END IF;
  -- DELETE: only as the cascade of a deleted request, or a deliberate
  -- maintenance transaction.
  IF current_setting('weemap.payment_maintenance', true) = 'on' THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.trip_requests WHERE id = OLD.trip_request_id) THEN
    RAISE EXCEPTION 'revision_append_only' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END
$$;

REVOKE ALL ON FUNCTION public.weemap_trip_request_revisions_append_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS weemap_trip_request_revisions_no_update ON public.trip_request_revisions;
CREATE TRIGGER weemap_trip_request_revisions_no_update BEFORE UPDATE ON public.trip_request_revisions
  FOR EACH ROW EXECUTE FUNCTION public.weemap_trip_request_revisions_append_only();
DROP TRIGGER IF EXISTS weemap_trip_request_revisions_no_delete ON public.trip_request_revisions;
CREATE TRIGGER weemap_trip_request_revisions_no_delete BEFORE DELETE ON public.trip_request_revisions
  FOR EACH ROW EXECUTE FUNCTION public.weemap_trip_request_revisions_append_only();

-- ════════════════════════════════════════════════════════════════════════
-- B. weemap_amend_trip_request()
-- ════════════════════════════════════════════════════════════════════════
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

  converted := r.converted_booking_id IS NOT NULL;
  people := n_adults + n_children;

  -- Converted journeys: split the new quote exactly as conversion does,
  -- before anything is written.
  IF converted THEN
    IF n_acc IS NULL
       AND (n_transport = 'stay_only' OR COALESCE((snap ->> 'accommodation_subtotal')::numeric, 0) > 0) THEN
      RAISE EXCEPTION 'missing_accommodation' USING ERRCODE = 'check_violation';
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
    IF side_total < 0 THEN
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

NOTIFY pgrst, 'reload schema';
