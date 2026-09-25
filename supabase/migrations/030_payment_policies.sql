-- 030_payment_policies.sql
-- Payment business rules as data, with an explicit payment classification on
-- every product and request (WEEMAP V2 · M1).
--
-- WHY
--   How much a customer pays, and WHEN, is operational truth — not UI copy.
--   M2 (Trip Builder, request confirmation, invoices) must read one source.
--   "Package" means two financially different things at WEEMAP, so the rule
--   is never derived from a table name or from what a package contains:
--     * a Dahab STAY package (accommodation + transport, possibly with the
--       included trips) pays like a stay;
--     * a Sinai EXPERIENCE package (e.g. yacht + safari + Blue Hole) pays
--       like trips.
--
-- CONTRACT (read by src/lib/payment-rules.ts)
--   * payment_policies has one row per payment kind:
--       stay               accommodation / stay only
--       stay_package       Dahab stay package (stay + transport [+ included trips])
--       transfer           transfer only
--       trip               standalone Sinai trip
--       experience_package Sinai experience / trip package (bundle of activities)
--     signature / commerce / rental have no fixed rule yet (staff agree terms
--     per request); the code reports them as "per_quote".
--   * The kind is STORED, explicitly:
--       trip_packages.payment_kind   catalogue classification of each package
--                                    (default experience_package).
--       bookings.payment_kind        set when the request is created.
--       trip_bookings.payment_kind   set when the request is created; for a
--                                    package request it is copied from the
--                                    booked package's catalogue payment_kind.
--     A BEFORE INSERT trigger fills payment_kind when the caller does not, from
--     the explicit product classification (bookings.booking_type, whose
--     'package' value IS the Dahab stay package, or the package catalogue).
--     Existing rows are backfilled the same way once.
--   * upfront_percent is the share requested at upfront_due; the remainder is
--     due at balance_due. 100 means no balance.
--   * upfront_due 'after_confirmation' = only once WEEMAP has confirmed
--     availability / operation. Payment is NEVER requested before that.
--   * No payment gateway. payment_methods lists how staff collect money; the
--     codes match the payment_channel vocabulary on the booking tables.
--
-- Current truth seeded below (2026-09):
--   Stay only:               50% after availability confirmation, 50% on arrival.
--   Dahab stay package:      50% after availability confirmation, 50% on arrival.
--   Transfer only:           100% after confirmation.
--   Standalone Sinai trip:   100% after confirmation.
--   Experience/trip package: 100% after confirmation.
--
-- Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.payment_policies (
  booking_kind    TEXT PRIMARY KEY CHECK (booking_kind IN (
                    'stay', 'stay_package', 'transfer', 'trip', 'experience_package',
                    'signature', 'commerce', 'rental')),
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
  ('stay',               50,  'after_confirmation', 'on_arrival'),
  ('stay_package',       50,  'after_confirmation', 'on_arrival'),
  ('transfer',           100, 'after_confirmation', NULL),
  ('trip',               100, 'after_confirmation', NULL),
  ('experience_package', 100, 'after_confirmation', NULL)
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

-- ─── Explicit payment classification on products and requests ───
ALTER TABLE public.trip_packages
  ADD COLUMN IF NOT EXISTS payment_kind TEXT NOT NULL DEFAULT 'experience_package';
ALTER TABLE public.trip_packages DROP CONSTRAINT IF EXISTS trip_packages_payment_kind_check;
ALTER TABLE public.trip_packages ADD CONSTRAINT trip_packages_payment_kind_check
  CHECK (payment_kind IN ('experience_package', 'stay_package'));
COMMENT ON COLUMN public.trip_packages.payment_kind IS
  'How this package is paid for. Sinai activity bundles are experience_package (paid like trips).';

ALTER TABLE public.bookings      ADD COLUMN IF NOT EXISTS payment_kind TEXT;
ALTER TABLE public.trip_bookings ADD COLUMN IF NOT EXISTS payment_kind TEXT;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_kind_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_kind_check
  CHECK (payment_kind IN ('stay', 'stay_package', 'transfer'));
ALTER TABLE public.trip_bookings DROP CONSTRAINT IF EXISTS trip_bookings_payment_kind_check;
ALTER TABLE public.trip_bookings ADD CONSTRAINT trip_bookings_payment_kind_check
  CHECK (payment_kind IN ('trip', 'experience_package', 'stay_package'));

-- bookings.booking_type is the explicit product classification of an
-- accommodation-side request; 'package' is the Dahab stay package.
CREATE OR REPLACE FUNCTION public.weemap_booking_payment_kind(booking_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE booking_type
    WHEN 'package'            THEN 'stay_package'
    WHEN 'accommodation-only' THEN 'stay'
    WHEN 'transfer-only'      THEN 'transfer'
  END
$$;

CREATE OR REPLACE FUNCTION public.weemap_set_payment_kind()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_kind IS NULL THEN
    IF TG_TABLE_NAME = 'bookings' THEN
      NEW.payment_kind := public.weemap_booking_payment_kind(NEW.booking_type);
    ELSIF NEW.trip_package_id IS NOT NULL THEN
      SELECT payment_kind INTO NEW.payment_kind
        FROM public.trip_packages WHERE id = NEW.trip_package_id;
    ELSE
      NEW.payment_kind := 'trip';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS weemap_set_payment_kind ON public.bookings;
CREATE TRIGGER weemap_set_payment_kind BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.weemap_set_payment_kind();
DROP TRIGGER IF EXISTS weemap_set_payment_kind ON public.trip_bookings;
CREATE TRIGGER weemap_set_payment_kind BEFORE INSERT ON public.trip_bookings
  FOR EACH ROW EXECUTE FUNCTION public.weemap_set_payment_kind();

-- One-time backfill of existing requests from the same explicit sources.
UPDATE public.bookings SET payment_kind = public.weemap_booking_payment_kind(booking_type)
  WHERE payment_kind IS NULL;
UPDATE public.trip_bookings tb SET payment_kind = tp.payment_kind
  FROM public.trip_packages tp
  WHERE tb.payment_kind IS NULL AND tb.trip_package_id = tp.id;
UPDATE public.trip_bookings SET payment_kind = 'trip'
  WHERE payment_kind IS NULL AND trip_package_id IS NULL;
