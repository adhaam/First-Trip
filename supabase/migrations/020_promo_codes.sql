-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 020 · Promo codes
-- ───────────────────────────────────────────────────────────────────────────
-- Admin-generated discount codes, each scoped to one or more sections
-- (rent / merch / sinai_trips). A code is redeemed by a customer at
-- checkout (commerce) or on the trip request form (sinai trips); the
-- server always re-validates the code and looks up its discount from this
-- table — nothing the client sends about the discount amount is trusted.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL DEFAULT '',
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('amount', 'percentage')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  -- Subset of {'rent','merch','sinai_trips'} — which storefront sections
  -- this code may be applied to. Enforced in application code (validate
  -- endpoint + order/booking creation), not by a DB constraint, since the
  -- set of sections is expected to grow.
  applies_to     TEXT[] NOT NULL DEFAULT '{}',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  starts_at      TIMESTAMPTZ DEFAULT NULL,
  expires_at     TIMESTAMPTZ DEFAULT NULL,
  max_uses       INTEGER DEFAULT NULL CHECK (max_uses IS NULL OR max_uses > 0),
  used_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_upper_idx ON public.promo_codes (upper(code));
CREATE INDEX IF NOT EXISTS promo_codes_is_active_idx ON public.promo_codes (is_active);

DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON public.promo_codes;
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
-- Server routes use the service-role key (bypasses RLS) exclusively — no
-- public policy is defined, matching the pattern used by every other
-- admin-only table in this project (e.g. site_settings, seasonal_rates).

-- Atomic usage counter — avoids a read-modify-write race between two
-- concurrent redemptions of the same code.
CREATE OR REPLACE FUNCTION public.increment_promo_code_usage(p_promo_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = p_promo_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Redemption tracking on the order/booking tables that can carry a code
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.commerce_orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code    TEXT DEFAULT NULL;

ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code    TEXT DEFAULT NULL;

COMMIT;
