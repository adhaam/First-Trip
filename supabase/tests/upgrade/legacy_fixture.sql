-- Legacy-shaped data at the production schema level (migration 028), loaded
-- by scripts/db-upgrade-check.sh BEFORE the release migrations run. It
-- mimics what M2-era production can hold: money typed straight into rows
-- (no ledger), a total below the money received, a pickup order sitting in
-- 'out_for_delivery', legacy statuses and payment channels. LOCAL ONLY.
\set ON_ERROR_STOP 1

INSERT INTO customers (id, name, phone) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Legacy Customer', '+201000000900');

INSERT INTO bookings (id, customer_id, customer_name, customer_phone, booking_type, total_price, status,
    amount_paid, payment_status, payment_channel, payment_date)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Legacy Customer',
   '+201000000900', 'accommodation-only', 1000, 'confirmed', 500, 'partial', 'instapay', '2026-08-01'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Legacy Customer',
   '+201000000900', 'package', 2000, 'pending', 0, 'unpaid', NULL, NULL),
  -- free-edit era inconsistency: more received than the (later lowered) total
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Legacy Customer',
   '+201000000900', 'transfer-only', 300, 'completed', 350, 'paid', 'cash', '2026-08-02');

INSERT INTO sinai_trips (id, name_ar, name_en, price, is_active)
VALUES ('f0000000-0000-4000-8000-000000000001', 'رحلة', 'Legacy Trip', 900, true);

INSERT INTO trip_bookings (id, trip_id, customer_name, customer_phone, num_people, quoted_price, status,
    amount_paid, payment_status, payment_channel)
VALUES
  ('c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Legacy Customer',
   '+201000000900', 2, 1800, 'confirmed', 1800, 'paid', 'vodafonecash');

INSERT INTO experience_bookings (id, full_name, phone, status, quoted_price, amount_paid, payment_status,
    payment_channel)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'Legacy Customer', '+201000000900', 'contacted', NULL, 100,
   'partial', 'other');

INSERT INTO commerce_orders (id, customer_id, order_type, fulfillment_method, status, subtotal, delivery_fee,
    total_price, amount_paid, payment_status)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'merch', 'pickup',
   'out_for_delivery', 400, 0, 400, 400, 'paid'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'merch', 'delivery',
   'ready', 250, 50, 300, 0, 'unpaid');
