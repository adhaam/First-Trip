-- 048_ops_edition_requests.sql
-- Surface Experience requests (edition_requests, migration 044) in the Operations
-- Center's unified work queue (ops_work_items, migration 036).
--
-- WHY
--   Edition requests ("Join / Ask / Notify" submissions) were only visible in the
--   Bookings workspace's own Experience requests tab (EditionRequestsPanel). Staff
--   scanning Today / the work queue for "what needs action" had no way to see a new
--   or contacted Experience request there. This migration adds edition_requests as a
--   fifth branch of ops_work_items, normalised into the same row shape as every other
--   request/booking/order.
--
-- NOTES
--   * edition_requests (migration 044) has no customer_id (it never links to
--     public.customers) and no updated_at column, so both map from what the table
--     has: customer_id NULL, updated_at = created_at.
--   * title_en/title_ar join editions for the *current* title rather than the
--     frozen edition_title_snapshot, matching how every other ops_work_items branch
--     shows the catalogue's current name, not a snapshot.
--   * payment_kind/amount_total/amount_paid/transfer_type are NULL — Edition requests
--     carry no price or payment; src/lib/ops/work-items.ts already treats a NULL
--     payment_kind as "not priced by policy" and skips the payment-derived fields.
--   * Read-only here, same as the rest of the view: writes still go only through
--     PATCH /api/admin/edition-requests/[id] and EditionRequestsPanel, never the
--     generic ops item routes (see OPS_ENTITY_TABLES in src/lib/ops/types.ts).
--
-- Additive only (CREATE OR REPLACE VIEW keeps every existing column in place). Safe to re-run.

CREATE OR REPLACE VIEW public.ops_work_items
WITH (security_invoker = true) AS
SELECT
  'accommodation_booking'::text AS entity_type, b.id AS entity_id,
  'BK-' || upper(left(b.id::text, 8)) AS reference, b.booking_type AS subtype, b.payment_kind,
  b.customer_id, b.customer_name, b.customer_phone,
  b.status, b.payment_status, b.total_price AS amount_total, b.amount_paid,
  b.trip_date AS start_date, b.return_date AS end_date, b.num_people AS people,
  COALESCE(a.name_en, '') AS title_en, COALESCE(a.name_ar, '') AS title_ar,
  b.transfer_type, b.source, b.trip_request_id, b.created_at, b.updated_at
FROM public.bookings b
LEFT JOIN public.accommodations a ON a.id = b.accommodation_id
UNION ALL
SELECT
  'trip_booking', tb.id, 'TB-' || upper(left(tb.id::text, 8)),
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
  'signature_request', eb.id, 'SG-' || upper(left(eb.id::text, 8)),
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
LEFT JOIN public.customers c ON c.id = co.customer_id
UNION ALL
SELECT
  'edition_request', er.id, 'ER-' || upper(left(er.id::text, 8)), lower(er.intent), NULL,
  NULL::uuid, er.customer_name, er.phone,
  er.status, NULL, NULL::numeric, NULL::numeric,
  er.requested_start_date, NULL::date, er.travelers,
  COALESCE(ed.title_en, er.edition_title_snapshot, ''), COALESCE(ed.title_ar, er.edition_title_snapshot, ''),
  NULL, er.source, NULL::uuid, er.created_at, er.created_at
FROM public.edition_requests er
LEFT JOIN public.editions ed ON ed.id = er.edition_id;

COMMENT ON VIEW public.ops_work_items IS
  'Operations Center queue: one normalised row per request/booking/order (read-only).';
REVOKE ALL ON public.ops_work_items FROM anon, authenticated;
GRANT SELECT ON public.ops_work_items TO service_role;
