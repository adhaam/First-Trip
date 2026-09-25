-- 031_request_workflow_history_events.sql
-- Request workflow states, status history and the domain-event outbox
-- (WEEMAP V2 · M1).
--
-- WHY
--   * WEEMAP does not confirm instantly: a request is checked with the
--     supplier first. The status vocabularies had no way to say "checking
--     availability", "alternatives required" or "awaiting payment".
--   * Status changes were silent overwrites — nothing recorded who moved what,
--     from which state, or when.
--   * AGENEON (future sales agent) needs reliable business events. Browser
--     marketing analytics are not that.
--
-- CONTRACT
--   * New states on bookings / trip_bookings:
--       checking_availability, alternatives_required, awaiting_payment
--     and on experience_bookings (Signature): alternatives_required,
--     awaiting_payment. Existing values keep their meaning ('new' = requested).
--     Allowed transitions are enforced by src/lib/request-workflow.ts.
--   * status_history: one row per status / payment_status change (and the
--     initial status on insert), written by trigger in the SAME transaction
--     as the change. It cannot drift from the row.
--   * domain_events: an outbox. Rows are written by the same trigger, so the
--     business mutation and its event commit or roll back together. Nothing
--     consumes them yet; a future publisher marks published_at.
--     Event vocabulary is mirrored in src/lib/domain-events.ts (a test keeps
--     the two in sync).
--   * Payloads carry identifiers and state only — no names, phones or emails.
--     Consumers look contact data up through WEEMAP with proper access.
--   * Actor: set `weemap.actor` for the transaction (SELECT set_config(
--     'weemap.actor', '<who>', true)) when a caller can; otherwise NULL.
--
-- Additive only. Safe to re-run.

-- ─── 1. Extended status vocabularies ───
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'new', 'pending', 'checking_availability', 'alternatives_required',
  'awaiting_payment', 'confirmed', 'cancelled', 'completed'));

ALTER TABLE public.trip_bookings DROP CONSTRAINT IF EXISTS trip_bookings_status_check;
ALTER TABLE public.trip_bookings ADD CONSTRAINT trip_bookings_status_check CHECK (status IN (
  'new', 'contacted', 'checking_availability', 'alternatives_required',
  'awaiting_payment', 'confirmed', 'completed', 'cancelled'));

ALTER TABLE public.experience_bookings DROP CONSTRAINT IF EXISTS experience_bookings_status_check;
ALTER TABLE public.experience_bookings ADD CONSTRAINT experience_bookings_status_check CHECK (status IN (
  'new', 'contacted', 'planning', 'alternatives_required', 'awaiting_payment',
  'confirmed', 'completed', 'cancelled'));

-- Lifecycle timestamps the operations screens need.
ALTER TABLE public.bookings            ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.trip_bookings       ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.experience_bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- ─── 2. Status history ───
CREATE TABLE IF NOT EXISTS public.status_history (
  id           BIGSERIAL PRIMARY KEY,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  field        TEXT NOT NULL CHECK (field IN ('status', 'payment_status')),
  from_value   TEXT,
  to_value     TEXT,
  actor        TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_history_entity
  ON public.status_history (entity_type, entity_id, changed_at);

-- ─── 3. Domain-event outbox ───
CREATE TABLE IF NOT EXISTS public.domain_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT NOT NULL,
  aggregate_type   TEXT NOT NULL,
  aggregate_id     UUID NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at     TIMESTAMPTZ,
  publish_attempts INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_domain_events_unpublished
  ON public.domain_events (occurred_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
  ON public.domain_events (aggregate_type, aggregate_id, occurred_at);

ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status_history_service_role_all" ON public.status_history;
CREATE POLICY "status_history_service_role_all" ON public.status_history
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "domain_events_service_role_all" ON public.domain_events;
CREATE POLICY "domain_events_service_role_all" ON public.domain_events
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 4. Event vocabulary ───
-- Event emitted when a request row is first created.
CREATE OR REPLACE FUNCTION public.weemap_created_event(entity TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE entity
    WHEN 'signature_request'  THEN 'signature_requested'
    WHEN 'commerce_order'     THEN 'commerce_order_requested'
    WHEN 'rental_reservation' THEN 'rental_requested'
    ELSE 'booking_requested'   -- accommodation_booking, trip_booking, trip_request
  END
$$;

-- Events emitted when a request's status changes.
CREATE OR REPLACE FUNCTION public.weemap_status_events(entity TEXT, from_status TEXT, to_status TEXT)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN entity = 'commerce_order' THEN CASE to_status
      WHEN 'confirmed' THEN ARRAY['commerce_order_confirmed']
      WHEN 'cancelled' THEN ARRAY['commerce_order_cancelled']
      WHEN 'completed' THEN ARRAY['commerce_order_completed']
      ELSE ARRAY['commerce_order_status_changed'] END
    WHEN entity = 'rental_reservation' THEN CASE to_status
      WHEN 'confirmed' THEN ARRAY['rental_confirmed']
      WHEN 'cancelled' THEN ARRAY['rental_cancelled']
      WHEN 'returned'  THEN ARRAY['rental_returned']
      ELSE ARRAY['rental_status_changed'] END
    ELSE CASE to_status
      WHEN 'checking_availability' THEN ARRAY['availability_check_started']
      WHEN 'alternatives_required' THEN ARRAY['alternative_required']
      WHEN 'awaiting_payment'      THEN ARRAY['availability_confirmed', 'payment_requested']
      WHEN 'confirmed' THEN
        CASE WHEN from_status IN ('awaiting_payment') THEN ARRAY['booking_confirmed']
             ELSE ARRAY['availability_confirmed', 'booking_confirmed'] END
      WHEN 'cancelled' THEN ARRAY['booking_cancelled']
      WHEN 'completed' THEN ARRAY['booking_completed']
      ELSE ARRAY['booking_status_changed'] END
  END
$$;

-- ─── 5. The recording trigger (history + events, same transaction) ───
CREATE OR REPLACE FUNCTION public.weemap_record_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity   TEXT  := TG_ARGV[0];
  actor    TEXT  := NULLIF(current_setting('weemap.actor', true), '');
  new_row  JSONB := to_jsonb(NEW);
  old_row  JSONB;
  base     JSONB;
  ev       TEXT;
BEGIN
  base := jsonb_strip_nulls(jsonb_build_object(
    'status',         new_row->>'status',
    'payment_status', new_row->>'payment_status',
    'customer_id',    new_row->>'customer_id',
    'reference',      COALESCE(new_row->>'reference', new_row->>'order_number'),
    'source',         new_row->>'source'
  ));

  IF TG_OP = 'INSERT' THEN
    INSERT INTO status_history (entity_type, entity_id, field, from_value, to_value, actor)
      VALUES (entity, NEW.id, 'status', NULL, new_row->>'status', actor);
    INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
      VALUES (weemap_created_event(entity), entity, NEW.id, base);
    -- Staff-entered bookings can be created already confirmed.
    IF new_row->>'status' = 'confirmed' THEN
      INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
        VALUES ('booking_confirmed', entity, NEW.id, base);
    END IF;
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);

  IF (new_row->>'status') IS DISTINCT FROM (old_row->>'status') THEN
    INSERT INTO status_history (entity_type, entity_id, field, from_value, to_value, actor)
      VALUES (entity, NEW.id, 'status', old_row->>'status', new_row->>'status', actor);
    FOREACH ev IN ARRAY weemap_status_events(entity, old_row->>'status', new_row->>'status') LOOP
      INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
        VALUES (ev, entity, NEW.id, base || jsonb_build_object('previous_status', old_row->>'status'));
    END LOOP;
  END IF;

  IF (new_row->>'payment_status') IS DISTINCT FROM (old_row->>'payment_status') THEN
    INSERT INTO status_history (entity_type, entity_id, field, from_value, to_value, actor)
      VALUES (entity, NEW.id, 'payment_status', old_row->>'payment_status', new_row->>'payment_status', actor);
    IF new_row->>'payment_status' IN ('partial', 'paid') THEN
      INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
        VALUES ('payment_received', entity, NEW.id,
                base || jsonb_strip_nulls(jsonb_build_object(
                  'previous_payment_status', old_row->>'payment_status',
                  'amount_paid', new_row->'amount_paid')));
    ELSIF new_row->>'payment_status' = 'refunded' THEN
      INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
        VALUES ('payment_refunded', entity, NEW.id, base);
    END IF;
  END IF;

  RETURN NEW;
END
$$;

-- Keep lifecycle timestamps honest without trusting every caller to set them.
CREATE OR REPLACE FUNCTION public.weemap_stamp_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, NOW());
  END IF;
  IF NEW.status = 'cancelled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := NOW();
  END IF;
  RETURN NEW;
END
$$;

DO $$
DECLARE
  spec TEXT[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['bookings',            'accommodation_booking'],
    ARRAY['trip_bookings',       'trip_booking'],
    ARRAY['experience_bookings', 'signature_request'],
    ARRAY['commerce_orders',     'commerce_order'],
    ARRAY['rental_reservations', 'rental_reservation']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS weemap_record_change ON public.%I', spec[1]);
    EXECUTE format(
      'CREATE TRIGGER weemap_record_change AFTER INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.weemap_record_request_change(%L)',
      spec[1], spec[2]);
  END LOOP;

  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['bookings'], ARRAY['trip_bookings'], ARRAY['experience_bookings']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS weemap_stamp_lifecycle ON public.%I', spec[1]);
    EXECUTE format(
      'CREATE TRIGGER weemap_stamp_lifecycle BEFORE INSERT OR UPDATE OF status ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.weemap_stamp_lifecycle()', spec[1]);
  END LOOP;
END $$;
