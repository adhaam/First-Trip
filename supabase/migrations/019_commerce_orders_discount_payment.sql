-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 019 · Commerce orders: discount + payment tracking
-- ───────────────────────────────────────────────────────────────────────────
-- commerce_orders already had payment_status/amount_paid; this adds the same
-- discount + payment-channel/receiver tracking already present on bookings,
-- trip_bookings, and experience_bookings (migration 017) so merch and rental
-- orders are consistent with the other three booking types.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.commerce_orders
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS payment_channel TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT NOT NULL DEFAULT '';
