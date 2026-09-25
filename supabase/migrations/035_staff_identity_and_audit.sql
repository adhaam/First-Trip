-- 035_staff_identity_and_audit.sql
-- Individual staff identity, actor attribution and an audit log (WEEMAP V2 · M3).
--
-- WHY
--   The admin used one shared password, so status_history.actor was always
--   NULL: nobody could tell who confirmed a booking, recorded a payment or
--   changed a price. The Operations Center needs named staff, a small role
--   model, revocable access and an audit trail that cannot drift from the data.
--
-- CONTRACT
--   * staff_users: one row per person. Passwords are stored only as scrypt
--     hashes produced by src/lib/staff-password.ts. Roles (small on purpose):
--       owner       everything, including staff management
--       admin       everything except staff management
--       operations  operational work (requests, bookings, payments, customers,
--                   transport exceptions); catalogue and settings read-only
--     The authorisation matrix itself lives in src/lib/staff-policy.ts and is
--     enforced server-side on every admin API call.
--   * Revocation: session_version is bumped by trigger whenever a person is
--     disabled, their role changes or their password changes. Session cookies
--     carry the version they were issued with, so every older session stops
--     working on its next request — no session table needed.
--   * There is always at least one active owner (trigger-enforced), so the
--     Operations Center can never lock itself out.
--   * Actor: weemap_current_actor() resolves who is acting, in this order:
--       1. set_config('weemap.actor', …, true) inside a transaction (SQL/RPC);
--       2. the `x-weemap-actor` request header PostgREST exposes — trusted
--          ONLY when the request is authenticated as service_role (the
--          server). Anonymous/public requests can never claim an actor.
--     Format: 'staff:<uuid>' or 'legacy-admin' (the pre-M3 shared password,
--     only honoured while no owner account exists). NULL = the customer /
--     website / system.
--   * weemap_record_request_change() (migration 031) now records that actor in
--     status_history and adds it to the domain-event payload (an identifier,
--     never contact data).
--   * audit_log: one row per catalogue / pricing / configuration / staff change
--     and per operational field edit on request tables (status and payment
--     status changes stay in status_history). Written by trigger in the same
--     transaction. Long text values are summarised, secrets are redacted.
--
-- Additive only. Safe to re-run.

-- ─── 1. Staff ───
CREATE TABLE IF NOT EXISTS public.staff_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operations')),
  password_hash    TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  session_version  INTEGER NOT NULL DEFAULT 1,
  last_login_at    TIMESTAMPTZ,
  created_by       UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_users_email_normalised CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  CONSTRAINT staff_users_name_present CHECK (length(btrim(display_name)) > 0),
  CONSTRAINT staff_users_hash_format CHECK (password_hash LIKE 'scrypt$%')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_users_email ON public.staff_users (email);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_users_service_role_all" ON public.staff_users;
CREATE POLICY "staff_users_service_role_all" ON public.staff_users
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_staff_users_updated_at ON public.staff_users;
CREATE TRIGGER update_staff_users_updated_at BEFORE UPDATE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Revoke every existing session when access-relevant fields change.
CREATE OR REPLACE FUNCTION public.weemap_staff_bump_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.session_version := OLD.session_version + 1;
  ELSE
    NEW.session_version := OLD.session_version;
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS weemap_staff_bump_session ON public.staff_users;
CREATE TRIGGER weemap_staff_bump_session BEFORE UPDATE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.weemap_staff_bump_session();

-- Never remove the last active owner.
CREATE OR REPLACE FUNCTION public.weemap_staff_keep_owner()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' AND OLD.is_active
     AND (TG_OP = 'DELETE' OR NOT NEW.is_active OR NEW.role <> 'owner')
     AND NOT EXISTS (
       SELECT 1 FROM public.staff_users
        WHERE role = 'owner' AND is_active AND id <> OLD.id) THEN
    RAISE EXCEPTION 'At least one active owner must remain'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS weemap_staff_keep_owner ON public.staff_users;
CREATE TRIGGER weemap_staff_keep_owner BEFORE UPDATE OR DELETE ON public.staff_users
  FOR EACH ROW EXECUTE FUNCTION public.weemap_staff_keep_owner();

-- ─── 2. Who is acting ───
CREATE OR REPLACE FUNCTION public.weemap_current_actor()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  actor    TEXT := NULLIF(current_setting('weemap.actor', true), '');
  jwt_role TEXT;
  headers  JSON;
BEGIN
  -- The JWT role is verified by PostgREST before these settings exist; read it
  -- directly (both GUC spellings) because current_user is the definer here.
  BEGIN
    jwt_role := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
                         NULLIF(current_setting('request.jwt.claims', true), '')::json->>'role');
  EXCEPTION WHEN others THEN
    jwt_role := NULL;
  END;
  IF actor IS NULL AND jwt_role = 'service_role' THEN
    BEGIN
      headers := NULLIF(current_setting('request.headers', true), '')::json;
      actor := headers->>'x-weemap-actor';
    EXCEPTION WHEN others THEN
      actor := NULL;
    END;
  END IF;
  IF actor IS NULL
     OR actor !~ '^(staff:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|legacy-admin)$' THEN
    RETURN NULL;
  END IF;
  RETURN actor;
END
$$;

COMMENT ON FUNCTION public.weemap_current_actor() IS
  'staff:<uuid> | legacy-admin | NULL (customer/website/system). Header only trusted for service_role.';

-- ─── 3. Request history + events now carry the actor (replaces 031 body) ───
CREATE OR REPLACE FUNCTION public.weemap_record_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  entity   TEXT  := TG_ARGV[0];
  actor    TEXT  := public.weemap_current_actor();
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
    'source',         new_row->>'source',
    'trip_request_id', new_row->>'trip_request_id',
    'actor',          actor
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

-- ─── 4. Audit log ───
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor       TEXT,
  table_name  TEXT NOT NULL,
  row_id      TEXT,
  action      TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changes     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_log_row   ON public.audit_log (table_name, row_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_time  ON public.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (actor, occurred_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_service_role_read" ON public.audit_log;
CREATE POLICY "audit_log_service_role_read" ON public.audit_log
  FOR SELECT USING (auth.role() = 'service_role');
-- No INSERT/UPDATE/DELETE policy: only the SECURITY DEFINER trigger writes it.

-- Summarise one value for the log: long text is not copied, secrets never are.
CREATE OR REPLACE FUNCTION public.weemap_audit_value(col TEXT, val JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN col IN ('password_hash') THEN to_jsonb('[redacted]'::text)
    WHEN jsonb_typeof(val) = 'string' AND length(val #>> '{}') > 280
      THEN to_jsonb('[text: ' || length(val #>> '{}') || ' chars]')
    WHEN jsonb_typeof(val) IN ('array', 'object') AND length(val::text) > 1200
      THEN to_jsonb('[json: ' || length(val::text) || ' chars]')
    ELSE val
  END
$$;

CREATE OR REPLACE FUNCTION public.weemap_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  old_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  row_ref JSONB := COALESCE(new_row, old_row);
  changes JSONB := '{}'::jsonb;
  k       TEXT;
BEGIN
  FOR k IN SELECT jsonb_object_keys(row_ref) LOOP
    CONTINUE WHEN k IN ('updated_at', 'created_at', 'session_version', 'last_login_at',
                      'total_bookings', 'last_booking_at', 'last_activity_at');
    IF TG_OP = 'UPDATE' THEN
      -- status / payment_status on request tables already live in status_history.
      CONTINUE WHEN TG_NARGS > 0 AND TG_ARGV[0] = 'request' AND k IN ('status', 'payment_status',
        'confirmed_at', 'cancelled_at');
      IF (new_row->k) IS DISTINCT FROM (old_row->k) THEN
        changes := changes || jsonb_build_object(k, jsonb_build_array(
          weemap_audit_value(k, old_row->k), weemap_audit_value(k, new_row->k)));
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      IF (new_row->k) IS NOT NULL AND (new_row->k) <> 'null'::jsonb THEN
        changes := changes || jsonb_build_object(k, weemap_audit_value(k, new_row->k));
      END IF;
    END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' AND changes = '{}'::jsonb THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN
    changes := jsonb_strip_nulls(jsonb_build_object(
      'name_en', old_row->'name_en', 'name', old_row->'name', 'title_en', old_row->'title_en',
      'email', old_row->'email', 'code', old_row->'code'));
  END IF;

  INSERT INTO audit_log (actor, table_name, row_id, action, changes)
  VALUES (
    weemap_current_actor(),
    TG_TABLE_NAME,
    COALESCE(row_ref->>'id', row_ref->>'code', row_ref->>'transfer_type', row_ref->>'booking_kind',
             row_ref->>'slug', row_ref->>'governorate_code'),
    lower(TG_OP),
    changes);
  RETURN NULL;
END
$$;

-- Catalogue, pricing, configuration and staff: every insert/update/delete.
-- Request tables: field edits and deletes (creation and status live in 031).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accommodations', 'accommodation_room_upgrades', 'accommodation_seasonal_rates',
    'sinai_trips', 'sinai_trip_category_tags', 'trip_categories', 'trip_dates',
    'trip_packages', 'trip_package_items', 'trip_package_categories',
    'experiences', 'experience_dates', 'experience_categories', 'experience_partners',
    'experience_partner_links', 'experience_trips',
    'commerce_products', 'commerce_product_variants', 'commerce_product_options',
    'commerce_product_option_values', 'commerce_categories', 'commerce_collections',
    'commerce_product_collections', 'rental_pricing_tiers', 'rental_availability_blocks',
    'delivery_zones', 'commerce_settings',
    'community_posts', 'testimonials', 'site_settings',
    'transfer_settings', 'transfer_governorate_pricing', 'governorate_pricing',
    'transport_weekly_rules', 'transport_date_exceptions', 'stay_patterns',
    'payment_policies', 'payment_methods', 'staff_users'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS weemap_audit ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER weemap_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.weemap_audit_change()', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'bookings', 'trip_bookings', 'experience_bookings', 'commerce_orders',
    'rental_reservations', 'trip_requests', 'customers'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS weemap_audit ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER weemap_audit AFTER UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.weemap_audit_change(%L)', t, 'request');
  END LOOP;
END $$;
