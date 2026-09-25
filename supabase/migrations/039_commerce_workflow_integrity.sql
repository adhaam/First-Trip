-- 039_commerce_workflow_integrity.sql
-- Shop / Rent order workflow and inventory made transactional (WEEMAP M4).
--
-- WHY
--   * Pickup orders were forced through 'out_for_delivery'. Founder decision
--     (M4): delivery is ready → out_for_delivery → completed, pickup is
--     ready → completed. A pickup order is never out for delivery.
--   * Order creation, cancellation (restock) and reopening (re-reserve) were
--     sequences of separate PostgREST calls with application-level
--     compensation. A crash or timeout between calls could lose or duplicate
--     stock. The Operations Center status endpoint also changed an order's
--     status with a plain UPDATE, so cancelling there never restocked.
--   * check_rental_availability_locked() takes a transaction-scoped advisory
--     lock, but it was called as its own RPC and the reservation was updated
--     in a later request, so the lock was already gone: two operators
--     confirming the last unit at once could both succeed. A date change on
--     an already-confirmed reservation was not checked at all.
--
-- CONTRACT
--   * weemap_commerce_order_guard (BEFORE UPDATE trigger) enforces the order
--     status graph, with the pickup/delivery split, whoever writes the row:
--       new → contacted | cancelled
--       contacted → confirmed | cancelled
--       confirmed → preparing | cancelled
--       preparing → ready | cancelled
--       ready → out_for_delivery (delivery only) | completed (pickup only) | cancelled
--       out_for_delivery → completed | cancelled
--       completed → confirmed (staff correction)
--       cancelled → new (reopen)
--     and that a pickup order is never 'out_for_delivery'. It must match
--     TRANSITIONS / COMMERCE_PICKUP_TRANSITIONS in src/lib/request-workflow.ts.
--     A deliberate maintenance transaction can bypass it with
--     set_config('weemap.workflow_maintenance', 'on', true).
--   * weemap_place_commerce_order(order, items) writes an already-priced
--     order in ONE transaction: sale stock decrements, the order, its items
--     and rental reservations. Any failure (not enough stock, rental dates
--     unavailable, a bad total) rolls everything back. Prices are computed by
--     the server (src/lib/order-core.ts) from catalogue rows; this function
--     re-checks that the totals add up.
--   * weemap_set_commerce_order_status(id, expected, next) changes status in
--     ONE transaction: row lock, stale check, transition check, and on
--     cancel restocks exactly the lines that reserved stock (marking them
--     restocked) and cancels open rental reservations; on reopen it
--     re-reserves those lines (all or nothing) and returns reservations to
--     'requested'. Retries are no-ops: the status compare and the per-line
--     restocked marker make a double restock impossible.
--   * weemap_update_rental_reservation(id, expected, status, start, end) moves
--     a reservation, holding the product's advisory lock until commit, and
--     re-checks availability whenever the result reserves stock (confirmed /
--     active / late) and either the status or the dates changed.
--   * Errors use SQLSTATE PT409 (HTTP 409) with a machine-readable message:
--     stale_status, invalid_transition, insufficient_stock:<variant_id>,
--     rental_unavailable:<product_id>, totals_mismatch; PT404 not_found.
--   * All four functions are service-role only.
--
-- Additive only. Safe to re-run.

-- ─── 1. Status graph guard ───
CREATE OR REPLACE FUNCTION public.weemap_commerce_order_next(p_from TEXT, p_method TEXT)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_from
    WHEN 'new'              THEN ARRAY['contacted', 'cancelled']
    WHEN 'contacted'        THEN ARRAY['confirmed', 'cancelled']
    WHEN 'confirmed'        THEN ARRAY['preparing', 'cancelled']
    WHEN 'preparing'        THEN ARRAY['ready', 'cancelled']
    WHEN 'ready'            THEN CASE WHEN p_method = 'pickup'
                                   THEN ARRAY['completed', 'cancelled']
                                   ELSE ARRAY['out_for_delivery', 'cancelled'] END
    WHEN 'out_for_delivery' THEN ARRAY['completed', 'cancelled']
    WHEN 'completed'        THEN ARRAY['confirmed']
    WHEN 'cancelled'        THEN ARRAY['new']
    ELSE ARRAY[]::TEXT[]
  END
$$;

CREATE OR REPLACE FUNCTION public.weemap_commerce_order_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('weemap.workflow_maintenance', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (NEW.status = ANY (public.weemap_commerce_order_next(OLD.status, NEW.fulfillment_method))) THEN
    RAISE EXCEPTION 'invalid_transition'
      USING ERRCODE = 'PT409',
            DETAIL = format('%s → %s (%s)', OLD.status, NEW.status, NEW.fulfillment_method);
  END IF;
  -- Checked only when status or method changes, so a legacy pickup row that
  -- is already out_for_delivery can still take notes and be completed.
  IF NEW.status = 'out_for_delivery' AND NEW.fulfillment_method = 'pickup'
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.fulfillment_method IS DISTINCT FROM OLD.fulfillment_method) THEN
    RAISE EXCEPTION 'invalid_transition'
      USING ERRCODE = 'PT409', DETAIL = 'a pickup order is never out for delivery';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS weemap_commerce_order_guard ON public.commerce_orders;
CREATE TRIGGER weemap_commerce_order_guard BEFORE UPDATE ON public.commerce_orders
  FOR EACH ROW EXECUTE FUNCTION public.weemap_commerce_order_guard();

-- ─── 2. Helpers ───
-- Units a rental product/variant owns — mirrors getTotalInventory() in
-- src/lib/rental-availability.ts.
CREATE OR REPLACE FUNCTION public.weemap_rental_total_inventory(p_product_id UUID, p_variant_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_variant_id IS NOT NULL
    THEN (SELECT COALESCE(inventory_quantity, 0) FROM public.commerce_product_variants WHERE id = p_variant_id)
    ELSE (SELECT COALESCE(SUM(inventory_quantity), 0) FROM public.commerce_product_variants WHERE product_id = p_product_id)
  END::INTEGER
$$;

-- Same overlap rule as check_rental_availability_locked (015). The caller
-- must already hold the product's advisory lock in this transaction.
CREATE OR REPLACE FUNCTION public.weemap_rental_units_free(
  p_product_id UUID, p_variant_id UUID, p_start DATE, p_end DATE, p_exclude UUID
)
RETURNS INTEGER
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.weemap_rental_total_inventory(p_product_id, p_variant_id), 0)
    - (SELECT COALESCE(SUM(quantity), 0) FROM public.rental_reservations
        WHERE product_id = p_product_id
          AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
          AND status IN ('confirmed', 'active', 'late')
          AND (p_exclude IS NULL OR id <> p_exclude)
          AND start_date <= p_end AND end_date >= p_start)::INTEGER
    - (SELECT COALESCE(SUM(quantity), 0) FROM public.rental_availability_blocks
        WHERE product_id = p_product_id
          AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
          AND start_date <= p_end AND end_date >= p_start)::INTEGER
$$;

CREATE OR REPLACE FUNCTION public.weemap_rental_lock(p_product_id UUID, p_variant_id UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  -- Same key as check_rental_availability_locked, so both serialise together.
  SELECT pg_advisory_xact_lock(hashtextextended(p_product_id::text || '|' || COALESCE(p_variant_id::text, ''), 0))
$$;

-- Sale lines of an order that took stock at creation. New orders record it in
-- variant_snapshot.inventory_reserved; older lines fall back to the rule
-- creation used (a sale line with a variant on a product tracking inventory).
CREATE OR REPLACE FUNCTION public.weemap_order_stock_lines(p_order_id UUID)
RETURNS TABLE (item_id UUID, variant_id UUID, quantity INTEGER, restocked BOOLEAN)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT oi.id, oi.variant_id, oi.quantity,
         (oi.variant_snapshot ? 'inventory_restocked_at')
  FROM public.commerce_order_items oi
  LEFT JOIN public.commerce_products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id
    AND oi.item_type = 'sale'
    AND oi.variant_id IS NOT NULL
    AND CASE jsonb_typeof(oi.variant_snapshot -> 'inventory_reserved')
          WHEN 'boolean' THEN (oi.variant_snapshot ->> 'inventory_reserved')::BOOLEAN
          ELSE COALESCE(p.track_inventory, false)
        END
  ORDER BY oi.variant_id, oi.id  -- stable lock order across concurrent callers
$$;

-- ─── 3. Atomic order creation ───
CREATE OR REPLACE FUNCTION public.weemap_place_commerce_order(p_order JSONB, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  item        JSONB;
  v_order_id  UUID;
  v_order_no  TEXT;
  v_item_id   UUID;
  line_sum    NUMERIC := 0;
  qty         INTEGER;
  variant     UUID;
  product     UUID;
  r_start     DATE;
  r_end       DATE;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no_items' USING ERRCODE = 'PT400';
  END IF;

  -- Stock first, in a stable order, so two orders never deadlock.
  FOR item IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY value ->> 'variant_id' NULLS LAST
  LOOP
    qty := (item ->> 'quantity')::INTEGER;
    IF qty IS NULL OR qty < 1 THEN
      RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = 'PT400';
    END IF;
    line_sum := line_sum + (item ->> 'line_total')::NUMERIC;
    IF (item ->> 'item_type') = 'sale' AND COALESCE((item -> 'variant_snapshot' ->> 'inventory_reserved')::BOOLEAN, false) THEN
      variant := (item ->> 'variant_id')::UUID;
      UPDATE public.commerce_product_variants
         SET inventory_quantity = inventory_quantity - qty
       WHERE id = variant AND inventory_quantity >= qty;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_stock:%', variant USING ERRCODE = 'PT409';
      END IF;
    ELSIF (item ->> 'item_type') = 'rental' THEN
      product := (item ->> 'product_id')::UUID;
      variant := NULLIF(item ->> 'variant_id', '')::UUID;
      r_start := (item ->> 'rental_start_date')::DATE;
      r_end   := (item ->> 'rental_end_date')::DATE;
      IF r_start IS NULL OR r_end IS NULL OR r_end < r_start THEN
        RAISE EXCEPTION 'invalid_rental_dates' USING ERRCODE = 'PT400';
      END IF;
      PERFORM public.weemap_rental_lock(product, variant);
      IF public.weemap_rental_units_free(product, variant, r_start, r_end, NULL) < qty THEN
        RAISE EXCEPTION 'rental_unavailable:%', product USING ERRCODE = 'PT409';
      END IF;
    END IF;
  END LOOP;

  IF round(line_sum, 2) <> round((p_order ->> 'subtotal')::NUMERIC, 2)
     OR round((p_order ->> 'subtotal')::NUMERIC + (p_order ->> 'delivery_fee')::NUMERIC, 2)
        <> round((p_order ->> 'total_price')::NUMERIC, 2) THEN
    RAISE EXCEPTION 'totals_mismatch' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.commerce_orders (
    customer_id, order_type, fulfillment_method, delivery_zone_id, delivery_address,
    subtotal, delivery_fee, total_price, notes, internal_notes, source, status)
  VALUES (
    (p_order ->> 'customer_id')::UUID,
    p_order ->> 'order_type',
    p_order ->> 'fulfillment_method',
    NULLIF(p_order ->> 'delivery_zone_id', '')::UUID,
    COALESCE(p_order ->> 'delivery_address', ''),
    (p_order ->> 'subtotal')::NUMERIC,
    (p_order ->> 'delivery_fee')::NUMERIC,
    (p_order ->> 'total_price')::NUMERIC,
    COALESCE(p_order ->> 'notes', ''),
    COALESCE(p_order ->> 'internal_notes', ''),
    COALESCE(p_order ->> 'source', 'website'),
    'new')
  RETURNING id, order_number INTO v_order_id, v_order_no;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.commerce_order_items (
      order_id, product_id, variant_id, item_type, name_snapshot_ar, name_snapshot_en,
      variant_snapshot, unit_price, quantity, rental_duration_days, rental_start_date,
      rental_end_date, line_total)
    VALUES (
      v_order_id,
      (item ->> 'product_id')::UUID,
      NULLIF(item ->> 'variant_id', '')::UUID,
      item ->> 'item_type',
      item ->> 'name_snapshot_ar',
      item ->> 'name_snapshot_en',
      COALESCE(item -> 'variant_snapshot', '{}'::JSONB),
      (item ->> 'unit_price')::NUMERIC,
      (item ->> 'quantity')::INTEGER,
      NULLIF(item ->> 'rental_duration_days', '')::INTEGER,
      NULLIF(item ->> 'rental_start_date', '')::DATE,
      NULLIF(item ->> 'rental_end_date', '')::DATE,
      (item ->> 'line_total')::NUMERIC)
    RETURNING id INTO v_item_id;

    IF (item ->> 'item_type') = 'rental' THEN
      INSERT INTO public.rental_reservations (
        order_item_id, product_id, variant_id, quantity, start_date, end_date, status)
      VALUES (
        v_item_id,
        (item ->> 'product_id')::UUID,
        NULLIF(item ->> 'variant_id', '')::UUID,
        (item ->> 'quantity')::INTEGER,
        (item ->> 'rental_start_date')::DATE,
        (item ->> 'rental_end_date')::DATE,
        'requested');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_no);
END
$$;

-- ─── 4. Atomic status change with inventory side effects ───
CREATE OR REPLACE FUNCTION public.weemap_set_commerce_order_status(
  p_order_id UUID, p_expected_status TEXT, p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cur  public.commerce_orders%ROWTYPE;
  line RECORD;
  res  public.commerce_orders%ROWTYPE;
BEGIN
  SELECT * INTO cur FROM public.commerce_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF p_expected_status IS NOT NULL AND cur.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'stale_status' USING ERRCODE = 'PT409', DETAIL = cur.status;
  END IF;
  IF cur.status = p_status THEN
    RETURN to_jsonb(cur);  -- retry of an applied change: nothing to do
  END IF;
  IF NOT (p_status = ANY (public.weemap_commerce_order_next(cur.status, cur.fulfillment_method))) THEN
    RAISE EXCEPTION 'invalid_transition'
      USING ERRCODE = 'PT409', DETAIL = format('%s → %s (%s)', cur.status, p_status, cur.fulfillment_method);
  END IF;

  UPDATE public.commerce_orders SET status = p_status WHERE id = p_order_id RETURNING * INTO res;

  IF p_status = 'cancelled' THEN
    FOR line IN SELECT * FROM public.weemap_order_stock_lines(p_order_id) WHERE NOT restocked LOOP
      UPDATE public.commerce_product_variants
         SET inventory_quantity = inventory_quantity + line.quantity
       WHERE id = line.variant_id;
      UPDATE public.commerce_order_items
         SET variant_snapshot = variant_snapshot || jsonb_build_object('inventory_restocked_at', NOW())
       WHERE id = line.item_id;
    END LOOP;
    UPDATE public.rental_reservations rr SET status = 'cancelled'
      FROM public.commerce_order_items oi
     WHERE oi.id = rr.order_item_id AND oi.order_id = p_order_id
       AND rr.status IN ('requested', 'contacted', 'confirmed', 'active', 'late');
  ELSIF cur.status = 'cancelled' THEN
    FOR line IN SELECT * FROM public.weemap_order_stock_lines(p_order_id) WHERE restocked LOOP
      UPDATE public.commerce_product_variants
         SET inventory_quantity = inventory_quantity - line.quantity
       WHERE id = line.variant_id AND inventory_quantity >= line.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_stock:%', line.variant_id USING ERRCODE = 'PT409';
      END IF;
      UPDATE public.commerce_order_items
         SET variant_snapshot = variant_snapshot - 'inventory_restocked_at'
       WHERE id = line.item_id;
    END LOOP;
    -- Back to non-reserving; staff re-confirm through the rentals screen,
    -- which re-checks availability.
    UPDATE public.rental_reservations rr SET status = 'requested'
      FROM public.commerce_order_items oi
     WHERE oi.id = rr.order_item_id AND oi.order_id = p_order_id AND rr.status = 'cancelled';
  END IF;

  RETURN to_jsonb(res);
END
$$;

-- ─── 5. Atomic rental reservation change ───
CREATE OR REPLACE FUNCTION public.weemap_update_rental_reservation(
  p_id UUID, p_expected_status TEXT, p_status TEXT, p_start_date DATE, p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cur        public.rental_reservations%ROWTYPE;
  res        public.rental_reservations%ROWTYPE;
  next_state TEXT;
  next_start DATE;
  next_end   DATE;
  reserving  CONSTANT TEXT[] := ARRAY['confirmed', 'active', 'late'];
BEGIN
  SELECT * INTO cur FROM public.rental_reservations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF p_expected_status IS NOT NULL AND cur.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'stale_status' USING ERRCODE = 'PT409', DETAIL = cur.status;
  END IF;

  next_state := COALESCE(p_status, cur.status);
  next_start := COALESCE(p_start_date, cur.start_date);
  next_end   := COALESCE(p_end_date, cur.end_date);
  IF next_end < next_start THEN
    RAISE EXCEPTION 'invalid_rental_dates' USING ERRCODE = 'PT400';
  END IF;

  IF next_state = ANY (reserving)
     AND (NOT (cur.status = ANY (reserving)) OR next_start <> cur.start_date OR next_end <> cur.end_date) THEN
    PERFORM public.weemap_rental_lock(cur.product_id, cur.variant_id);
    IF public.weemap_rental_units_free(cur.product_id, cur.variant_id, next_start, next_end, cur.id) < cur.quantity THEN
      RAISE EXCEPTION 'rental_unavailable:%', cur.product_id USING ERRCODE = 'PT409';
    END IF;
  END IF;

  UPDATE public.rental_reservations
     SET status = next_state, start_date = next_start, end_date = next_end
   WHERE id = p_id
  RETURNING * INTO res;
  RETURN to_jsonb(res);
END
$$;

-- ─── 6. Privileges: server (service role) only ───
REVOKE ALL ON FUNCTION public.weemap_commerce_order_next(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_commerce_order_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_rental_total_inventory(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_rental_units_free(UUID, UUID, DATE, DATE, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_rental_lock(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_order_stock_lines(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_place_commerce_order(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_set_commerce_order_status(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.weemap_update_rental_reservation(UUID, TEXT, TEXT, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weemap_commerce_order_next(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_rental_total_inventory(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_rental_units_free(UUID, UUID, DATE, DATE, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_rental_lock(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_order_stock_lines(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_place_commerce_order(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_set_commerce_order_status(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.weemap_update_rental_reservation(UUID, TEXT, TEXT, DATE, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
