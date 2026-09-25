-- ROLLBACK HELPER — run ONLY if the application is rolled back to the
-- pre-M4 production deployment (weemap-sinai-793zvo8p2) after migrations
-- 029–041 were applied. Not a migration; never part of a normal release.
--
-- That older code (a) types amount_paid / payment_status straight into
-- booking rows and (b) sends pickup orders through 'out_for_delivery'. The
-- M4 guards refuse both, so the old admin would fail on those screens. This
-- lifts ONLY those two guards and the paid-row delete guard. It deletes no
-- data, keeps every table, the ledger and all history, and keeps the M4
-- privilege hardening (041) — the old code uses only the service role.
--
-- Re-arm by re-running migrations 039 and 040 (both are re-runnable) when
-- the M4 application is deployed again.
BEGIN;
DROP TRIGGER IF EXISTS weemap_commerce_order_guard ON public.commerce_orders;
DROP TRIGGER IF EXISTS weemap_payment_truth_guard ON public.bookings;
DROP TRIGGER IF EXISTS weemap_payment_truth_guard ON public.trip_bookings;
DROP TRIGGER IF EXISTS weemap_payment_truth_guard ON public.experience_bookings;
DROP TRIGGER IF EXISTS weemap_payment_truth_guard ON public.commerce_orders;
DROP TRIGGER IF EXISTS weemap_keep_paid_rows ON public.bookings;
DROP TRIGGER IF EXISTS weemap_keep_paid_rows ON public.trip_bookings;
DROP TRIGGER IF EXISTS weemap_keep_paid_rows ON public.experience_bookings;
DROP TRIGGER IF EXISTS weemap_keep_paid_rows ON public.commerce_orders;
COMMIT;
