-- payment_kind invariants (migration 030). Run by scripts/db-bootstrap-check.sh
-- against a disposable local database — never production.
--
-- Proves the database is authoritative on its own, independent of the app:
--   1. INSERT derives payment_kind from the booking / product classification
--      and ignores any value the caller supplies.
--   2. A normal UPDATE cannot change a stored payment_kind.
--   3. Only an explicit maintenance transaction can correct one.
\set ON_ERROR_STOP 1

DO $$
DECLARE
  acc_id   UUID;
  pkg_id   UUID;
  trip_id  UUID;
  tb_trip  UUID;
  tb_pkg   UUID;
  bk_stay  UUID;
  got      TEXT;
BEGIN
  INSERT INTO accommodations (name_ar, name_en, type) VALUES ('t', 't', 'hotel') RETURNING id INTO acc_id;
  INSERT INTO trip_packages (slug, name_ar, name_en) VALUES ('pk-invariants-' || gen_random_uuid(), 'p', 'p') RETURNING id INTO pkg_id;
  INSERT INTO sinai_trips (name_ar, name_en, price) VALUES ('Blue Hole', 'Blue Hole', 10) RETURNING id INTO trip_id;

  -- 1a. Standalone trip, caller claims 'stay' → 'trip'.
  INSERT INTO trip_bookings (trip_id, context, customer_name, customer_phone, payment_kind)
    VALUES (trip_id, 'standalone', 'A', '0100', 'stay_package') RETURNING id, payment_kind INTO tb_trip, got;
  IF got IS DISTINCT FROM 'trip' THEN
    RAISE EXCEPTION 'standalone trip stored % instead of trip', got;
  END IF;

  -- 'stay' is not even a valid trip_bookings kind; the derived value must
  -- replace it before the CHECK constraint runs, not after.
  INSERT INTO trip_bookings (trip_id, context, customer_name, customer_phone, payment_kind)
    VALUES (trip_id, 'standalone', 'A', '0100', 'stay') RETURNING payment_kind INTO got;
  IF got IS DISTINCT FROM 'trip' THEN
    RAISE EXCEPTION 'standalone trip with supplied stay stored % instead of trip', got;
  END IF;

  -- 1b. Experience package, caller claims 'stay_package' → 'experience_package'.
  INSERT INTO trip_bookings (trip_package_id, context, customer_name, customer_phone, payment_kind)
    VALUES (pkg_id, 'package', 'A', '0100', 'stay_package') RETURNING id, payment_kind INTO tb_pkg, got;
  IF got IS DISTINCT FROM 'experience_package' THEN
    RAISE EXCEPTION 'experience package stored % instead of experience_package', got;
  END IF;

  -- 1c. Dahab stay package, caller claims 'experience_package' → 'stay_package'.
  --     ('experience_package' is not a valid bookings kind either.)
  INSERT INTO bookings (customer_name, customer_phone, booking_type, accommodation_id, num_people, total_price, payment_kind)
    VALUES ('A', '0100', 'package', acc_id, 2, 100, 'experience_package') RETURNING id, payment_kind INTO bk_stay, got;
  IF got IS DISTINCT FROM 'stay_package' THEN
    RAISE EXCEPTION 'Dahab stay package stored % instead of stay_package', got;
  END IF;

  -- 2. A normal later UPDATE cannot change the stored kind.
  BEGIN
    UPDATE bookings SET payment_kind = 'stay' WHERE id = bk_stay;
    RAISE EXCEPTION 'UPDATE of bookings.payment_kind was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE trip_bookings SET payment_kind = 'trip' WHERE id = tb_pkg;
    RAISE EXCEPTION 'UPDATE of trip_bookings.payment_kind was allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT payment_kind INTO got FROM bookings WHERE id = bk_stay;
  IF got IS DISTINCT FROM 'stay_package' THEN RAISE EXCEPTION 'bookings kind changed to %', got; END IF;
  SELECT payment_kind INTO got FROM trip_bookings WHERE id = tb_pkg;
  IF got IS DISTINCT FROM 'experience_package' THEN RAISE EXCEPTION 'trip_bookings kind changed to %', got; END IF;

  -- Other updates to the same rows still work (status, notes, prices…).
  UPDATE bookings SET status = 'checking_availability', notes = 'ok' WHERE id = bk_stay;
  UPDATE trip_bookings SET status = 'confirmed' WHERE id = tb_trip;
  SELECT payment_kind INTO got FROM bookings WHERE id = bk_stay;
  IF got IS DISTINCT FROM 'stay_package' THEN RAISE EXCEPTION 'status update altered kind to %', got; END IF;

  -- Changing the booking's classification later does not rewrite history.
  UPDATE bookings SET booking_type = 'accommodation-only' WHERE id = bk_stay;
  SELECT payment_kind INTO got FROM bookings WHERE id = bk_stay;
  IF got IS DISTINCT FROM 'stay_package' THEN RAISE EXCEPTION 'reclassification altered kind to %', got; END IF;

  -- 3. The explicit maintenance mechanism is the only way to correct a kind.
  PERFORM set_config('weemap.payment_kind_maintenance', 'on', true);
  UPDATE bookings SET payment_kind = 'stay' WHERE id = bk_stay;
  PERFORM set_config('weemap.payment_kind_maintenance', 'off', true);
  SELECT payment_kind INTO got FROM bookings WHERE id = bk_stay;
  IF got IS DISTINCT FROM 'stay' THEN RAISE EXCEPTION 'maintenance correction did not apply (%)', got; END IF;

  RAISE NOTICE 'payment_kind invariants: PASS';
END
$$;
