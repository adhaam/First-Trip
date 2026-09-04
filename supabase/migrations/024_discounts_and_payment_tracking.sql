-- 024_discounts_and_payment_tracking.sql
--
-- RECOVERED FROM PRODUCTION. Applied to the live database on 2026-08-25 as
-- `017_discounts_and_payment_tracking` (version 20260825164858) but never
-- committed here. Recovered verbatim from
-- supabase_migrations.schema_migrations.
--
-- The file number reflects apply order on a fresh database, not the original
-- date. Renamed from 017 because this folder's 017_trip_packages.sql already
-- holds that number — two different 017s is exactly why this migration went
-- unnoticed until the trip-discount work ran into its CHECK constraint.
--
-- ─── Why this file matters ───
--
-- These columns define the discount vocabulary the whole codebase must use:
--
--     discount_type IN ('amount', 'percentage')   -- NULL = no discount
--
-- There is no 'none' sentinel and it is 'percentage', never 'percent'.
-- Writing anything else fails the CHECK constraint at insert/update time.
-- See effectiveTripPrice() in src/lib/pricing.ts and
-- discountedExperiencePrice() in src/lib/experience-pricing.ts, both of
-- which resolve against this shape.

-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017 · Discounts + Payment Tracking
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Discount columns on pricing entities
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

ALTER TABLE public.sinai_trips
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

ALTER TABLE public.commerce_products
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

ALTER TABLE public.rental_pricing_tiers
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

-- 2. Booking-level discount
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage'));

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage'));

ALTER TABLE public.experience_bookings
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage'));

-- 3. Payment channel + receiver tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_channel     TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes       TEXT NOT NULL DEFAULT '';

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS payment_status      TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS amount_paid         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_channel     TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes       TEXT NOT NULL DEFAULT '';

ALTER TABLE public.experience_bookings
  ADD COLUMN IF NOT EXISTS payment_status      TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS amount_paid         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_channel     TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes       TEXT NOT NULL DEFAULT '';

COMMIT;
