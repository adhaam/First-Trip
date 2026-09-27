-- journey-commercial-ownership.audit.sql
-- Read-only production audit to run BEFORE 049_journey_commercial_ownership.sql.
--
-- Must not reference any column or function 049 adds (agreed_total,
-- trip_requests.amount_paid/payment_status, weemap_journey_backfill_class,
-- payment_records.entity_type = 'trip_request', payment_policies 'journey').
-- Every classification below is written out inline against pre-049 columns
-- only, but MIRRORS the predicate weemap_journey_backfill_class() will use
-- in 049 — see section (f).
--
-- BEGIN READ ONLY; only SELECTs; ROLLBACK at the end. Safe to run repeatedly
-- against production.

BEGIN READ ONLY;

-- ─── (a) Lineage for customer_phone '01111111111' ───
-- WR / BK / TB rows for that phone, plus payment_records for the children.
SELECT
  'a1_trip_request' AS section,
  'WR-' || tr.reference AS display_ref, tr.id, tr.id AS trip_request_id, NULL::text AS context,
  tr.status, NULL::text AS payment_status, NULL::text AS payment_kind,
  tr.quoted_total AS total, NULL::numeric AS amount_paid,
  tr.quoted_total, tr.quote_snapshot -> 'total' AS snapshot_total,
  tr.payment_plan
FROM public.trip_requests tr
WHERE tr.customer_phone = '01111111111';

SELECT
  'a2_booking' AS section,
  'BK-' || upper(left(b.id::text, 8)) AS display_ref, b.id, b.trip_request_id, b.booking_type AS context,
  b.status, b.payment_status, b.payment_kind,
  b.total_price AS total, b.amount_paid,
  NULL::numeric AS quoted_total, NULL::jsonb AS snapshot_total,
  NULL::jsonb AS payment_plan
FROM public.bookings b
WHERE b.customer_phone = '01111111111';

SELECT
  'a3_trip_booking' AS section,
  'TB-' || upper(left(tb.id::text, 8)) AS display_ref, tb.id, tb.trip_request_id, tb.context,
  tb.status, tb.payment_status, tb.payment_kind,
  COALESCE(tb.final_price, tb.quoted_price) AS total, tb.amount_paid,
  tb.quoted_price AS quoted_total, NULL::jsonb AS snapshot_total,
  NULL::jsonb AS payment_plan
FROM public.trip_bookings tb
WHERE tb.customer_phone = '01111111111';

SELECT
  'a4_payment_records' AS section,
  pr.entity_type || ':' || pr.entity_id AS display_ref, pr.id, NULL::uuid AS trip_request_id,
  pr.direction AS context,
  NULL::text AS status, NULL::text AS payment_status, NULL::text AS payment_kind,
  pr.amount AS total, pr.amount_paid_after AS amount_paid,
  NULL::numeric AS quoted_total, NULL::jsonb AS snapshot_total,
  NULL::jsonb AS payment_plan
FROM public.payment_records pr
WHERE (pr.entity_type = 'accommodation_booking' AND pr.entity_id IN
        (SELECT id FROM public.bookings WHERE customer_phone = '01111111111'))
   OR (pr.entity_type = 'trip_booking' AND pr.entity_id IN
        (SELECT id FROM public.trip_bookings WHERE customer_phone = '01111111111'))
ORDER BY 1;

-- ─── (b) Counts ───
-- b1: converted BYT requests
SELECT 'b1_converted_requests' AS section, count(*) AS n
FROM public.trip_requests WHERE converted_booking_id IS NOT NULL;

-- b2: converted requests with any child amount_paid > 0
SELECT 'b2_children_with_amount_paid' AS section, count(*) AS n
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_request_id = tr.id AND COALESCE(b.amount_paid, 0) > 0)
    OR EXISTS (SELECT 1 FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id AND COALESCE(tb.amount_paid, 0) > 0)
  );

-- b3: converted requests with any child payment_records
SELECT 'b3_children_with_payment_records' AS section, count(*) AS n
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.payment_records pr JOIN public.bookings b
              ON b.id = pr.entity_id AND pr.entity_type = 'accommodation_booking'
            WHERE b.trip_request_id = tr.id)
    OR EXISTS (SELECT 1 FROM public.payment_records pr JOIN public.trip_bookings tb
              ON tb.id = pr.entity_id AND pr.entity_type = 'trip_booking'
            WHERE tb.trip_request_id = tr.id)
  );

-- b4: converted requests where child-total sum != quote_snapshot total (numeric compare)
SELECT 'b4_child_total_mismatch' AS section, count(*) AS n
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NOT NULL
  AND tr.quote_snapshot IS NOT NULL
  AND jsonb_typeof(tr.quote_snapshot -> 'total') = 'number'
  AND (
    COALESCE((SELECT b.total_price FROM public.bookings b WHERE b.trip_request_id = tr.id), 0)
    + COALESCE((SELECT sum(COALESCE(tb.final_price, tb.quoted_price)) FROM public.trip_bookings tb
                 WHERE tb.trip_request_id = tr.id), 0)
  ) <> (tr.quote_snapshot ->> 'total')::numeric;

-- b5: converted requests with children whose status != parent status, or cancelled
SELECT 'b5_status_drift' AS section, count(*) AS n
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_request_id = tr.id
             AND (b.status <> tr.status OR b.status = 'cancelled'))
    OR EXISTS (SELECT 1 FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id
             AND (tb.status <> tr.status OR tb.status = 'cancelled'))
  );

-- b6: standalone bookings / standalone trip_bookings (trip_request_id NULL)
SELECT 'b6_standalone_bookings' AS section, count(*) AS n
FROM public.bookings WHERE trip_request_id IS NULL;
SELECT 'b6_standalone_trip_bookings' AS section, count(*) AS n
FROM public.trip_bookings WHERE trip_request_id IS NULL;

-- b7: impact set — converted requests' total split by classification (inline predicate, see (f))
SELECT 'b7_impact_by_classification' AS section, x.classification, count(*) AS n,
       sum(COALESCE((tr.quote_snapshot ->> 'total')::numeric, tr.quoted_total, 0)) AS total_sum
FROM public.trip_requests tr
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN tr.quote_snapshot IS NULL OR jsonb_typeof(tr.quote_snapshot -> 'total') IS DISTINCT FROM 'number'
      THEN 'BLOCKED_MISSING_SNAPSHOT'
    WHEN EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_request_id = tr.id AND COALESCE(b.amount_paid, 0) > 0)
      OR EXISTS (SELECT 1 FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id AND COALESCE(tb.amount_paid, 0) > 0)
      THEN 'MANUAL_FINANCIAL_REVIEW'
    WHEN EXISTS (SELECT 1 FROM public.payment_records pr JOIN public.bookings b
                   ON b.id = pr.entity_id AND pr.entity_type = 'accommodation_booking'
                 WHERE b.trip_request_id = tr.id)
      OR EXISTS (SELECT 1 FROM public.payment_records pr JOIN public.trip_bookings tb
                   ON tb.id = pr.entity_id AND pr.entity_type = 'trip_booking'
                 WHERE tb.trip_request_id = tr.id)
      THEN 'MANUAL_FINANCIAL_REVIEW'
    ELSE 'SAFE_AUTO_BACKFILL'
  END AS classification
) x
WHERE tr.converted_booking_id IS NOT NULL
GROUP BY x.classification;

-- Orphans: unconverted request whose children already exist (should be impossible, but check)
SELECT 'b8_orphan_unconverted_with_children' AS section, count(*) AS n
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NULL
  AND (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_request_id = tr.id)
    OR EXISTS (SELECT 1 FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id)
  );

-- Same phone, other trip_requests (multi-journey customers)
SELECT 'b9_same_phone_other_requests' AS section, tr.customer_phone, count(*) AS n
FROM public.trip_requests tr
WHERE tr.customer_phone IN (
  SELECT customer_phone FROM public.trip_requests GROUP BY customer_phone HAVING count(*) > 1
)
GROUP BY tr.customer_phone
ORDER BY n DESC;

-- ─── (c) Every converted journey with child payments + ledger lines ───
SELECT
  'c_journey_with_child_payments' AS section,
  tr.reference, tr.id AS trip_request_id, tr.status,
  b.id AS booking_id, b.amount_paid AS booking_amount_paid,
  tb.id AS trip_booking_id, tb.amount_paid AS trip_booking_amount_paid,
  pr.id AS payment_record_id, pr.entity_type, pr.entity_id, pr.direction, pr.amount, pr.received_at
FROM public.trip_requests tr
LEFT JOIN public.bookings b ON b.trip_request_id = tr.id
LEFT JOIN public.trip_bookings tb ON tb.trip_request_id = tr.id
LEFT JOIN public.payment_records pr ON
  (pr.entity_type = 'accommodation_booking' AND pr.entity_id = b.id)
  OR (pr.entity_type = 'trip_booking' AND pr.entity_id = tb.id)
WHERE tr.converted_booking_id IS NOT NULL
  AND (COALESCE(b.amount_paid, 0) > 0 OR COALESCE(tb.amount_paid, 0) > 0 OR pr.id IS NOT NULL)
ORDER BY tr.reference;

-- ─── (d) Mismatches detail (child-total sum vs quote_snapshot total) ───
SELECT
  'd_mismatch_detail' AS section,
  tr.reference, tr.id AS trip_request_id,
  (tr.quote_snapshot ->> 'total')::numeric AS snapshot_total,
  COALESCE((SELECT b.total_price FROM public.bookings b WHERE b.trip_request_id = tr.id), 0)
    + COALESCE((SELECT sum(COALESCE(tb.final_price, tb.quoted_price)) FROM public.trip_bookings tb
                 WHERE tb.trip_request_id = tr.id), 0) AS children_total_sum
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NOT NULL
  AND tr.quote_snapshot IS NOT NULL
  AND jsonb_typeof(tr.quote_snapshot -> 'total') = 'number'
  AND (
    COALESCE((SELECT b.total_price FROM public.bookings b WHERE b.trip_request_id = tr.id), 0)
    + COALESCE((SELECT sum(COALESCE(tb.final_price, tb.quoted_price)) FROM public.trip_bookings tb
                 WHERE tb.trip_request_id = tr.id), 0)
  ) <> (tr.quote_snapshot ->> 'total')::numeric
ORDER BY tr.reference;

-- ─── (e) Status drift detail ───
SELECT
  'e_status_drift_detail' AS section,
  tr.reference, tr.id AS trip_request_id, tr.status AS parent_status,
  'booking' AS child_kind, b.id AS child_id, b.status AS child_status
FROM public.trip_requests tr
JOIN public.bookings b ON b.trip_request_id = tr.id
WHERE tr.converted_booking_id IS NOT NULL AND (b.status <> tr.status OR b.status = 'cancelled')
UNION ALL
SELECT
  'e_status_drift_detail' AS section,
  tr.reference, tr.id AS trip_request_id, tr.status AS parent_status,
  'trip_booking' AS child_kind, tb.id AS child_id, tb.status AS child_status
FROM public.trip_requests tr
JOIN public.trip_bookings tb ON tb.trip_request_id = tr.id
WHERE tr.converted_booking_id IS NOT NULL AND (tb.status <> tr.status OR tb.status = 'cancelled')
ORDER BY 2;

-- ─── (f) Per converted request classification ───
-- Predicate written out inline (no new column/function referenced) but
-- MIRRORS weemap_journey_backfill_class() as 049 will define it:
--   NOT_CONVERTED         — converted_booking_id IS NULL (not selected here)
--   ALREADY_COMMERCIAL    — cannot occur pre-049 (agreed_total doesn't exist yet)
--   BLOCKED_MISSING_SNAPSHOT — quote_snapshot missing / total not numeric
--   MANUAL_FINANCIAL_REVIEW  — any child amount_paid > 0, OR any child has payment_records
--   SAFE_AUTO_BACKFILL       — none of the above
SELECT
  'f_classification' AS section,
  tr.reference, tr.id AS trip_request_id,
  CASE
    WHEN tr.quote_snapshot IS NULL OR jsonb_typeof(tr.quote_snapshot -> 'total') IS DISTINCT FROM 'number'
      THEN 'BLOCKED_MISSING_SNAPSHOT'
    WHEN EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_request_id = tr.id AND COALESCE(b.amount_paid, 0) > 0)
      OR EXISTS (SELECT 1 FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id AND COALESCE(tb.amount_paid, 0) > 0)
      THEN 'MANUAL_FINANCIAL_REVIEW'
    WHEN EXISTS (SELECT 1 FROM public.payment_records pr JOIN public.bookings b
                   ON b.id = pr.entity_id AND pr.entity_type = 'accommodation_booking'
                 WHERE b.trip_request_id = tr.id)
      OR EXISTS (SELECT 1 FROM public.payment_records pr JOIN public.trip_bookings tb
                   ON tb.id = pr.entity_id AND pr.entity_type = 'trip_booking'
                 WHERE tb.trip_request_id = tr.id)
      THEN 'MANUAL_FINANCIAL_REVIEW'
    ELSE 'SAFE_AUTO_BACKFILL'
  END AS classification
FROM public.trip_requests tr
WHERE tr.converted_booking_id IS NOT NULL
ORDER BY tr.reference;

ROLLBACK;
