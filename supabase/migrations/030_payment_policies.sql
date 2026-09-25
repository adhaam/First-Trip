-- 030_payment_policies.sql
-- Payment business rules as data (WEEMAP V2 · M1).
--
-- WHY
--   How much a customer pays, and WHEN, is operational truth — not UI copy.
--   M2 (Trip Builder, request confirmation, invoices) must read one source.
--
-- CONTRACT (read by src/lib/payment-rules.ts)
--   * One row per booking kind. The kinds map to existing request tables:
--       accommodation_package → bookings.booking_type = 'package'
--       accommodation_stay    → bookings.booking_type = 'accommodation-only'
--       transfer              → bookings.booking_type = 'transfer-only'
--       trip                  → trip_bookings (context standalone / package_addon)
--       trip_package          → trip_bookings (context package)
--     Kinds with no row (Signature, commerce, rentals) have no fixed rule yet:
--     staff agree terms per request. The code reports them as "per_quote".
--   * upfront_percent is the share requested at upfront_due; the remainder is
--     due at balance_due. 100 means no balance.
--   * upfront_due 'after_confirmation' = only once WEEMAP has confirmed
--     availability / operation. Payment is NEVER requested before that.
--   * No payment gateway. payment_methods lists how staff collect money; the
--     codes match the payment_channel vocabulary on the booking tables.
--
-- Current truth seeded below (2026-09):
--   Hotel / Dahab package & stay: 50% after availability confirmation,
--                                 50% on arrival.
--   Transfers:                    100% after availability/operation confirmation.
--   Standalone trips:             100% after confirmation.
--   Trip packages:                treated as trips (100% after confirmation).
--
-- Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.payment_policies (
  booking_kind    TEXT PRIMARY KEY CHECK (booking_kind IN (
                    'accommodation_package', 'accommodation_stay', 'transfer',
                    'trip', 'trip_package', 'signature', 'commerce', 'rental')),
  upfront_percent NUMERIC(5,2) NOT NULL CHECK (upfront_percent > 0 AND upfront_percent <= 100),
  upfront_due     TEXT NOT NULL CHECK (upfront_due IN ('after_confirmation')),
  balance_due     TEXT CHECK (balance_due IN ('on_arrival', 'before_service')),
  notes_ar        TEXT NOT NULL DEFAULT '',
  notes_en        TEXT NOT NULL DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_policies_balance_consistent CHECK (
    (upfront_percent = 100 AND balance_due IS NULL) OR
    (upfront_percent < 100 AND balance_due IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  code             TEXT PRIMARY KEY,
  name_ar          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  on_request_only  BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.payment_methods.on_request_only IS
  'Offered only when the customer asks (e.g. a Visa/Mastercard payment link).';

ALTER TABLE public.payment_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_policies_public_read" ON public.payment_policies;
CREATE POLICY "payment_policies_public_read" ON public.payment_policies
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "payment_policies_service_role_all" ON public.payment_policies;
CREATE POLICY "payment_policies_service_role_all" ON public.payment_policies
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "payment_methods_public_read" ON public.payment_methods;
CREATE POLICY "payment_methods_public_read" ON public.payment_methods
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "payment_methods_service_role_all" ON public.payment_methods;
CREATE POLICY "payment_methods_service_role_all" ON public.payment_methods
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_payment_policies_updated_at ON public.payment_policies;
CREATE TRIGGER update_payment_policies_updated_at BEFORE UPDATE ON public.payment_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_policies (booking_kind, upfront_percent, upfront_due, balance_due) VALUES
  ('accommodation_package', 50,  'after_confirmation', 'on_arrival'),
  ('accommodation_stay',    50,  'after_confirmation', 'on_arrival'),
  ('transfer',              100, 'after_confirmation', NULL),
  ('trip',                  100, 'after_confirmation', NULL),
  ('trip_package',          100, 'after_confirmation', NULL)
ON CONFLICT (booking_kind) DO NOTHING;

INSERT INTO public.payment_methods (code, name_ar, name_en, on_request_only, sort_order) VALUES
  ('vodafonecash', 'فودافون كاش', 'Vodafone Cash', false, 0),
  ('instapay',     'إنستاباي',    'InstaPay',      false, 1),
  ('cash',         'كاش',         'Cash',          false, 2),
  ('card_link',    'رابط دفع فيزا / ماستركارد', 'Visa / Mastercard payment link', true, 3)
ON CONFLICT (code) DO NOTHING;

-- Staff can now record a card-link payment on every request table.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'trip_bookings', 'experience_bookings', 'commerce_orders'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_payment_channel_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (payment_channel IN (''instapay'', ''vodafonecash'', ''cash'', ''bank_transfer'', ''card_link'', ''other''))',
      t, t || '_payment_channel_check');
  END LOOP;
END $$;
