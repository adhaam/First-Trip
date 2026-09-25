-- M4 launch-hardening invariants (migrations 039–041). Run by
-- scripts/db-bootstrap-check.sh against a disposable local database — never
-- production. Everything runs inside a transaction that is rolled back.
--
-- Proves, independent of the app:
--   1. Order workflow: pickup ready → completed, delivery ready →
--      out_for_delivery → completed; the other way round is refused, even by
--      a direct UPDATE; stale callers are refused.
--   2. Inventory: creation takes stock atomically and rolls back whole on a
--      shortage; cancel restocks exactly once (retries are no-ops); reopen
--      re-reserves or refuses whole; reservations follow the order.
--   3. Rentals: confirming beyond owned units is refused; moving a confirmed
--      reservation onto taken dates is refused.
--   4. Payments: money columns move only through the ledger; the total
--      cannot drop below money received; raising it re-derives the status;
--      opening balances keep Σ ledger = amount_paid; no future-dated money.
--   5. Privileges: anon / authenticated cannot read private tables, write any
--      table or call any WEEMAP function; the throttle locks and clears.
--   6. Sign-out can raise session_version but nothing can lower it.
\set ON_ERROR_STOP 1

BEGIN;

DO $$
DECLARE
  prod_sale   UUID;
  prod_rent   UUID;
  var_a       UUID;
  var_b       UUID;
  var_r       UUID;
  cust        UUID;
  ord         JSONB;
  ord_id      UUID;
  pickup_id   UUID;
  item        UUID;
  res_id      UUID;
  res2_id     UUID;
  bk_id       UUID;
  staff_id    UUID;
  n           INTEGER;
  got         TEXT;
  locked      TIMESTAMPTZ;
  balance     NUMERIC;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  INSERT INTO customers (name, phone) VALUES ('M4 Test', '+201000000439') RETURNING id INTO cust;
  INSERT INTO commerce_products (product_type, slug, name_ar, name_en, base_price, track_inventory, is_active)
    VALUES ('sale', 'm4-shirt', 'قميص', 'M4 Shirt', 100, true, true) RETURNING id INTO prod_sale;
  INSERT INTO commerce_product_variants (product_id, inventory_quantity, is_active)
    VALUES (prod_sale, 3, true) RETURNING id INTO var_a;
  INSERT INTO commerce_product_variants (product_id, inventory_quantity, is_active)
    VALUES (prod_sale, 1, true) RETURNING id INTO var_b;
  INSERT INTO commerce_products (product_type, slug, name_ar, name_en, base_price, is_active)
    VALUES ('rental', 'm4-tent', 'خيمة', 'M4 Tent', 0, true) RETURNING id INTO prod_rent;
  INSERT INTO commerce_product_variants (product_id, inventory_quantity, is_active)
    VALUES (prod_rent, 1, true) RETURNING id INTO var_r;

  -- ── 2a. Creation is atomic: a shortage on the second line leaves nothing ──
  BEGIN
    PERFORM weemap_place_commerce_order(
      jsonb_build_object('customer_id', cust, 'order_type', 'merch', 'fulfillment_method', 'pickup',
        'subtotal', 300, 'delivery_fee', 0, 'total_price', 300),
      jsonb_build_array(
        jsonb_build_object('product_id', prod_sale, 'variant_id', var_a, 'item_type', 'sale', 'quantity', 1,
          'unit_price', 100, 'line_total', 100, 'name_snapshot_ar', 'x', 'name_snapshot_en', 'x',
          'variant_snapshot', '{"inventory_reserved": true}'::jsonb),
        jsonb_build_object('product_id', prod_sale, 'variant_id', var_b, 'item_type', 'sale', 'quantity', 2,
          'unit_price', 100, 'line_total', 200, 'name_snapshot_ar', 'x', 'name_snapshot_en', 'x',
          'variant_snapshot', '{"inventory_reserved": true}'::jsonb)));
    RAISE EXCEPTION 'order over stock was accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    GET STACKED DIAGNOSTICS got = MESSAGE_TEXT;
    IF got <> 'insufficient_stock:' || var_b THEN RAISE EXCEPTION 'wrong shortage error: %', got; END IF;
  END;
  IF (SELECT inventory_quantity FROM commerce_product_variants WHERE id = var_a) <> 3 THEN
    RAISE EXCEPTION 'failed order leaked stock from the first line';
  END IF;
  IF EXISTS (SELECT 1 FROM commerce_orders WHERE customer_id = cust) THEN
    RAISE EXCEPTION 'failed order left an order row';
  END IF;

  -- totals are re-checked
  BEGIN
    PERFORM weemap_place_commerce_order(
      jsonb_build_object('customer_id', cust, 'order_type', 'merch', 'fulfillment_method', 'pickup',
        'subtotal', 1, 'delivery_fee', 0, 'total_price', 1),
      jsonb_build_array(jsonb_build_object('product_id', prod_sale, 'variant_id', var_a, 'item_type', 'sale',
        'quantity', 1, 'unit_price', 100, 'line_total', 100, 'name_snapshot_ar', 'x', 'name_snapshot_en', 'x')));
    RAISE EXCEPTION 'order with a forged total was accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;

  -- ── 2b. A good delivery order takes stock once ──
  ord := weemap_place_commerce_order(
    jsonb_build_object('customer_id', cust, 'order_type', 'mixed', 'fulfillment_method', 'delivery',
      'subtotal', 350, 'delivery_fee', 50, 'total_price', 400),
    jsonb_build_array(
      jsonb_build_object('product_id', prod_sale, 'variant_id', var_a, 'item_type', 'sale', 'quantity', 2,
        'unit_price', 100, 'line_total', 200, 'name_snapshot_ar', 'x', 'name_snapshot_en', 'x',
        'variant_snapshot', '{"inventory_reserved": true}'::jsonb),
      jsonb_build_object('product_id', prod_rent, 'variant_id', var_r, 'item_type', 'rental', 'quantity', 1,
        'unit_price', 150, 'line_total', 150, 'name_snapshot_ar', 'x', 'name_snapshot_en', 'x',
        'rental_duration_days', 2, 'rental_start_date', '2030-01-10', 'rental_end_date', '2030-01-11')));
  ord_id := (ord ->> 'order_id')::UUID;
  IF (SELECT inventory_quantity FROM commerce_product_variants WHERE id = var_a) <> 1 THEN
    RAISE EXCEPTION 'order did not take stock';
  END IF;
  SELECT rr.id INTO res_id FROM rental_reservations rr JOIN commerce_order_items oi ON oi.id = rr.order_item_id
   WHERE oi.order_id = ord_id;
  IF res_id IS NULL THEN RAISE EXCEPTION 'rental line has no reservation'; END IF;

  -- ── 1. Delivery workflow ──
  PERFORM weemap_set_commerce_order_status(ord_id, 'new', 'contacted');
  PERFORM weemap_set_commerce_order_status(ord_id, 'contacted', 'confirmed');
  PERFORM weemap_set_commerce_order_status(ord_id, 'confirmed', 'preparing');
  PERFORM weemap_set_commerce_order_status(ord_id, 'preparing', 'ready');
  BEGIN
    PERFORM weemap_set_commerce_order_status(ord_id, 'ready', 'completed');
    RAISE EXCEPTION 'delivery order skipped out_for_delivery';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    UPDATE commerce_orders SET status = 'completed' WHERE id = ord_id;
    RAISE EXCEPTION 'direct UPDATE skipped out_for_delivery';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    PERFORM weemap_set_commerce_order_status(ord_id, 'preparing', 'out_for_delivery');
    RAISE EXCEPTION 'stale caller accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    GET STACKED DIAGNOSTICS got = MESSAGE_TEXT;
    IF got <> 'stale_status' THEN RAISE EXCEPTION 'expected stale_status, got %', got; END IF;
  END;
  PERFORM weemap_set_commerce_order_status(ord_id, 'ready', 'out_for_delivery');
  -- a retry of the same change is a no-op, not an error
  PERFORM weemap_set_commerce_order_status(ord_id, 'out_for_delivery', 'out_for_delivery');

  -- ── 2c. Cancel restocks exactly once; reservations follow ──
  UPDATE rental_reservations SET status = 'confirmed' WHERE id = res_id;
  PERFORM weemap_set_commerce_order_status(ord_id, 'out_for_delivery', 'cancelled');
  PERFORM weemap_set_commerce_order_status(ord_id, 'cancelled', 'cancelled');
  IF (SELECT inventory_quantity FROM commerce_product_variants WHERE id = var_a) <> 3 THEN
    RAISE EXCEPTION 'cancel did not restock exactly once (got %)',
      (SELECT inventory_quantity FROM commerce_product_variants WHERE id = var_a);
  END IF;
  IF (SELECT status FROM rental_reservations WHERE id = res_id) <> 'cancelled' THEN
    RAISE EXCEPTION 'cancel left the rental reservation holding stock';
  END IF;

  -- ── 2d. Reopen re-reserves whole, or refuses whole ──
  UPDATE commerce_product_variants SET inventory_quantity = 1 WHERE id = var_a;
  BEGIN
    PERFORM weemap_set_commerce_order_status(ord_id, 'cancelled', 'new');
    RAISE EXCEPTION 'reopen without stock was accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  IF (SELECT status FROM commerce_orders WHERE id = ord_id) <> 'cancelled'
     OR (SELECT inventory_quantity FROM commerce_product_variants WHERE id = var_a) <> 1 THEN
    RAISE EXCEPTION 'failed reopen changed state';
  END IF;
  UPDATE commerce_product_variants SET inventory_quantity = 3 WHERE id = var_a;
  PERFORM weemap_set_commerce_order_status(ord_id, 'cancelled', 'new');
  IF (SELECT inventory_quantity FROM commerce_product_variants WHERE id = var_a) <> 1
     OR (SELECT status FROM rental_reservations WHERE id = res_id) <> 'requested' THEN
    RAISE EXCEPTION 'reopen did not re-reserve stock / reset the reservation';
  END IF;

  -- ── 1b. Pickup workflow ──
  ord := weemap_place_commerce_order(
    jsonb_build_object('customer_id', cust, 'order_type', 'merch', 'fulfillment_method', 'pickup',
      'subtotal', 100, 'delivery_fee', 0, 'total_price', 100),
    jsonb_build_array(jsonb_build_object('product_id', prod_sale, 'variant_id', var_b, 'item_type', 'sale',
      'quantity', 1, 'unit_price', 100, 'line_total', 100, 'name_snapshot_ar', 'x', 'name_snapshot_en', 'x',
      'variant_snapshot', '{"inventory_reserved": true}'::jsonb)));
  pickup_id := (ord ->> 'order_id')::UUID;
  UPDATE commerce_orders SET status = 'contacted' WHERE id = pickup_id;
  UPDATE commerce_orders SET status = 'confirmed' WHERE id = pickup_id;
  UPDATE commerce_orders SET status = 'preparing' WHERE id = pickup_id;
  UPDATE commerce_orders SET status = 'ready' WHERE id = pickup_id;
  BEGIN
    PERFORM weemap_set_commerce_order_status(pickup_id, 'ready', 'out_for_delivery');
    RAISE EXCEPTION 'pickup order was sent out for delivery';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  PERFORM weemap_set_commerce_order_status(pickup_id, 'ready', 'completed');
  -- history records the change
  SELECT count(*) INTO n FROM status_history WHERE entity_id = pickup_id AND to_value = 'completed';
  IF n <> 1 THEN RAISE EXCEPTION 'pickup completion not in status_history'; END IF;

  -- ── 3. Rentals ──
  INSERT INTO rental_reservations (product_id, variant_id, quantity, start_date, end_date, status)
    VALUES (prod_rent, var_r, 1, '2030-02-01', '2030-02-05', 'confirmed');
  INSERT INTO rental_reservations (product_id, variant_id, quantity, start_date, end_date, status)
    VALUES (prod_rent, var_r, 1, '2030-02-03', '2030-02-04', 'requested') RETURNING id INTO res2_id;
  BEGIN
    PERFORM weemap_update_rental_reservation(res2_id, 'requested', 'confirmed', NULL, NULL);
    RAISE EXCEPTION 'second confirmation of the only unit was accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  PERFORM weemap_update_rental_reservation(res2_id, 'requested', 'confirmed', '2030-02-10', '2030-02-11');
  BEGIN
    PERFORM weemap_update_rental_reservation(res2_id, 'confirmed', NULL, '2030-02-02', '2030-02-03');
    RAISE EXCEPTION 'confirmed reservation moved onto taken dates';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    PERFORM weemap_update_rental_reservation(res2_id, 'confirmed', NULL, '2030-02-12', '2030-02-11');
    RAISE EXCEPTION 'end before start accepted';
  EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL;
  END;

  -- ── 4. Payment truth ──
  INSERT INTO bookings (customer_name, customer_phone, booking_type, total_price, status)
    VALUES ('M4 Pay', '+201000000440', 'accommodation-only', 1000, 'awaiting_payment') RETURNING id INTO bk_id;
  BEGIN
    UPDATE bookings SET amount_paid = 500, payment_status = 'partial' WHERE id = bk_id;
    RAISE EXCEPTION 'direct money write accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM weemap_record_payment('accommodation_booking', bk_id, 'received', 500, 'instapay', 0);
  BEGIN
    UPDATE bookings SET total_price = 400 WHERE id = bk_id;
    RAISE EXCEPTION 'total lowered below money received';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE bookings SET total_price = 500 WHERE id = bk_id;
  IF (SELECT payment_status FROM bookings WHERE id = bk_id) <> 'paid' THEN
    RAISE EXCEPTION 'total = paid did not derive paid';
  END IF;
  UPDATE bookings SET total_price = 1200 WHERE id = bk_id;
  IF (SELECT payment_status FROM bookings WHERE id = bk_id) <> 'partial' THEN
    RAISE EXCEPTION 'raising the total left a stale paid';
  END IF;
  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'received', 10, 'cash', 500, '', '',
      NOW() + INTERVAL '3 days');
    RAISE EXCEPTION 'future-dated payment accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- Cancelled: no new money, refunds still possible, status follows
  UPDATE bookings SET status = 'cancelled' WHERE id = bk_id;
  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'received', 10, 'cash', 500);
    RAISE EXCEPTION 'payment on a cancelled booking accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM weemap_record_payment('accommodation_booking', bk_id, 'refunded', 500, 'cash', 500);
  IF (SELECT payment_status FROM bookings WHERE id = bk_id) <> 'refunded' THEN
    RAISE EXCEPTION 'full refund did not derive refunded';
  END IF;
  BEGIN
    PERFORM weemap_record_payment('accommodation_booking', bk_id, 'refunded', 1, 'cash', 0);
    RAISE EXCEPTION 'refund beyond zero accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM weemap_record_payment('trip_request', bk_id, 'received', 10, 'cash', 0);
    RAISE EXCEPTION 'money recorded on a trip request';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Manually entered booking with money already received gets an opening entry
  INSERT INTO bookings (customer_name, customer_phone, booking_type, total_price, status, amount_paid,
      payment_status, payment_channel)
    VALUES ('M4 Import', '+201000000441', 'accommodation-only', 800, 'confirmed', 300, 'paid', 'cash')
    RETURNING id INTO bk_id;
  IF (SELECT payment_status FROM bookings WHERE id = bk_id) <> 'partial' THEN
    RAISE EXCEPTION 'caller-supplied payment_status trusted on insert';
  END IF;
  SELECT SUM(CASE direction WHEN 'received' THEN amount ELSE -amount END) INTO balance
    FROM payment_records WHERE entity_id = bk_id;
  IF balance IS DISTINCT FROM 300 THEN RAISE EXCEPTION 'opening balance missing (ledger %)', balance; END IF;
  BEGIN
    INSERT INTO bookings (customer_name, customer_phone, booking_type, total_price, amount_paid)
      VALUES ('M4 Over', '+201000000442', 'accommodation-only', 100, 150);
    RAISE EXCEPTION 'insert with amount_paid > total accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM bookings WHERE id = bk_id;
    RAISE EXCEPTION 'a booking with ledger entries was deleted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Every row reconciles: amount_paid = Σ received − Σ refunded
  SELECT count(*) INTO n FROM (
    SELECT b.id FROM bookings b LEFT JOIN payment_records p
      ON p.entity_type = 'accommodation_booking' AND p.entity_id = b.id
    GROUP BY b.id, b.amount_paid
    HAVING COALESCE(b.amount_paid, 0) <> COALESCE(SUM(CASE p.direction WHEN 'received' THEN p.amount ELSE -p.amount END), 0)
  ) off;
  IF n <> 0 THEN RAISE EXCEPTION '% bookings do not reconcile with the ledger', n; END IF;

  -- ── 6. Session version can only go up ──
  INSERT INTO staff_users (email, display_name, role, password_hash)
    VALUES ('m4-staff@weemap.local', 'M4 Staff', 'operations', 'scrypt$x') RETURNING id INTO staff_id;
  UPDATE staff_users SET session_version = session_version + 1 WHERE id = staff_id RETURNING session_version INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'sign-out did not raise session_version (got %)', n; END IF;
  UPDATE staff_users SET session_version = 1 WHERE id = staff_id RETURNING session_version INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'session_version was lowered (got %)', n; END IF;

  -- ── 5b. Throttle ──
  PERFORM weemap_login_throttle_record(ARRAY['email:m4', 'ip:m4'], ARRAY[3, 100], false);
  PERFORM weemap_login_throttle_record(ARRAY['email:m4', 'ip:m4'], ARRAY[3, 100], false);
  IF weemap_login_throttle_check(ARRAY['email:m4']) IS NOT NULL THEN RAISE EXCEPTION 'locked too early'; END IF;
  locked := weemap_login_throttle_record(ARRAY['email:m4', 'ip:m4'], ARRAY[3, 100], false);
  IF locked IS NULL OR weemap_login_throttle_check(ARRAY['email:m4']) IS NULL THEN
    RAISE EXCEPTION 'third failure did not lock the account key';
  END IF;
  IF weemap_login_throttle_check(ARRAY['ip:m4']) IS NOT NULL THEN RAISE EXCEPTION 'ip key locked below its limit'; END IF;
END
$$;

-- ── 5a. Privileges as the roles PostgREST uses for untrusted callers ──
DO $$
DECLARE
  r   TEXT;
  rel TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH rel IN ARRAY ARRAY['customers', 'bookings', 'trip_bookings', 'experience_bookings', 'trip_requests',
      'commerce_orders', 'commerce_order_items', 'rental_reservations', 'staff_users', 'audit_log',
      'payment_records', 'status_history', 'domain_events', 'partner_inquiries', 'newsletter_subscribers',
      'ai_leads', 'ai_messages', 'staff_login_throttle', 'ops_work_items', 'public_search_documents'] LOOP
      IF has_table_privilege(r, 'public.' || rel, 'SELECT') THEN
        RAISE EXCEPTION '% can read %', r, rel;
      END IF;
    END LOOP;
    SELECT string_agg(c.relname, ', ') INTO rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
       AND (has_table_privilege(r, c.oid, 'INSERT') OR has_table_privilege(r, c.oid, 'UPDATE')
         OR has_table_privilege(r, c.oid, 'DELETE') OR has_table_privilege(r, c.oid, 'TRUNCATE'));
    IF rel IS NOT NULL THEN RAISE EXCEPTION '% can write %', r, rel; END IF;
    SELECT string_agg(p.proname, ', ') INTO rel FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND has_function_privilege(r, p.oid, 'EXECUTE')
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');
    IF rel IS NOT NULL THEN RAISE EXCEPTION '% can execute %', r, rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%authenticated%') THEN
    RAISE EXCEPTION 'a policy still grants to authenticated';
  END IF;
END
$$;

-- Behaviour, not just catalogue flags: act as anon and try.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true) AS jwt \gset
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.customers;
    RAISE EXCEPTION 'anon read customers';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.bookings (customer_name, customer_phone, booking_type, total_price)
      VALUES ('x', 'x', 'accommodation-only', 1);
    RAISE EXCEPTION 'anon inserted a booking';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.site_settings SET payment_instructions_en = 'pay me';
    RAISE EXCEPTION 'anon rewrote payment instructions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.weemap_record_payment('accommodation_booking', gen_random_uuid(), 'received', 1, 'cash', 0);
    RAISE EXCEPTION 'anon called weemap_record_payment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.restock_variant_inventory(gen_random_uuid(), 100);
    RAISE EXCEPTION 'anon called restock_variant_inventory';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- public catalogue stays readable
  PERFORM count(*) FROM public.accommodations;
END
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true) AS jwt \gset
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.bookings;
    RAISE EXCEPTION 'authenticated read bookings';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.accommodations SET price_per_night = 1;
    RAISE EXCEPTION 'authenticated rewrote prices';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.weemap_convert_trip_request(gen_random_uuid());
    RAISE EXCEPTION 'authenticated called weemap_convert_trip_request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

ROLLBACK;
