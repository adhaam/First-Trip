-- 2026-09-27_wr-2609-0001_reconcile.dry-run.sql
-- READ-ONLY preview of the reconcile. Safe on production before or after 049.
-- Shows every precondition the reconcile will assert and the exact rows it
-- would write. Nothing here writes.

-- 1. Preconditions, one boolean each (all must be true after 049 is applied).
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'trip_requests' AND column_name = 'agreed_total') AS p1_049_applied,
  (SELECT reference = 'WR-2609-0001' AND customer_name = 'Test Reservation'
          AND converted_booking_id = '03bd02ac-46bf-4574-9e43-28769354eb13'
          AND (quote_snapshot ->> 'total')::numeric = 16300
     FROM public.trip_requests WHERE id = 'd4efee63-7701-47eb-8ca9-78ce7aa47c52') AS p2_journey_identity,
  (SELECT amount_paid = 5000 AND payment_status = 'partial' AND total_price = 11800
     FROM public.bookings WHERE id = '03bd02ac-46bf-4574-9e43-28769354eb13') AS p3_component_paid_5000,
  (SELECT count(*) = 3 AND bool_and(amount_paid = 0) FROM public.trip_bookings
    WHERE trip_request_id = 'd4efee63-7701-47eb-8ca9-78ce7aa47c52') AS p4_three_unpaid_trips,
  (SELECT count(*) = 1 FROM public.payment_records
    WHERE entity_id IN ('d4efee63-7701-47eb-8ca9-78ce7aa47c52', '03bd02ac-46bf-4574-9e43-28769354eb13',
                        '1b98b879-f9fe-49d3-a142-a0f00c768fa6', '9efb8d5f-ed09-410a-b58d-89690476c242',
                        'ea945fc7-b60f-44d9-b6a0-7cd4f027cde4')) AS p5_only_original_ledger_entry,
  NOT EXISTS (SELECT 1 FROM public.customers WHERE id <> '7c5c23c2-f032-44b4-95b4-42eec12314a9'
               AND (phone = '01111111111' OR normalized_phone = '+201111111111')) AS p6_phone_free;

-- 2. The two ledger entries the reconcile would append.
SELECT 'would_insert' AS action, x.*
FROM public.payment_records o
CROSS JOIN LATERAL (VALUES
  ('accommodation_booking', o.entity_id, 'refunded', o.amount, o.method, 'transfer:' || o.id::text,
   0::numeric, 'internal transfer out of component'),
  ('trip_request', 'd4efee63-7701-47eb-8ca9-78ce7aa47c52'::uuid, 'received', o.amount, o.method,
   'transfer:' || o.id::text, 5000::numeric, 'internal transfer in to journey, received_at = original')
) AS x(entity_type, entity_id, direction, amount, method, reference, amount_paid_after, meaning)
WHERE o.id = '1443e829-4185-403d-94ea-1e203dba19b1';

-- 3. Field changes the reconcile would make.
SELECT 'trip_requests' AS tbl, id::text, 'agreed_total/amount_paid/payment_status/customer_phone' AS fields,
       'NULL/0/NULL/' || customer_phone AS before, '16300/5000/partial/01111111111' AS after
  FROM public.trip_requests WHERE id = 'd4efee63-7701-47eb-8ca9-78ce7aa47c52'
UNION ALL
SELECT 'bookings', id::text, 'amount_paid/payment_status/customer_phone',
       amount_paid || '/' || payment_status || '/' || customer_phone, '0/unpaid/01111111111'
  FROM public.bookings WHERE id = '03bd02ac-46bf-4574-9e43-28769354eb13'
UNION ALL
SELECT 'trip_bookings', id::text, 'customer_phone', customer_phone, '01111111111'
  FROM public.trip_bookings WHERE trip_request_id = 'd4efee63-7701-47eb-8ca9-78ce7aa47c52'
UNION ALL
SELECT 'customers', id::text, 'phone/raw_phone/normalized_phone',
       phone || '/' || COALESCE(raw_phone, '') || '/' || COALESCE(normalized_phone, ''),
       '01111111111/01111111111/+201111111111'
  FROM public.customers WHERE id = '7c5c23c2-f032-44b4-95b4-42eec12314a9';

-- 4. Standalone rows are out of scope: count them so the read-back can prove "unchanged".
SELECT (SELECT count(*) FROM public.bookings WHERE trip_request_id IS NULL) AS standalone_bookings,
       (SELECT count(*) FROM public.trip_bookings WHERE trip_request_id IS NULL) AS standalone_trip_bookings,
       (SELECT md5(string_agg(id::text || amount_paid || payment_status || COALESCE(total_price, 0), ',' ORDER BY id))
          FROM public.bookings WHERE trip_request_id IS NULL) AS standalone_bookings_fingerprint,
       (SELECT md5(string_agg(id::text || amount_paid || payment_status
                              || COALESCE(final_price, quoted_price, 0), ',' ORDER BY id))
          FROM public.trip_bookings WHERE trip_request_id IS NULL) AS standalone_trip_bookings_fingerprint,
       (SELECT count(*) FROM public.payment_records) AS ledger_entries;
