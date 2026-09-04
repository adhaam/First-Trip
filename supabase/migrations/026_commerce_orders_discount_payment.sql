-- 026_commerce_orders_discount_payment.sql
--
-- RECOVERED FROM PRODUCTION. Applied to the live database on 2026-08-25 as
-- `019_commerce_orders_discount_payment` (version 20260825171147) but never
-- committed here. Recovered verbatim from
-- supabase_migrations.schema_migrations.
--
-- The file number reflects apply order on a fresh database, not the original
-- date. Renamed from 019 to avoid colliding with this folder's existing
-- 019_community_posts_slug.sql.
--
-- Extends commerce orders with the same discount vocabulary and payment
-- tracking the bookings tables got in 024 — 'amount' | 'percentage', NULL
-- meaning no discount.

ALTER TABLE public.commerce_orders
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT NULL
    CHECK (discount_type IN ('amount', 'percentage')),
  ADD COLUMN IF NOT EXISTS payment_channel TEXT DEFAULT NULL
    CHECK (payment_channel IN ('instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS payment_received_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT NOT NULL DEFAULT '';
