-- 022_trip_discount_window_and_trip_booking_snapshot.sql
--
-- ADDITIVE ONLY. Deliberately narrow.
--
-- IMPORTANT — what this migration does NOT do:
--   `sinai_trips.discount_type`, `.discount_value` and `.discount_label`
--   ALREADY EXIST in production, added by a migration that is not checked
--   into this repo (`017_discounts_and_payment_tracking`, applied
--   2026-08-25). Their CHECK constraint allows only 'amount' | 'percentage',
--   with NULL meaning "no discount", matching the Signature Experiences
--   convention in src/lib/experience-pricing.ts. All 13 existing trip rows
--   already carry a discount_type value.
--
--   This migration therefore does NOT add, retype, or re-constrain those
--   columns. The application code was aligned to the existing convention
--   instead — see effectiveTripPrice() in src/lib/pricing.ts. Do not
--   introduce a 'none' sentinel or a 'percent' spelling: both would violate
--   the live CHECK constraint and fail on write.
--
-- Pricing contract for the discount (enforced in application code):
--   * It applies to `sinai_trips.price` only. `package_price` is untouched:
--     a Trip Package has its own bundle pricing, and the two free
--     Dahab-package trips cost 0 regardless (see includedTripCost).
--   * effectiveTripPrice() is the single resolver. Nothing recomputes the
--     percentage or the subtraction at a call site.
--   * A resolved price is FROZEN into the booking at request time. Changing
--     or removing a discount later must never move a past booking's price.

-- ─── 1. Optional scheduling window for a trip discount ───
--
-- Both NULL (the default, and what every existing row gets) means the
-- discount is simply on whenever discount_type/discount_value are set —
-- so this is a no-op for current data.

ALTER TABLE public.sinai_trips
  ADD COLUMN IF NOT EXISTS discount_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_ends_at   TIMESTAMPTZ;

-- A window that ends before it starts would silently disable the discount.
ALTER TABLE public.sinai_trips DROP CONSTRAINT IF EXISTS sinai_trips_discount_window_check;
ALTER TABLE public.sinai_trips ADD CONSTRAINT sinai_trips_discount_window_check
  CHECK (
    discount_starts_at IS NULL
    OR discount_ends_at IS NULL
    OR discount_starts_at <= discount_ends_at
  );

COMMENT ON COLUMN public.sinai_trips.discount_starts_at IS
  'Optional start of the discount window. NULL = active as soon as '
  'discount_type/discount_value are set. Resolved by effectiveTripPrice().';
COMMENT ON COLUMN public.sinai_trips.discount_ends_at IS
  'Optional end of the discount window. NULL = no expiry.';

-- ─── 2. Frozen pricing for trip bookings ───
--
-- trip_bookings stored only quoted_price/final_price — a bare number with no
-- record of how it was reached, which is why an invoice could not show the
-- customer what they were being charged for. Mirrors bookings.price_snapshot
-- and the package_snapshot convention already on this table.

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS price_snapshot JSONB;

COMMENT ON COLUMN public.trip_bookings.price_snapshot IS
  'Frozen per-person price, any discount that applied, and the party size at '
  'request time — see buildTripPriceSnapshot() in src/lib/pricing.ts. Never '
  're-derived from live sinai_trips values after the booking is made.';
