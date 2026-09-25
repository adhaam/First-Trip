-- 036_operations_center.sql
-- Operations Center backbone: payment ledger, Trip Builder request → booking
-- conversion, a unified work-queue view and customer events (WEEMAP V2 · M3).
--
-- WHY
--   * Payments were a free-edit amount_paid / payment_status pair on each
--     request table: no record of what was received, how, when or by whom,
--     and two staff could overwrite each other.
--   * A Trip Builder request (migration 032) could only change status. It
--     never became the concrete bookings operations fulfil.
--   * Operators had one screen per table instead of one list of work.
--
-- CONTRACT
--   * payment_records is an append-only ledger (UPDATE/DELETE rejected).
--     A mistake is corrected with a 'refunded' entry, never by editing.
--     Write ONLY through weemap_record_payment(), which in one transaction:
--       - locks the request row,
--       - rejects a stale caller (p_expected_amount_paid must equal the
--         current amount_paid — optimistic concurrency),
--       - refuses money before availability is confirmed (bookings / trips /
--         Signature must be awaiting_payment, confirmed or completed; orders
--         confirmed or later) — refunds are always allowed,
--       - refuses over-payment beyond the agreed total and refunds beyond
--         what was received,
--       - derives payment_status from amount_paid vs the agreed total and
--         updates the row, so history (031) and events stay consistent.
--     payment_kind and payment_policies are never touched: the amount due
--     after confirmation / on arrival is derived from the stored kind by
--     src/lib/payment-rules.ts.
--   * weemap_convert_trip_request() turns a request whose availability is
--     confirmed (awaiting_payment / confirmed) into concrete rows:
--       - one bookings row for the stay/transport side (booking_type package,
--         accommodation-only or transfer-only → payment_kind derived by 030),
--       - one trip_bookings row per selected trip / Sinai package.
--     Prices come ONLY from the request's frozen quote_snapshot, never from
--     the current catalogue. The request row itself stays the untouched
--     record of what the customer asked for; bookings point back to it
--     (trip_request_id) and it points to its stay-side booking
--     (converted_booking_id). Idempotent: a converted request returns the
--     existing rows; unique indexes make a duplicate impossible even under
--     concurrent calls. Emits 'trip_request_converted'.
--   * trip_requests.internal_notes holds staff notes; notes stays the
--     customer's own words.
--   * ops_work_items is a read-only view that normalises every request type
--     into one row shape for the Operations Center queue.
--   * Customers emit customer_created / customer_updated / customer_merged
--     domain events (identifiers only, no contact data in the payload).
--
-- Additive only. Safe to re-run.

-- ─── 1. Staff notes + conversion provenance on trip requests ───
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS converted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_by   TEXT;

-- One stay-side booking per request; one trip booking per request experience.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_trip_request
  ON public.bookings (trip_request_id) WHERE trip_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_bookings_trip_request_item
  ON public.trip_bookings (trip_request_id, COALESCE(trip_id, trip_package_id))
  WHERE trip_request_id IS NOT NULL;

-- ─── 2. Payment ledger ───
CREATE TABLE IF NOT EXISTS public.payment_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN (
                 'accommodation_booking', 'trip_booking', 'signature_request', 'commerce_order')),
  entity_id    UUID NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('received', 'refunded')),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method       TEXT NOT NULL CHECK (method IN (
                 'instapay', 'vodafonecash', 'cash', 'bank_transfer', 'card_link', 'other')),
  reference    TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by  TEXT,
  amount_paid_after NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_records_entity
  ON public.payment_records (entity_type, entity_id, received_at);
CREATE INDEX IF NOT EXISTS idx_payment_records_received
  ON public.payment_records (received_at DESC);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_records_service_role_read" ON public.payment_records;
CREATE POLICY "payment_records_service_role_read" ON public.payment_records
  FOR SELECT USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.weemap_payment_records_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payment_records is append-only; record a refund instead'
    USING ERRCODE = 'check_violation';
END
$$;
DROP TRIGGER IF EXISTS weemap_payment_records_append_only ON public.payment_records;
CREATE TRIGGER weemap_payment_records_append_only BEFORE UPDATE OR DELETE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.weemap_payment_records_append_only();

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
  actor       TEXT := public.weemap_current_actor();
  tbl         TEXT;
  total_expr  TEXT;
  paid_states TEXT[];
  cur         RECORD;
  new_paid    NUMERIC;
  new_status  TEXT;
  record_id   UUID;
  received    TIMESTAMPTZ := COALESCE(p_received_at, NOW());
  actor_name  TEXT;
BEGIN
  CASE p_entity_type
    WHEN 'accommodation_booking' THEN
      tbl := 'bookings'; total_expr := 'total_price';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
    WHEN 'trip_booking' THEN
      tbl := 'trip_bookings'; total_expr := 'COALESCE(final_price, quoted_price)';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
    WHEN 'signature_request' THEN
      tbl := 'experience_bookings'; total_expr := 'quoted_price';
      paid_states := ARRAY['awaiting_payment', 'confirmed', 'completed'];
    WHEN 'commerce_order' THEN
      tbl := 'commerce_orders'; total_expr := 'total_price';
      paid_states := ARRAY['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'];
    ELSE
      RAISE EXCEPTION 'invalid_entity_type' USING ERRCODE = 'invalid_parameter_value';
  END CASE;

  IF p_direction NOT IN ('received', 'refunded') THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  EXECUTE format(
    'SELECT status, amount_paid, payment_status, %s AS total FROM public.%I WHERE id = $1 FOR UPDATE',
    total_expr, tbl)
  INTO cur USING p_entity_id;
  IF cur IS NULL OR cur.status IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_expected_amount_paid IS DISTINCT FROM cur.amount_paid THEN
    RAISE EXCEPTION 'stale_payment_state' USING ERRCODE = 'serialization_failure';
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

  EXECUTE format(
    'UPDATE public.%I SET amount_paid = $1, payment_status = $2, payment_channel = $3, '
    'payment_date = $4, payment_received_by = COALESCE($5, payment_received_by) WHERE id = $6',
    tbl)
  USING new_paid, new_status, p_method, received, actor_name, p_entity_id;

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

-- ─── 3. Trip Builder request → concrete bookings ───
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

  UPDATE public.trip_requests
     SET converted_booking_id = b_id, converted_at = NOW(), converted_by = actor
   WHERE id = r.id;

  INSERT INTO public.domain_events (event_type, aggregate_type, aggregate_id, payload)
  VALUES ('trip_request_converted', 'trip_request', r.id, jsonb_strip_nulls(jsonb_build_object(
    'reference', r.reference, 'customer_id', r.customer_id, 'booking_id', b_id,
    'trip_booking_ids', to_jsonb(tb_ids), 'actor', actor)));

  RETURN jsonb_build_object('already_converted', false, 'booking_id', b_id, 'trip_booking_ids', to_jsonb(tb_ids));
END
$$;

REVOKE ALL ON FUNCTION public.weemap_convert_trip_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_convert_trip_request(UUID) TO service_role;

-- ─── 4. Customer events (operational identity, no contact data in payload) ───
CREATE OR REPLACE FUNCTION public.weemap_customer_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor TEXT := public.weemap_current_actor();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
      VALUES ('customer_created', 'customer', NEW.id, jsonb_strip_nulls(jsonb_build_object('actor', actor)));
  ELSIF NEW.merged_into IS DISTINCT FROM OLD.merged_into AND NEW.merged_into IS NOT NULL THEN
    INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
      VALUES ('customer_merged', 'customer', NEW.id,
              jsonb_strip_nulls(jsonb_build_object('merged_into', NEW.merged_into, 'actor', actor)));
  ELSIF (NEW.name, NEW.phone, NEW.email, NEW.whatsapp_phone, NEW.preferred_language, NEW.notes)
        IS DISTINCT FROM (OLD.name, OLD.phone, OLD.email, OLD.whatsapp_phone, OLD.preferred_language, OLD.notes) THEN
    INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
      VALUES ('customer_updated', 'customer', NEW.id, jsonb_strip_nulls(jsonb_build_object('actor', actor)));
  END IF;
  RETURN NULL;
END
$$;
DROP TRIGGER IF EXISTS weemap_customer_events ON public.customers;
CREATE TRIGGER weemap_customer_events AFTER INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.weemap_customer_events();

-- ─── 5. Unified operations queue ───
CREATE OR REPLACE VIEW public.ops_work_items
WITH (security_invoker = true) AS
SELECT
  'accommodation_booking'::text AS entity_type, b.id AS entity_id,
  upper(left(b.id::text, 8)) AS reference, b.booking_type AS subtype, b.payment_kind,
  b.customer_id, b.customer_name, b.customer_phone,
  b.status, b.payment_status, b.total_price AS amount_total, b.amount_paid,
  b.trip_date AS start_date, b.return_date AS end_date, b.num_people AS people,
  COALESCE(a.name_en, '') AS title_en, COALESCE(a.name_ar, '') AS title_ar,
  b.transfer_type, b.source, b.trip_request_id, b.created_at, b.updated_at
FROM public.bookings b
LEFT JOIN public.accommodations a ON a.id = b.accommodation_id
UNION ALL
SELECT
  'trip_booking', tb.id, upper(left(tb.id::text, 8)),
  CASE WHEN tb.trip_package_id IS NOT NULL THEN 'package' ELSE 'trip' END, tb.payment_kind,
  tb.customer_id, tb.customer_name, tb.customer_phone,
  tb.status, tb.payment_status, COALESCE(tb.final_price, tb.quoted_price), tb.amount_paid,
  tb.preferred_date, NULL::date, tb.num_people,
  COALESCE(st.name_en, tp.name_en, ''), COALESCE(st.name_ar, tp.name_ar, ''),
  NULL, tb.source, tb.trip_request_id, tb.created_at, tb.updated_at
FROM public.trip_bookings tb
LEFT JOIN public.sinai_trips st ON st.id = tb.trip_id
LEFT JOIN public.trip_packages tp ON tp.id = tb.trip_package_id
UNION ALL
SELECT
  'signature_request', eb.id, upper(left(eb.id::text, 8)),
  CASE WHEN eb.is_custom_request THEN 'custom' ELSE 'experience' END, 'signature',
  eb.customer_id, eb.full_name, eb.phone,
  eb.status, eb.payment_status, eb.quoted_price, eb.amount_paid,
  COALESCE(ed.start_date, eb.preferred_date), ed.end_date, eb.spots_requested,
  COALESCE(e.title_en, ''), COALESCE(e.title_ar, ''),
  NULL, eb.source, NULL::uuid, eb.created_at, eb.updated_at
FROM public.experience_bookings eb
LEFT JOIN public.experiences e ON e.id = eb.experience_id
LEFT JOIN public.experience_dates ed ON ed.id = eb.experience_date_id
UNION ALL
SELECT
  'trip_request', tr.id, tr.reference, tr.transport_mode, NULL,
  tr.customer_id, tr.customer_name, tr.customer_phone,
  tr.status, CASE WHEN tr.converted_booking_id IS NOT NULL THEN 'converted' ELSE NULL END,
  tr.quoted_total, NULL::numeric,
  tr.arrival_date, tr.departure_date, tr.adults + tr.children,
  COALESCE(a.name_en, ''), COALESCE(a.name_ar, ''),
  NULLIF(tr.transport_mode, 'stay_only'), tr.source, tr.id, tr.submitted_at, tr.updated_at
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
  NULL::integer, '', '', NULL, co.source, NULL::uuid, co.created_at, co.updated_at
FROM public.commerce_orders co
LEFT JOIN public.customers c ON c.id = co.customer_id;

COMMENT ON VIEW public.ops_work_items IS
  'Operations Center queue: one normalised row per request/booking/order (read-only).';
REVOKE ALL ON public.ops_work_items FROM anon, authenticated;
GRANT SELECT ON public.ops_work_items TO service_role;
