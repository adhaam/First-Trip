-- 034_trip_packages_are_sinai_experience_packages.sql
-- Every trip_package is a Sinai experience package (WEEMAP V2 · M2 correction).
--
-- WHY
--   Migration 030 let a trip_package carry payment_kind 'stay_package', which
--   turned an internal payment classification into a second public product
--   ("Dahab Stay Packages") beside the Sinai trip packages. That is wrong:
--     * trip_packages are bundles of real Sinai excursions that start from
--       Dahab / the guest's accommodation, sold at a better total than the
--       trips separately. Like every Sinai trip they are paid 100% after
--       confirmation — payment_kind 'experience_package'.
--     * 'stay_package' is the INTERNAL classification of a transport + stay
--       journey (Trip Builder / bookings.booking_type 'package'): 50% after
--       availability confirmation, 50% on arrival. It lives on bookings and
--       trip-request payment parts, never on a trip_package.
--
-- WHAT
--   * Normalise any trip_package still classified 'stay_package'.
--   * Narrow the CHECK so a trip_package can only be 'experience_package'.
--     trip_bookings made through a package then always derive
--     'experience_package' via weemap_set_payment_kind() (migration 030).
--   * bookings / trip_bookings payment_kind vocabularies are unchanged, so no
--     stored historical kind is touched (the 030 guard still protects them).
--
-- Additive and safe to re-run.

UPDATE public.trip_packages
   SET payment_kind = 'experience_package'
 WHERE payment_kind IS DISTINCT FROM 'experience_package';

ALTER TABLE public.trip_packages DROP CONSTRAINT IF EXISTS trip_packages_payment_kind_check;
ALTER TABLE public.trip_packages ADD CONSTRAINT trip_packages_payment_kind_check
  CHECK (payment_kind = 'experience_package');

COMMENT ON COLUMN public.trip_packages.payment_kind IS
  'Always experience_package: a trip_package is a bundle of Sinai trips, paid 100% after confirmation. stay_package is only the internal classification of a transport + stay booking.';
