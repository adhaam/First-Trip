-- 032_trip_requests.sql
-- Structured Trip Builder request (WEEMAP V2 · M1 foundation for M2).
--
-- WHY
--   The M2 Trip Builder lets a customer compose origin, transport, dates,
--   travellers, stay, room/meal and experiences. That intent must survive the
--   hand-off as structured data — not a WhatsApp text blob — so operations
--   (and later AGENEON) can act on it.
--
-- CONTRACT (read/written by src/lib/trip-requests/)
--   * One row = one submitted journey request. It is NOT a replacement for
--     bookings / trip_bookings: when operations confirm it, they create or
--     link the concrete bookings (converted_booking_id, and trip_bookings
--     rows referencing trip_request_id).
--   * Privacy: a row is only created once the customer submits contact
--     details. Anonymous in-progress builder state stays in the browser
--     (see src/lib/trip-requests/draft.ts); there is no server-side
--     tracking of anonymous visitors. builder_stage records how far the
--     builder got when the row was written.
--   * transport_mode: 'package_bus' | 'hiace' (same codes as
--     transfer_settings.transfer_type) or 'stay_only'.
--   * Prices in quote_snapshot / quoted_total are the server engine's output
--     at submission time (src/lib/quote-service.ts). Never client-supplied.
--   * payment_plan is the policy applied at submission time
--     (src/lib/payment-rules.ts). Payment is never due before confirmation.
--   * reference: human-readable, unique, e.g. WR-2609-0042.
--   * Status vocabulary matches the request workflow in
--     src/lib/request-workflow.ts; history and domain events are recorded
--     by the triggers from migration 031.
--
-- Additive only. Safe to re-run.

CREATE SEQUENCE IF NOT EXISTS public.trip_request_reference_seq;

CREATE TABLE IF NOT EXISTS public.trip_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               TEXT NOT NULL UNIQUE DEFAULT (
                            'WR-' || to_char(NOW() AT TIME ZONE 'Africa/Cairo', 'YYMM') || '-' ||
                            lpad(nextval('public.trip_request_reference_seq')::text, 4, '0')),
  status                  TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'checking_availability', 'alternatives_required',
                            'awaiting_payment', 'confirmed', 'completed', 'cancelled')),
  builder_stage           TEXT NOT NULL DEFAULT 'submitted' CHECK (builder_stage IN (
                            'contact_captured', 'submitted')),
  source                  TEXT NOT NULL DEFAULT 'website' CHECK (source IN (
                            'website', 'manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other')),
  locale                  TEXT NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),

  -- Journey
  origin_governorate_code TEXT,
  transport_mode          TEXT NOT NULL CHECK (transport_mode IN ('package_bus', 'hiace', 'stay_only')),
  stay_pattern_code       TEXT REFERENCES public.stay_patterns(code) ON DELETE SET NULL,
  arrival_date            DATE NOT NULL,
  departure_date          DATE NOT NULL,
  adults                  SMALLINT NOT NULL DEFAULT 1 CHECK (adults >= 1),
  children                SMALLINT NOT NULL DEFAULT 0 CHECK (children >= 0),

  -- Stay
  accommodation_id        UUID REFERENCES public.accommodations(id) ON DELETE SET NULL,
  room_allocations        JSONB NOT NULL DEFAULT '[]'::jsonb,
  meal_plan_key           TEXT,

  -- Experiences: [{ "kind": "trip" | "trip_package", "id": uuid, "preferred_date": "YYYY-MM-DD" | null }]
  experiences             JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Money (server-computed, frozen at submission)
  quote_snapshot          JSONB,
  quoted_total            NUMERIC(12,2),
  payment_plan            JSONB,

  -- Contact
  customer_id             UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name           TEXT NOT NULL,
  customer_phone          TEXT NOT NULL,
  customer_email          TEXT,
  notes                   TEXT,

  -- Operations
  converted_booking_id    UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at            TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT trip_requests_dates_ordered CHECK (departure_date >= arrival_date),
  CONSTRAINT trip_requests_experiences_array CHECK (jsonb_typeof(experiences) = 'array'),
  CONSTRAINT trip_requests_allocations_array CHECK (jsonb_typeof(room_allocations) = 'array'),
  CONSTRAINT trip_requests_transport_origin CHECK (
    transport_mode = 'stay_only' OR origin_governorate_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_trip_requests_status   ON public.trip_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_requests_arrival  ON public.trip_requests (arrival_date);
CREATE INDEX IF NOT EXISTS idx_trip_requests_customer ON public.trip_requests (customer_id);

-- Concrete trip bookings created from a request point back at it.
ALTER TABLE public.trip_bookings
  ADD COLUMN IF NOT EXISTS trip_request_id UUID REFERENCES public.trip_requests(id) ON DELETE SET NULL;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_request_id UUID REFERENCES public.trip_requests(id) ON DELETE SET NULL;

ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trip_requests_service_role_all" ON public.trip_requests;
CREATE POLICY "trip_requests_service_role_all" ON public.trip_requests
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_trip_requests_updated_at ON public.trip_requests;
CREATE TRIGGER update_trip_requests_updated_at BEFORE UPDATE ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS weemap_stamp_lifecycle ON public.trip_requests;
CREATE TRIGGER weemap_stamp_lifecycle BEFORE INSERT OR UPDATE OF status ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.weemap_stamp_lifecycle();

DROP TRIGGER IF EXISTS weemap_record_change ON public.trip_requests;
CREATE TRIGGER weemap_record_change AFTER INSERT OR UPDATE ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.weemap_record_request_change('trip_request');
