-- 049_journey_commercial_ownership.sql
-- The parent trip_request becomes the ONLY commercial payment owner for a
-- converted Build Your Trip journey; its bookings/trip_bookings children
-- become fulfilment-only (WEEMAP Journeys · M5).
--
-- WHY
--   weemap_convert_trip_request() (036) turns a confirmed trip_requests row
--   (WR-…) into one bookings child (BK-…) and N trip_bookings children
--   (TB-…), all trip_request_id-linked. Money has always lived on the
--   children: each was paid independently through weemap_record_payment()
--   (040), so a single journey could end up "50% paid" on the stay and
--   "unpaid" on two of its three trips with no single number a customer or
--   operator could point to as "what's owed on this journey".
--
--   From here on, a converted journey pays as ONE thing: 50% of the whole
--   quoted total after confirmation, 50% on arrival (payment_kind
--   'journey', payment_policies row below) — collected against the PARENT
--   trip_request, never against its children. The children keep every
--   fulfilment field (status, dates, rooms, itinerary) but their money
--   columns are frozen the moment the parent has received anything.
--
-- CONTRACT
--   * trip_requests gains agreed_total (NULL until the journey is priced as
--     one commercial unit — set at conversion, see below), amount_paid
--     (ledger-derived, defaults 0) and payment_status (same vocabulary as
--     bookings.payment_status: unpaid / partial / paid / refunded, NULL
--     until agreed_total is set).
--   * payment_records.entity_type gains 'trip_request'.
--   * payment_policies gains booking_kind 'journey': 50% after
--     confirmation, 50% on arrival — the same split a Dahab stay package
--     already uses, now applied to the journey's whole total.
--   * weemap_record_payment() (re-created from 040 verbatim, minimal diff):
--       - entity_type 'trip_request' → table trip_requests, total =
--         agreed_total, paid_states = awaiting_payment / confirmed /
--         completed (matching every other entity).
--       - agreed_total IS NULL → 'journey_not_commercial' (check_violation):
--         a request that was never converted, or converted before this
--         migration's backfill/manual review, cannot take a parent payment.
--       - 'accommodation_booking' / 'trip_booking' whose locked row has
--         trip_request_id IS NOT NULL → 'component_of_journey'
--         (check_violation) for BOTH received and refunded. Once a request
--         is part of a journey its own payment_records are permanently
--         closed; nothing redirects the call to the parent — the caller
--         must call weemap_record_payment('trip_request', …) itself.
--   * weemap_payment_truth_guard / weemap_payment_total / the opening
--     balance trigger now cover trip_requests exactly as they cover
--     bookings/trip_bookings/experience_bookings/commerce_orders: the
--     total is agreed_total, and amount_paid/payment_status can only move
--     inside weemap_record_payment() or a deliberate
--     weemap.payment_maintenance transaction. Because trip_requests carries
--     no payment_channel/payment_date, its opening-balance entry (used only
--     if a row is ever force-set with amount_paid > 0 outside the ledger)
--     is written with method 'other' and no channel/date fields — see the
--     TG_TABLE_NAME branch inside weemap_payment_opening_balance.
--   * weemap_convert_trip_request() (re-created from 036 verbatim, minimal
--     diff): the closing UPDATE additionally sets
--     agreed_total = quote_snapshot->>'total' WHERE agreed_total IS NULL,
--     and payment_status = 'unpaid' when amount_paid is still 0. Children
--     are created exactly as before — this migration does not touch that
--     part of the function body. The UPDATE runs under
--     weemap.payment_maintenance so it does not need to go through the
--     ledger (it is not a payment, it is switching the journey into
--     "priced as one commercial unit").
--   * Child price lock: a BEFORE UPDATE trigger on bookings.total_price and
--     trip_bookings.(final_price, quoted_price) refuses the change with
--     'journey_component_price_locked' when the row has trip_request_id
--     NOT NULL and its parent trip_requests.amount_paid > 0. The parent's
--     agreed_total is never touched automatically — correcting it after
--     money has moved is a deliberate operator decision, not something a
--     child edit should silently trigger.
--   * ops_work_items (CREATE OR REPLACE VIEW, same columns/order as 048,
--     two columns appended):
--       - journey_component BOOLEAN: true for bookings/trip_bookings rows
--         with trip_request_id NOT NULL, false everywhere else (including
--         the trip_request branch itself, which is the parent, not a
--         component).
--       - converted BOOLEAN: true on the trip_request branch when
--         converted_booking_id IS NOT NULL, false everywhere else.
--     On the trip_request branch: payment_kind is 'journey' once converted
--     (else NULL, as before); payment_status is COALESCE(tr.payment_status,
--     'converted') once converted (keeping the pre-049 'converted' marker
--     for a journey not yet backfilled/priced) and NULL when not converted;
--     amount_total is COALESCE(tr.agreed_total, tr.quoted_total); amount_paid
--     is tr.amount_paid.
--
-- SAFE ZERO-PAID BACKFILL (section B) and the exceptions it leaves alone
-- (section C) are below. Nothing in this migration UPDATEs or DELETEs
-- payment_records or any child money column — see section C.
--
-- Additive only. Safe to re-run (every write below is idempotent).

-- ════════════════════════════════════════════════════════════════════════
-- A. SCHEMA / MODEL
-- ════════════════════════════════════════════════════════════════════════

-- ─── A1. trip_requests: the journey's own commercial columns ───
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS agreed_total   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT;

ALTER TABLE public.trip_requests DROP CONSTRAINT IF EXISTS trip_requests_payment_status_check;
ALTER TABLE public.trip_requests ADD CONSTRAINT trip_requests_payment_status_check
  CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'partial', 'paid', 'refunded'));

COMMENT ON COLUMN public.trip_requests.agreed_total IS
  'The journey''s whole commercial total, once it is priced as one unit. NULL means the journey is not (yet) a single payable thing: its children, if any, still carry their own historical money (pre-049) or await manual review (see weemap_journey_backfill_class).';
COMMENT ON COLUMN public.trip_requests.amount_paid IS
  'Ledger-derived (weemap_record_payment only). Meaningless while agreed_total IS NULL.';
COMMENT ON COLUMN public.trip_requests.payment_status IS
  'Ledger-derived (weemap_record_payment only). NULL while agreed_total IS NULL.';

-- ─── A2. payment_records: a trip_request is a valid ledger entity ───
ALTER TABLE public.payment_records DROP CONSTRAINT IF EXISTS payment_records_entity_type_check;
ALTER TABLE public.payment_records ADD CONSTRAINT payment_records_entity_type_check
  CHECK (entity_type IN (
    'accommodation_booking', 'trip_booking', 'signature_request', 'commerce_order', 'trip_request'));

-- ─── A3. payment_policies: 'journey' — 50% after confirmation, 50% on arrival ───
ALTER TABLE public.payment_policies DROP CONSTRAINT IF EXISTS payment_policies_booking_kind_check;
ALTER TABLE public.payment_policies ADD CONSTRAINT payment_policies_booking_kind_check
  CHECK (booking_kind IN (
    'stay', 'stay_package', 'transfer', 'trip', 'experience_package',
    'signature', 'commerce', 'rental', 'journey'));

INSERT INTO public.payment_policies (booking_kind, upfront_percent, upfront_due, balance_due) VALUES
  ('journey', 50, 'after_confirmation', 'on_arrival')
ON CONFLICT (booking_kind) DO NOTHING;

-- ─── A4. weemap_payment_total: agreed_total is a trip_request's total ───
CREATE OR REPLACE FUNCTION public.weemap_payment_total(tbl TEXT, r JSONB)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE tbl
    WHEN 'trip_bookings'       THEN COALESCE((r ->> 'final_price')::NUMERIC, (r ->> 'quoted_price')::NUMERIC)
    WHEN 'experience_bookings' THEN (r ->> 'quoted_price')::NUMERIC
    WHEN 'trip_requests'       THEN (r ->> 'agreed_total')::NUMERIC
    ELSE (r ->> 'total_price')::NUMERIC
  END
$$;

-- ─── A5. Opening-balance trigger: extend to trip_requests ───
-- trip_requests carries no payment_channel / payment_date (unlike the other
-- four money-bearing tables), so it gets its own branch instead of reusing
-- those fields. In practice this branch is never hit by 049 itself — the
-- backfill in section B always leaves amount_paid = 0 — but it keeps the
-- guarantee "a row created with money already on it gets one ledger entry"
-- true for trip_requests too, the same as every other table 040 covers.
CREATE OR REPLACE FUNCTION public.weemap_payment_opening_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity TEXT;
BEGIN
  IF TG_TABLE_NAME = 'trip_requests' THEN
    IF COALESCE(NEW.amount_paid, 0) > 0 THEN
      INSERT INTO public.payment_records
        (entity_type, entity_id, direction, amount, method, note, received_at, recorded_by, amount_paid_after)
      VALUES
        ('trip_request', NEW.id, 'received', NEW.amount_paid, 'other',
         'Received before the journey was entered', NOW(),
         public.weemap_current_actor(), NEW.amount_paid);
    END IF;
    RETURN NULL;
  END IF;

  entity := CASE TG_TABLE_NAME
    WHEN 'bookings' THEN 'accommodation_booking'
    WHEN 'trip_bookings' THEN 'trip_booking'
    WHEN 'experience_bookings' THEN 'signature_request'
    ELSE 'commerce_order' END;

  IF COALESCE(NEW.amount_paid, 0) > 0 THEN
    INSERT INTO public.payment_records
      (entity_type, entity_id, direction, amount, method, note, received_at, recorded_by, amount_paid_after)
    VALUES
      (entity, NEW.id, 'received', NEW.amount_paid,
       CASE WHEN NEW.payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'card_link')
            THEN NEW.payment_channel ELSE 'other' END,
       'Received before the booking was entered', COALESCE(NEW.payment_date, NOW()),
       public.weemap_current_actor(), NEW.amount_paid);
  END IF;
  RETURN NULL;
END
$$;

-- ─── A6. Attach the truth guard + opening balance to trip_requests ───
DO $$
BEGIN
  DROP TRIGGER IF EXISTS weemap_payment_truth_guard ON public.trip_requests;
  CREATE TRIGGER weemap_payment_truth_guard BEFORE INSERT OR UPDATE ON public.trip_requests
    FOR EACH ROW EXECUTE FUNCTION public.weemap_payment_truth_guard();
  DROP TRIGGER IF EXISTS weemap_payment_opening_balance ON public.trip_requests;
  CREATE TRIGGER weemap_payment_opening_balance AFTER INSERT ON public.trip_requests
    FOR EACH ROW EXECUTE FUNCTION public.weemap_payment_opening_balance();
  -- A journey that holds money cannot be deleted (040's has_payments guard) — cancel it instead.
  DROP TRIGGER IF EXISTS weemap_keep_paid_rows ON public.trip_requests;
  CREATE TRIGGER weemap_keep_paid_rows BEFORE DELETE ON public.trip_requests
    FOR EACH ROW EXECUTE FUNCTION public.weemap_keep_paid_rows();
END
$$;

-- ─── A7. weemap_record_payment(): 'trip_request' entity + component_of_journey ───
CREATE OR REPLACE FUNCTION public.weemap_record_payment(
  p_entity_type          TEXT,
  p_entity_id            UUID,
  p_direction            TEXT,
  p_amount               NUMERIC,
  p_method               TEXT,
  p_expected_amount_paid NUMERIC,
  p_reference            TEXT DEFAULT '',
  p_note                 TEXT DEFAULT '',
  p_received_at          TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor            TEXT := public.weemap_current_actor();
  tbl              TEXT;
  total_expr       TEXT;
  paid_states      TEXT[];
  has_trip_request BOOLEAN;
  cur              RECORD;
  new_paid         NUMERIC;
  new_status       TEXT;
  record_id        UUID;
  received         TIMESTAMPTZ := COALESCE(p_received_at, NOW());
  actor_name       TEXT;
BEGIN
  CASE p_entity_type
    WHEN 'accommodation_booking' THEN
      tbl := 'bookings'; total_expr := 'total_price';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
      has_trip_request := true;
    WHEN 'trip_booking' THEN
      tbl := 'trip_bookings'; total_expr := 'COALESCE(final_price, quoted_price)';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
      has_trip_request := true;
    WHEN 'signature_request' THEN
      tbl := 'experience_bookings'; total_expr := 'quoted_price';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
      has_trip_request := false;
    WHEN 'commerce_order' THEN
      tbl := 'commerce_orders'; total_expr := 'total_price';
      paid_states := ARRAY['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'];
      has_trip_request := false;
    WHEN 'trip_request' THEN
      tbl := 'trip_requests'; total_expr := 'agreed_total';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
      has_trip_request := false;
    ELSE
      RAISE EXCEPTION 'invalid_entity_type' USING ERRCODE = 'invalid_parameter_value';
  END CASE;

  IF p_direction NOT IN ('received', 'refunded') THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- M4: money cannot be dated in the future (a typo would hide it from today's figures).
  IF received > NOW() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'invalid_received_at' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  EXECUTE format(
    'SELECT status, amount_paid, payment_status, %s AS total, %s AS trip_request_id FROM public.%I WHERE id = $1 FOR UPDATE',
    total_expr,
    CASE WHEN has_trip_request THEN 'trip_request_id' ELSE 'NULL::uuid' END,
    tbl)
  INTO cur USING p_entity_id;
  IF cur IS NULL OR cur.status IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
  END IF;

  -- 049: a request folded into a journey no longer takes its own payments —
  -- neither direction, so a refund can't be misfiled on the component either.
  IF has_trip_request AND cur.trip_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'component_of_journey' USING ERRCODE = 'check_violation';
  END IF;

  -- 049: the journey itself must be priced as one commercial unit first.
  IF p_entity_type = 'trip_request' AND cur.total IS NULL THEN
    RAISE EXCEPTION 'journey_not_commercial' USING ERRCODE = 'check_violation';
  END IF;

  IF p_expected_amount_paid IS DISTINCT FROM cur.amount_paid THEN
    -- PT409: PostgREST answers HTTP 409. (40001 would make it retry/hang.)
    RAISE EXCEPTION 'stale_payment_state' USING ERRCODE = 'PT409';
  END IF;

  IF p_direction = 'received' THEN
    IF NOT (cur.status = ANY (paid_states)) THEN
      RAISE EXCEPTION 'payment_before_confirmation' USING ERRCODE = 'check_violation';
    END IF;
    new_paid := cur.amount_paid + p_amount;
    IF cur.total IS NOT NULL AND new_paid > cur.total THEN
      RAISE EXCEPTION 'overpayment' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF p_amount > cur.amount_paid THEN
      RAISE EXCEPTION 'refund_exceeds_paid' USING ERRCODE = 'check_violation';
    END IF;
    new_paid := cur.amount_paid - p_amount;
  END IF;

  new_status := CASE
    WHEN new_paid = 0 AND p_direction = 'refunded' THEN 'refunded'
    WHEN new_paid = 0 THEN 'unpaid'
    WHEN cur.total IS NOT NULL AND new_paid >= cur.total THEN 'paid'
    ELSE 'partial'
  END;

  IF actor LIKE 'staff:%' THEN
    SELECT display_name INTO actor_name FROM public.staff_users WHERE id = substring(actor FROM 7)::uuid;
  ELSIF actor = 'legacy-admin' THEN
    actor_name := 'Shared admin (legacy)';
  END IF;

  -- M4 (040): the only writer allowed to change amount_paid / payment_status.
  PERFORM set_config('weemap.payment_ledger', 'on', true);
  IF p_entity_type = 'trip_request' THEN
    UPDATE public.trip_requests
       SET amount_paid = new_paid, payment_status = new_status
     WHERE id = p_entity_id;
  ELSE
    EXECUTE format(
      'UPDATE public.%I SET amount_paid = $1, payment_status = $2, payment_channel = $3, '
      'payment_date = $4, payment_received_by = COALESCE($5, payment_received_by) WHERE id = $6',
      tbl)
    USING new_paid, new_status, p_method, received, actor_name, p_entity_id;
  END IF;
  PERFORM set_config('weemap.payment_ledger', 'off', true);

  INSERT INTO public.payment_records
    (entity_type, entity_id, direction, amount, method, reference, note, received_at, recorded_by, amount_paid_after)
  VALUES
    (p_entity_type, p_entity_id, p_direction, p_amount, p_method,
     left(COALESCE(p_reference, ''), 200), left(COALESCE(p_note, ''), 1000), received, actor, new_paid)
  RETURNING id INTO record_id;

  INSERT INTO public.domain_events (event_type, aggregate_type, aggregate_id, payload)
  VALUES (
    CASE p_direction WHEN 'received' THEN 'payment_recorded' ELSE 'refund_recorded' END,
    p_entity_type, p_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'payment_record_id', record_id, 'amount', p_amount, 'method', p_method,
      'amount_paid', new_paid, 'payment_status', new_status, 'actor', actor)));

  RETURN jsonb_build_object(
    'payment_record_id', record_id, 'amount_paid', new_paid, 'payment_status', new_status);
END
$$;

REVOKE ALL ON FUNCTION public.weemap_record_payment(TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_record_payment(TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

-- ─── A8. weemap_journey_backfill_class(): the single predicate B, C and the ───
-- ─── audit/dry-run scripts all share, so they cannot diverge. ───
CREATE OR REPLACE FUNCTION public.weemap_journey_backfill_class(p_trip_request_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN tr.converted_booking_id IS NULL THEN 'NOT_CONVERTED'
    WHEN tr.agreed_total IS NOT NULL THEN 'ALREADY_COMMERCIAL'
    WHEN tr.quote_snapshot IS NULL
      OR jsonb_typeof(tr.quote_snapshot -> 'total') IS DISTINCT FROM 'number' THEN 'BLOCKED_MISSING_SNAPSHOT'
    WHEN EXISTS (
      SELECT 1 FROM public.bookings b
       WHERE b.trip_request_id = tr.id AND COALESCE(b.amount_paid, 0) > 0
      UNION ALL
      SELECT 1 FROM public.trip_bookings tb
       WHERE tb.trip_request_id = tr.id AND COALESCE(tb.amount_paid, 0) > 0
    ) THEN 'MANUAL_FINANCIAL_REVIEW'
    WHEN EXISTS (
      SELECT 1 FROM public.payment_records pr
        JOIN public.bookings b ON b.id = pr.entity_id AND pr.entity_type = 'accommodation_booking'
       WHERE b.trip_request_id = tr.id
      UNION ALL
      SELECT 1 FROM public.payment_records pr
        JOIN public.trip_bookings tb ON tb.id = pr.entity_id AND pr.entity_type = 'trip_booking'
       WHERE tb.trip_request_id = tr.id
    ) THEN 'MANUAL_FINANCIAL_REVIEW'
    ELSE 'SAFE_AUTO_BACKFILL'
  END
  FROM public.trip_requests tr
  WHERE tr.id = p_trip_request_id
$$;

REVOKE ALL ON FUNCTION public.weemap_journey_backfill_class(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_journey_backfill_class(UUID) TO service_role;

-- ─── A9. weemap_convert_trip_request(): price the journey as one commercial ───
-- ─── unit at conversion time. Children are created exactly as in 036 — the ───
-- ─── only change is the closing UPDATE. ───
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

-- ─── A10. Child price lock: a journey component's price freezes once the ───
-- ─── parent has received anything. The parent's agreed_total is never ───
-- ─── touched here — only a deliberate operator write changes it. ───
CREATE OR REPLACE FUNCTION public.weemap_journey_component_price_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_paid NUMERIC;
  new_price   NUMERIC;
  old_price   NUMERIC;
BEGIN
  IF NEW.trip_request_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'bookings' THEN
    new_price := NEW.total_price;
    old_price := OLD.total_price;
  ELSE
    new_price := COALESCE(NEW.final_price, NEW.quoted_price);
    old_price := COALESCE(OLD.final_price, OLD.quoted_price);
  END IF;

  IF new_price IS NOT DISTINCT FROM old_price THEN
    RETURN NEW;
  END IF;

  SELECT amount_paid INTO parent_paid FROM public.trip_requests WHERE id = NEW.trip_request_id;
  IF COALESCE(parent_paid, 0) > 0 THEN
    RAISE EXCEPTION 'journey_component_price_locked' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS weemap_journey_component_price_lock ON public.bookings;
CREATE TRIGGER weemap_journey_component_price_lock BEFORE UPDATE OF total_price ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.weemap_journey_component_price_lock();

DROP TRIGGER IF EXISTS weemap_journey_component_price_lock ON public.trip_bookings;
CREATE TRIGGER weemap_journey_component_price_lock BEFORE UPDATE OF final_price, quoted_price ON public.trip_bookings
  FOR EACH ROW EXECUTE FUNCTION public.weemap_journey_component_price_lock();

REVOKE ALL ON FUNCTION public.weemap_journey_component_price_lock() FROM PUBLIC, anon, authenticated;

-- ─── A11. ops_work_items: append journey_component + converted, same shape ───
-- ─── otherwise (048's five branches, unchanged column order). ───
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
LEFT JOIN public.editions ed ON ed.id = er.edition_id;

COMMENT ON VIEW public.ops_work_items IS
  'Operations Center queue: one normalised row per request/booking/order (read-only).';
REVOKE ALL ON public.ops_work_items FROM anon, authenticated;
GRANT SELECT ON public.ops_work_items TO service_role;

-- ════════════════════════════════════════════════════════════════════════
-- B. SAFE ZERO-PAID BACKFILL
-- ════════════════════════════════════════════════════════════════════════
-- Only rows weemap_journey_backfill_class() calls SAFE_AUTO_BACKFILL move:
-- converted, agreed_total still NULL, a numeric quote_snapshot->'total',
-- and neither the request nor any of its children has ever seen money
-- (no child amount_paid > 0, no payment_records for any child). Every
-- other converted request is left exactly as it is — see section C.
DO $$
DECLARE
  r                    RECORD;
  cls                  TEXT;
  n_backfilled         INT := 0;
  n_skip_snapshot      INT := 0;
  n_skip_paid          INT := 0;
BEGIN
  PERFORM set_config('weemap.payment_maintenance', 'on', true);

  FOR r IN
    SELECT id FROM public.trip_requests
     WHERE converted_booking_id IS NOT NULL AND agreed_total IS NULL
  LOOP
    cls := public.weemap_journey_backfill_class(r.id);
    IF cls = 'SAFE_AUTO_BACKFILL' THEN
      UPDATE public.trip_requests
         SET agreed_total = (quote_snapshot ->> 'total')::numeric,
             amount_paid = 0,
             payment_status = 'unpaid'
       WHERE id = r.id;
      n_backfilled := n_backfilled + 1;
    ELSIF cls = 'BLOCKED_MISSING_SNAPSHOT' THEN
      n_skip_snapshot := n_skip_snapshot + 1;
    ELSIF cls = 'MANUAL_FINANCIAL_REVIEW' THEN
      n_skip_paid := n_skip_paid + 1;
    END IF;
  END LOOP;

  PERFORM set_config('weemap.payment_maintenance', 'off', true);

  RAISE NOTICE 'journey backfill (049): % backfilled, % skipped_missing_snapshot, % skipped_paid_exceptions',
    n_backfilled, n_skip_snapshot, n_skip_paid;

  -- FAIL CLOSED: if this ever finds a row, weemap_journey_backfill_class()
  -- classified something SAFE_AUTO_BACKFILL that had child payment_records
  -- — the predicate leaked and must be fixed, not silently accepted.
  IF EXISTS (
    SELECT 1 FROM public.trip_requests tr
     WHERE tr.agreed_total IS NOT NULL
       AND (
         EXISTS (
           SELECT 1 FROM public.payment_records pr
             JOIN public.bookings b ON b.id = pr.entity_id AND pr.entity_type = 'accommodation_booking'
            WHERE b.trip_request_id = tr.id)
         OR EXISTS (
           SELECT 1 FROM public.payment_records pr
             JOIN public.trip_bookings tb ON tb.id = pr.entity_id AND pr.entity_type = 'trip_booking'
            WHERE tb.trip_request_id = tr.id)
       )
  ) THEN
    RAISE EXCEPTION 'journey_backfill_predicate_leak: a trip_request with agreed_total set has a child with payment_records'
      USING ERRCODE = 'check_violation';
  END IF;
END
$$;

-- ════════════════════════════════════════════════════════════════════════
-- C. EXCEPTIONS — no writes here.
-- ════════════════════════════════════════════════════════════════════════
-- Every converted trip_request that weemap_journey_backfill_class() called
-- BLOCKED_MISSING_SNAPSHOT or MANUAL_FINANCIAL_REVIEW keeps agreed_total
-- NULL. That is deliberate, not an oversight:
--   * agreed_total NULL means weemap_record_payment('trip_request', …)
--     refuses every call with 'journey_not_commercial' — the journey simply
--     cannot take a parent payment until a human prices it.
--   * Its children (if the entity_type is accommodation_booking / trip_
--     booking) are ALREADY blocked from taking their own payments too,
--     because they have trip_request_id NOT NULL — weemap_record_payment()
--     (section A7) refuses them with 'component_of_journey' regardless of
--     what agreed_total is. So a MANUAL_FINANCIAL_REVIEW journey is fully
--     frozen on both ends until an operator reconciles it by hand and sets
--     agreed_total (and, if warranted, records the journey's opening
--     balance) directly in SQL.
-- This migration never UPDATEs or DELETEs payment_records, and never
-- UPDATEs amount_paid / payment_status / total_price / final_price /
-- quoted_price on bookings or trip_bookings. Reconciling a
-- MANUAL_FINANCIAL_REVIEW journey is an operator decision, made after
-- reading scripts/audit/journey-commercial-ownership.audit.sql section (c).

NOTIFY pgrst, 'reload schema';
