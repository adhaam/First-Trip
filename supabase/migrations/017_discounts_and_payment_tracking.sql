-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017 · Discounts + Payment Tracking
-- ───────────────────────────────────────────────────────────────────────────
-- 1. Discount columns on every pricing entity (accommodations, sinai_trips,
--    experiences, commerce_products, rental_pricing_tiers).
-- 2. Booking-level discount (applied at checkout / manual entry).
-- 3. Payment channel + receiver tracking on all booking tables.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Discount columns on pricing entities
-- ─────────────────────────────────────────────────────────────────────────

-- Accommodations (Book Dahab)
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

-- Sinai Trips
ALTER TABLE public.sinai_trips
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

-- Signature Experiences
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

-- Commerce Products (Merch + Rent)
ALTER TABLE public.commerce_products
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

-- Rental Pricing Tiers
ALTER TABLE public.rental_pricing_tiers
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_label  TEXT NOT NULL DEFAULT '';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Booking-level discount (manual / checkout override)
-- ─────────────────────────────────────────────────────────────────────────

-- Package / accommodation / transfer bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage'));

-- Sinai trip bookings
ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage'));

-- Experience bookings
ALTER TABLE public.experience_bookings
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type   TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Payment channel + receiver tracking
-- ─────────────────────────────────────────────────────────────────────────

-- Package / accommodation / transfer bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_channel     TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes       TEXT NOT NULL DEFAULT '';

-- Sinai trip bookings
ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS payment_status      TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS amount_paid         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_channel     TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes       TEXT NOT NULL DEFAULT '';

-- Experience bookings
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
