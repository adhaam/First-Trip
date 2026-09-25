-- 029_transport_schedule.sql
-- Transport operating schedule as configurable data (WEEMAP V2 · M1).
--
-- WHY
--   The shared-bus weekdays (out Sun/Thu, back Mon/Fri) lived as constants in
--   src/lib/pricing.ts, in the booking API and in the booking form. Operations
--   must be able to change days, close a date, add an extra departure or run a
--   seasonal timetable without a deploy.
--
-- CONTRACT (read by src/lib/transport/schedule.ts)
--   * Two separate concepts, deliberately not merged:
--       1. OPERATING SCHEDULE — on which dates a transport service runs
--          (transfer_settings.schedule_mode + transport_weekly_rules
--          + transport_date_exceptions).
--       2. COMMERCIAL STAY PATTERNS — which outbound/return combinations
--          WEEMAP actually sells as a package (stay_patterns). A date being
--          operable does NOT make every outbound/return pair a product.
--   * direction: 'outbound' = towards Dahab, 'return' = leaving Dahab.
--   * weekday: 0 = Sunday … 6 = Saturday (same as JS Date#getDay).
--   * schedule_mode 'on_demand' services (private Hiace) run any day unless a
--     blackout exception closes the date; weekly rules are ignored for them.
--   * schedule_mode 'scheduled' services (shared bus) run only on active
--     weekly-rule days (optionally limited to a valid_from/valid_to season and
--     to one origin governorate), plus 'extra' exception dates, minus
--     'blackout' exception dates. Blackout wins over extra on the same date.
--   * origin_governorate_code NULL means "every origin".
--   * Pricing is NOT here — it stays in transfer_settings /
--     transfer_governorate_pricing (migration_v3.sql).
--   * The seed below reproduces the business truth at the time of writing and
--     is mirrored by DEFAULT_TRANSPORT_SCHEDULE in the code, which is only used
--     if these tables are missing (e.g. code deployed before this migration).
--
-- Additive only. Safe to re-run.

-- ─── 1. Scheduling mode per transport service ───
ALTER TABLE public.transfer_settings
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'on_demand';

ALTER TABLE public.transfer_settings DROP CONSTRAINT IF EXISTS transfer_settings_schedule_mode_check;
ALTER TABLE public.transfer_settings ADD CONSTRAINT transfer_settings_schedule_mode_check
  CHECK (schedule_mode IN ('scheduled', 'on_demand'));

COMMENT ON COLUMN public.transfer_settings.schedule_mode IS
  'scheduled = runs only on transport_weekly_rules days (+extra, -blackout); on_demand = any day except blackout dates.';

-- The shared bus is the only timetabled service today.
UPDATE public.transfer_settings SET schedule_mode = 'scheduled' WHERE transfer_type = 'package_bus';

-- ─── 2. Weekly operating rules ───
CREATE TABLE IF NOT EXISTS public.transport_weekly_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_type           TEXT NOT NULL REFERENCES public.transfer_settings(transfer_type) ON DELETE CASCADE,
  direction               TEXT NOT NULL CHECK (direction IN ('outbound', 'return')),
  weekday                 SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  origin_governorate_code TEXT,
  valid_from              DATE,
  valid_to                DATE,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  notes                   TEXT NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transport_weekly_rules_season_order CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_weekly_rules
  ON public.transport_weekly_rules (
    transfer_type, direction, weekday,
    COALESCE(origin_governorate_code, ''),
    COALESCE(valid_from, '-infinity'::date),
    COALESCE(valid_to, 'infinity'::date)
  );
CREATE INDEX IF NOT EXISTS idx_transport_weekly_rules_lookup
  ON public.transport_weekly_rules (transfer_type, direction, is_active);

-- ─── 3. Date exceptions: blackout closures and extra departures ───
CREATE TABLE IF NOT EXISTS public.transport_date_exceptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_type           TEXT NOT NULL REFERENCES public.transfer_settings(transfer_type) ON DELETE CASCADE,
  direction               TEXT NOT NULL CHECK (direction IN ('outbound', 'return', 'both')),
  service_date            DATE NOT NULL,
  kind                    TEXT NOT NULL CHECK (kind IN ('blackout', 'extra')),
  origin_governorate_code TEXT,
  reason_ar               TEXT NOT NULL DEFAULT '',
  reason_en               TEXT NOT NULL DEFAULT '',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_date_exceptions
  ON public.transport_date_exceptions (
    transfer_type, direction, service_date, kind, COALESCE(origin_governorate_code, '')
  );
CREATE INDEX IF NOT EXISTS idx_transport_date_exceptions_date
  ON public.transport_date_exceptions (service_date, is_active);

-- ─── 4. Commercial stay patterns (what WEEMAP sells as a package) ───
-- A pattern fixes the length of a package: return_offset_days after the
-- outbound service date, with `nights` accommodation nights (the bus travels
-- overnight, so a Thu → Mon package is 4 days / 3 nights in Dahab).
-- departure_weekdays limits which outbound days the pattern is sold on when the
-- service is scheduled; NULL means "any operable outbound day" (Hiace).
CREATE TABLE IF NOT EXISTS public.stay_patterns (
  code               TEXT PRIMARY KEY,
  transfer_type      TEXT REFERENCES public.transfer_settings(transfer_type) ON DELETE CASCADE,
  name_ar            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  duration_days      SMALLINT NOT NULL CHECK (duration_days > 0),
  nights             SMALLINT NOT NULL CHECK (nights >= 0),
  return_offset_days SMALLINT NOT NULL CHECK (return_offset_days > 0),
  departure_weekdays SMALLINT[],
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stay_patterns_weekdays_valid CHECK (
    departure_weekdays IS NULL OR departure_weekdays <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
  )
);

COMMENT ON TABLE public.stay_patterns IS
  'Sellable package lengths. transfer_type NULL = applies to every transport service.';

-- ─── 5. Stay-only guidance (recommendation, never a restriction) ───
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS recommended_check_in_weekdays SMALLINT[] NOT NULL DEFAULT ARRAY[1,5]::SMALLINT[];

COMMENT ON COLUMN public.site_settings.recommended_check_in_weekdays IS
  'Weekdays (0=Sun) presented as recommended check-in for stays. Guidance only — any valid date may be booked.';

-- ─── 6. RLS: public read of active rows, service role full access ───
ALTER TABLE public.transport_weekly_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_date_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stay_patterns             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transport_weekly_rules_public_read" ON public.transport_weekly_rules;
CREATE POLICY "transport_weekly_rules_public_read" ON public.transport_weekly_rules
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "transport_weekly_rules_service_role_all" ON public.transport_weekly_rules;
CREATE POLICY "transport_weekly_rules_service_role_all" ON public.transport_weekly_rules
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "transport_date_exceptions_public_read" ON public.transport_date_exceptions;
CREATE POLICY "transport_date_exceptions_public_read" ON public.transport_date_exceptions
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "transport_date_exceptions_service_role_all" ON public.transport_date_exceptions;
CREATE POLICY "transport_date_exceptions_service_role_all" ON public.transport_date_exceptions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "stay_patterns_public_read" ON public.stay_patterns;
CREATE POLICY "stay_patterns_public_read" ON public.stay_patterns
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "stay_patterns_service_role_all" ON public.stay_patterns;
CREATE POLICY "stay_patterns_service_role_all" ON public.stay_patterns
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_transport_weekly_rules_updated_at ON public.transport_weekly_rules;
CREATE TRIGGER update_transport_weekly_rules_updated_at BEFORE UPDATE ON public.transport_weekly_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_transport_date_exceptions_updated_at ON public.transport_date_exceptions;
CREATE TRIGGER update_transport_date_exceptions_updated_at BEFORE UPDATE ON public.transport_date_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_stay_patterns_updated_at ON public.stay_patterns;
CREATE TRIGGER update_stay_patterns_updated_at BEFORE UPDATE ON public.stay_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 7. Seed: current business truth ───
-- Shared bus: out to Dahab Sunday + Thursday, back Monday + Friday.
INSERT INTO public.transport_weekly_rules (transfer_type, direction, weekday, notes) VALUES
  ('package_bus', 'outbound', 0, 'Sunday departure to Dahab'),
  ('package_bus', 'outbound', 4, 'Thursday departure to Dahab'),
  ('package_bus', 'return',   1, 'Monday return from Dahab'),
  ('package_bus', 'return',   5, 'Friday return from Dahab')
ON CONFLICT DO NOTHING;

-- Packages sold today: 4 days / 3 nights and 5 days / 4 nights.
--   Shared bus: 4D/3N leaves Thursday (back Monday), 5D/4N leaves Sunday (back Friday).
--   Private Hiace: same lengths, any outbound day.
INSERT INTO public.stay_patterns
  (code, transfer_type, name_ar, name_en, duration_days, nights, return_offset_days, departure_weekdays, sort_order)
VALUES
  ('bus_4d3n',   'package_bus', '٤ أيام / ٣ ليالي', '4 days / 3 nights', 4, 3, 4, ARRAY[4]::SMALLINT[], 0),
  ('bus_5d4n',   'package_bus', '٥ أيام / ٤ ليالي', '5 days / 4 nights', 5, 4, 5, ARRAY[0]::SMALLINT[], 1),
  ('hiace_4d3n', 'hiace',       '٤ أيام / ٣ ليالي', '4 days / 3 nights', 4, 3, 4, NULL, 2),
  ('hiace_5d4n', 'hiace',       '٥ أيام / ٤ ليالي', '5 days / 4 nights', 5, 4, 5, NULL, 3)
ON CONFLICT (code) DO NOTHING;
