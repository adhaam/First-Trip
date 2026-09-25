-- LOCAL ACCEPTANCE ONLY — operational fixtures for the M3 Operations Center.
-- Applied by scripts/local-stack/up.sh after local-seed.sql. Never run against
-- production. Dates are relative to "today" in Africa/Cairo so the Today view,
-- arrivals, departures, stale and exception lists always have something real.
--
-- Money goes through weemap_record_payment() exactly like the dashboard, so
-- the ledger, amount_paid and history agree. Fixed UUIDs keep it idempotent
-- (the whole stack is rebuilt by up.sh anyway).

DO $$
DECLARE
  today DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::date;
  c1 UUID := 'd1000000-0000-4000-8000-000000000001';
  c2 UUID := 'd1000000-0000-4000-8000-000000000002';
  c3 UUID := 'd1000000-0000-4000-8000-000000000003';
  acc UUID := 'a1000000-0000-4000-8000-000000000004';
  trip UUID := 'b1000000-0000-4000-8000-000000000001';
  pkg UUID := 'c2000000-0000-4000-8000-000000000002';
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE id = c1) THEN RETURN; END IF;

  INSERT INTO customers (id, name, phone, normalized_phone, email, preferred_language) VALUES
    (c1, 'Mona Adel',     '01001110001', normalize_phone_eg('01001110001'), 'mona@example.test', 'ar'),
    (c2, 'Daniel Weber',  '+491701110002', normalize_phone_eg('+491701110002'), 'daniel@example.test', 'en'),
    (c3, 'Youssef Hassan','01221110003', normalize_phone_eg('01221110003'), NULL, 'ar');

  -- Stay arriving today, confirmed, deposit paid (50/50 stay).
  INSERT INTO bookings (id, customer_id, customer_name, customer_phone, booking_type, accommodation_id,
                        trip_date, return_date, nights, room_type, num_people, status, total_price, source)
  VALUES ('7c41a2d0-5b3e-4f1a-9c20-000000000001', c1, 'Mona Adel', '01001110001', 'accommodation-only', acc,
          today, today + 3, 3, 'double', 2, 'awaiting_payment', 4800, 'whatsapp');
  PERFORM weemap_record_payment('accommodation_booking', '7c41a2d0-5b3e-4f1a-9c20-000000000001',
                                'received', 2400, 'instapay', 0, 'IP-LOCAL-1', 'Deposit');
  UPDATE bookings SET status = 'confirmed' WHERE id = '7c41a2d0-5b3e-4f1a-9c20-000000000001';

  -- Bus + stay leaving today (departure list), fully paid.
  INSERT INTO bookings (id, customer_id, customer_name, customer_phone, booking_type, accommodation_id,
                        governorate, trip_date, return_date, duration, nights, transfer_type, transfer_direction,
                        room_type, num_people, status, total_price, source)
  VALUES ('3f9e8b17-2c6d-4e0b-8a31-000000000002', c2, 'Daniel Weber', '+491701110002', 'package', acc,
          'cairo', today - 4, today, 5, 4, 'package_bus', 'round_trip', 'double', 2, 'awaiting_payment', 9000,
          'website');
  PERFORM weemap_record_payment('accommodation_booking', '3f9e8b17-2c6d-4e0b-8a31-000000000002',
                                'received', 4500, 'vodafonecash', 0, 'VC-LOCAL-2', '');
  PERFORM weemap_record_payment('accommodation_booking', '3f9e8b17-2c6d-4e0b-8a31-000000000002',
                                'received', 4500, 'cash', 4500, '', 'Balance on arrival');
  UPDATE bookings SET status = 'confirmed' WHERE id = '3f9e8b17-2c6d-4e0b-8a31-000000000002';

  -- Hiace transfer tomorrow, availability confirmed, nothing paid yet → exception.
  INSERT INTO bookings (id, customer_id, customer_name, customer_phone, booking_type, governorate, trip_date,
                        transfer_type, transfer_direction, num_people, status, total_price, source)
  VALUES ('a86d0c4e-91f2-4b7c-b5e3-000000000003', c3, 'Youssef Hassan', '01221110003', 'transfer-only', 'cairo',
          today + 1, 'hiace', 'to_dahab', 4, 'awaiting_payment', 3200, 'instagram');

  -- A new stay request nobody has touched for three days → stale.
  INSERT INTO bookings (id, customer_id, customer_name, customer_phone, booking_type, accommodation_id,
                        trip_date, return_date, nights, room_type, num_people, status, total_price, source)
  VALUES ('d02b5f93-47ae-4c18-9f6d-000000000004', c3, 'Youssef Hassan', '01221110003', 'accommodation-only', acc,
          today + 10, today + 13, 3, 'double', 2, 'new', 4800, 'website');

  -- Sinai trip today, confirmed and paid (100%).
  INSERT INTO trip_bookings (id, customer_id, trip_id, customer_name, customer_phone, preferred_date, num_people,
                             context, quoted_price, final_price, status, source)
  VALUES ('5e7a3c19-0d84-4a6f-8b12-000000000005', c1, trip, 'Mona Adel', '01001110001', today, 2,
          'standalone', 1800, 1800, 'awaiting_payment', 'whatsapp');
  PERFORM weemap_record_payment('trip_booking', '5e7a3c19-0d84-4a6f-8b12-000000000005',
                                'received', 1800, 'instapay', 0, 'IP-LOCAL-3', '');
  UPDATE trip_bookings SET status = 'confirmed' WHERE id = '5e7a3c19-0d84-4a6f-8b12-000000000005';

  -- Sinai package checking availability.
  INSERT INTO trip_bookings (id, customer_id, trip_package_id, customer_name, customer_phone, preferred_date,
                             num_people, context, quoted_price, final_price, status, source)
  VALUES ('92c4e6b8-3a1f-4d57-a0c9-000000000006', c2, pkg, 'Daniel Weber', '+491701110002', today + 5, 2,
          'package', 5200, 5200, 'checking_availability', 'website');

  -- Cancelled trip that still holds money → refund due.
  INSERT INTO trip_bookings (id, customer_id, trip_id, customer_name, customer_phone, preferred_date, num_people,
                             context, quoted_price, final_price, status, source)
  VALUES ('1b8d7f25-6e9c-4302-bd47-000000000007', c3, trip, 'Youssef Hassan', '01221110003', today + 2, 1,
          'standalone', 900, 900, 'awaiting_payment', 'whatsapp');
  PERFORM weemap_record_payment('trip_booking', '1b8d7f25-6e9c-4302-bd47-000000000007',
                                'received', 900, 'cash', 0, '', '');
  UPDATE trip_bookings SET status = 'cancelled' WHERE id = '1b8d7f25-6e9c-4302-bd47-000000000007';

  -- Make the untouched request genuinely old.
  UPDATE status_history SET changed_at = NOW() - INTERVAL '3 days'
   WHERE entity_id = 'd02b5f93-47ae-4c18-9f6d-000000000004';
  UPDATE bookings SET created_at = NOW() - INTERVAL '3 days'
   WHERE id = 'd02b5f93-47ae-4c18-9f6d-000000000004';
END $$;
