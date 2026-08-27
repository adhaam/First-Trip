-- 021_trip_package_bookings.sql
-- Trip Package direct booking: additive only. Reuses trip_bookings so a
-- package request appears alongside Sinai Trip bookings in Admin, filtered
-- by whether trip_package_id is set.
--
-- trip_id stays nullable (already was) — a package booking sets
-- trip_package_id instead of trip_id. package_snapshot freezes the package's
-- name + per-trip price/package_price at request time, same convention as
-- price_snapshot elsewhere in the pricing engine (see src/lib/pricing.ts).

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS trip_package_id UUID REFERENCES public.trip_packages(id);

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS package_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_trip_bookings_package ON public.trip_bookings (trip_package_id);

ALTER TABLE public.trip_bookings DROP CONSTRAINT IF EXISTS trip_bookings_context_check;
ALTER TABLE public.trip_bookings ADD CONSTRAINT trip_bookings_context_check
  CHECK (context IN ('standalone', 'package_addon', 'package'));

-- Either trip_id or trip_package_id must be set, never both, never neither.
ALTER TABLE public.trip_bookings DROP CONSTRAINT IF EXISTS trip_bookings_trip_xor_package;
ALTER TABLE public.trip_bookings ADD CONSTRAINT trip_bookings_trip_xor_package
  CHECK ((trip_id IS NOT NULL) <> (trip_package_id IS NOT NULL));

COMMENT ON COLUMN public.trip_bookings.trip_package_id IS
  'Set when this booking is a Trip Package request (context = ''package'') '
  'instead of a single-trip request. Mutually exclusive with trip_id.';
COMMENT ON COLUMN public.trip_bookings.package_snapshot IS
  'Frozen package name + included trips'' price/package_price at request '
  'time — never re-derived from live trip_packages/sinai_trips after booking.';
