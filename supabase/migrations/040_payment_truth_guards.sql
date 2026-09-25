-- 040_payment_truth_guards.sql
-- Money on request rows can only move through the payment ledger (WEEMAP M4).
--
-- WHY
--   036 made payment_records the append-only ledger and weemap_record_payment()
--   its only writer, but the money columns on the request rows themselves
--   (amount_paid, payment_status) could still be written directly by any
--   service-role UPDATE, and three holes remained:
--     * editing the agreed total below what was already received left a row
--       "paid" with more money than it costs, and raising it left a stale
--       "paid";
--     * a manually imported booking could carry amount_paid with no ledger
--       entry, and rows paid before the ledger existed have none either, so
--       Σ ledger ≠ amount_paid and the books could not be reconciled;
--     * a payment could be dated in the future.
--
-- CONTRACT
--   * weemap_payment_truth_guard (BEFORE INSERT OR UPDATE on bookings,
--     trip_bookings, experience_bookings, commerce_orders):
--       - UPDATE: amount_paid / payment_status change only inside
--         weemap_record_payment() (it sets weemap.payment_ledger = on for its
--         own write). Anything else is refused with 'payment_via_ledger'.
--       - UPDATE of the agreed total: refused below amount_paid
--         ('total_below_paid' — record a refund first); otherwise
--         payment_status is re-derived (paid ↔ partial) in the same write.
--       - INSERT: amount_paid above the total is refused; payment_status is
--         derived from amount_paid, never trusted from the caller.
--     Totals: bookings.total_price, trip_bookings COALESCE(final_price,
--     quoted_price), experience_bookings.quoted_price,
--     commerce_orders.total_price — the same expressions 036 uses.
--   * weemap_payment_opening_balance (AFTER INSERT): a row created with money
--     already received gets one 'received' ledger entry for it, so
--     amount_paid = Σ received − Σ refunded holds for every row.
--   * One-off backfill: rows whose amount_paid exceeds their ledger balance
--     (paid before 036) get one 'opening balance' entry for the difference,
--     recorded_by 'migration:040'. Re-running inserts nothing new.
--   * weemap_record_payment() is re-created unchanged except: it sets the
--     ledger flag around its own UPDATE, and refuses received_at more than a
--     day in the future.
--   * weemap_keep_paid_rows (BEFORE DELETE): a row with ledger entries cannot
--     be deleted ('has_payments') — cancel it instead.
--   * A deliberate maintenance transaction may bypass the guards with
--     set_config('weemap.payment_maintenance', 'on', true).
--
-- Additive only. Safe to re-run.

-- ─── 1. Guard ───
CREATE OR REPLACE FUNCTION public.weemap_payment_total(tbl TEXT, r JSONB)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE tbl
    WHEN 'trip_bookings'       THEN COALESCE((r ->> 'final_price')::NUMERIC, (r ->> 'quoted_price')::NUMERIC)
    WHEN 'experience_bookings' THEN (r ->> 'quoted_price')::NUMERIC
    ELSE (r ->> 'total_price')::NUMERIC
  END
$$;

CREATE OR REPLACE FUNCTION public.weemap_payment_truth_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  new_total NUMERIC := public.weemap_payment_total(TG_TABLE_NAME, to_jsonb(NEW));
  old_total NUMERIC;
  paid      NUMERIC := COALESCE(NEW.amount_paid, 0);
BEGIN
  IF current_setting('weemap.payment_maintenance', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF paid < 0 OR (new_total IS NOT NULL AND paid > new_total) THEN
      RAISE EXCEPTION 'amount_paid_exceeds_total' USING ERRCODE = 'check_violation';
    END IF;
    NEW.amount_paid := paid;
    NEW.payment_status := CASE
      WHEN paid = 0 THEN 'unpaid'
      WHEN new_total IS NOT NULL AND paid >= new_total THEN 'paid'
      ELSE 'partial'
    END;
    RETURN NEW;
  END IF;

  IF (NEW.amount_paid IS DISTINCT FROM OLD.amount_paid OR NEW.payment_status IS DISTINCT FROM OLD.payment_status)
     AND current_setting('weemap.payment_ledger', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'payment_via_ledger' USING ERRCODE = 'check_violation';
  END IF;

  old_total := public.weemap_payment_total(TG_TABLE_NAME, to_jsonb(OLD));
  IF new_total IS DISTINCT FROM old_total AND current_setting('weemap.payment_ledger', true) IS DISTINCT FROM 'on' THEN
    IF new_total IS NOT NULL AND paid > new_total THEN
      RAISE EXCEPTION 'total_below_paid' USING ERRCODE = 'check_violation';
    END IF;
    IF paid > 0 THEN
      NEW.payment_status := CASE WHEN new_total IS NOT NULL AND paid >= new_total THEN 'paid' ELSE 'partial' END;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- ─── 2. Opening balance for rows created with money already received ───
CREATE OR REPLACE FUNCTION public.weemap_payment_opening_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity TEXT := CASE TG_TABLE_NAME
    WHEN 'bookings' THEN 'accommodation_booking'
    WHEN 'trip_bookings' THEN 'trip_booking'
    WHEN 'experience_bookings' THEN 'signature_request'
    ELSE 'commerce_order' END;
BEGIN
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

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'trip_bookings', 'experience_bookings', 'commerce_orders'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS weemap_payment_truth_guard ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER weemap_payment_truth_guard BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.weemap_payment_truth_guard()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS weemap_payment_opening_balance ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER weemap_payment_opening_balance AFTER INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.weemap_payment_opening_balance()', t);
  END LOOP;
END
$$;

-- ─── 3. One-off backfill: money received before the ledger existed ───
DO $$
DECLARE
  spec TEXT[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['bookings', 'accommodation_booking'],
    ARRAY['trip_bookings', 'trip_booking'],
    ARRAY['experience_bookings', 'signature_request'],
    ARRAY['commerce_orders', 'commerce_order']
  ] LOOP
    EXECUTE format($f$
      INSERT INTO public.payment_records
        (entity_type, entity_id, direction, amount, method, note, received_at, recorded_by, amount_paid_after)
      SELECT %L, t.id, 'received', t.amount_paid - COALESCE(l.balance, 0),
             CASE WHEN t.payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'card_link')
                  THEN t.payment_channel ELSE 'other' END,
             'Opening balance: received before the payment ledger (migration 040)',
             COALESCE(t.payment_date, t.updated_at, t.created_at), 'migration:040', t.amount_paid
      FROM public.%I t
      LEFT JOIN (
        SELECT entity_id,
               SUM(CASE direction WHEN 'received' THEN amount ELSE -amount END) AS balance
        FROM public.payment_records WHERE entity_type = %L GROUP BY entity_id
      ) l ON l.entity_id = t.id
      WHERE COALESCE(t.amount_paid, 0) > COALESCE(l.balance, 0)
    $f$, spec[2], spec[1], spec[2]);
  END LOOP;
END
$$;

-- ─── 4. weemap_record_payment(): sets the ledger flag; no future-dated money ───
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
  -- M4: money cannot be dated in the future (a typo would hide it from today's figures).
  IF received > NOW() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'invalid_received_at' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  EXECUTE format(
    'SELECT status, amount_paid, payment_status, %s AS total FROM public.%I WHERE id = $1 FOR UPDATE',
    total_expr, tbl)
  INTO cur USING p_entity_id;
  IF cur IS NULL OR cur.status IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'no_data_found';
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
  EXECUTE format(
    'UPDATE public.%I SET amount_paid = $1, payment_status = $2, payment_channel = $3, '
    'payment_date = $4, payment_received_by = COALESCE($5, payment_received_by) WHERE id = $6',
    tbl)
  USING new_paid, new_status, p_method, received, actor_name, p_entity_id;
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

-- ─── 5. A row with ledger entries cannot be deleted (cancel it instead) ───
-- Deleting it would orphan its payment_records and lose the reason money
-- was received or refunded.
CREATE OR REPLACE FUNCTION public.weemap_keep_paid_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('weemap.payment_maintenance', true) = 'on' THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_records WHERE entity_id = OLD.id) THEN
    RAISE EXCEPTION 'has_payments' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'trip_bookings', 'experience_bookings', 'commerce_orders'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS weemap_keep_paid_rows ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER weemap_keep_paid_rows BEFORE DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.weemap_keep_paid_rows()', t);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.weemap_keep_paid_rows() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_payment_total(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_payment_truth_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_payment_opening_balance() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
