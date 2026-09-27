-- journey-backfill.dry-run.sql
-- Read-only, runs AFTER 049_journey_commercial_ownership.sql has been
-- applied (schema + weemap_journey_backfill_class() must exist). Shows
-- what the backfill in 049 section B did/would do, for verification —
-- SELECT only, no writes.

BEGIN READ ONLY;

SELECT
  tr.reference,
  tr.id AS trip_request_id,
  public.weemap_journey_backfill_class(tr.id) AS classification,
  tr.agreed_total AS current_agreed_total,
  (tr.quote_snapshot ->> 'total')::numeric AS proposed_agreed_total,
  tr.amount_paid,
  tr.payment_status,
  b.id AS booking_id,
  'BK-' || upper(left(b.id::text, 8)) AS booking_ref,
  b.amount_paid AS booking_amount_paid,
  (SELECT jsonb_agg(jsonb_build_object(
             'id', tb.id,
             'ref', 'TB-' || upper(left(tb.id::text, 8)),
             'amount_paid', tb.amount_paid))
     FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id) AS trip_booking_refs,
  COALESCE(b.amount_paid, 0)
    + COALESCE((SELECT sum(tb.amount_paid) FROM public.trip_bookings tb WHERE tb.trip_request_id = tr.id), 0)
    AS children_paid_sum,
  (SELECT count(*) FROM public.payment_records pr
     WHERE (pr.entity_type = 'accommodation_booking' AND pr.entity_id = b.id)
        OR (pr.entity_type = 'trip_booking' AND pr.entity_id IN
             (SELECT id FROM public.trip_bookings WHERE trip_request_id = tr.id))
  ) AS children_ledger_entry_count,
  (SELECT count(*) FROM public.payment_records pr
     WHERE pr.entity_type = 'trip_request' AND pr.entity_id = tr.id) AS journey_ledger_entry_count
FROM public.trip_requests tr
LEFT JOIN public.bookings b ON b.trip_request_id = tr.id
WHERE tr.converted_booking_id IS NOT NULL
ORDER BY tr.reference;

ROLLBACK;
