-- fresh-launch-reset.sql -- DESTRUCTIVE. Run ONLY after explicit owner approval.
--
-- Purpose: remove test / self-test rows from production before the fresh launch, and nothing else.
--
-- Run fresh-launch-reset.audit.sql FIRST and compare it with the expected counts below. Run
-- fresh-launch-reset.verify.sql AFTER. This script fails closed: every guard RAISEs EXCEPTION and, because the
-- whole script is one transaction, nothing is changed unless every guard and every delete count matches.
--
-- Tiers (only Tier A is enabled; flip the constants at the top of the DO block to enable the others):
--   A  confirmed test data ("Test Reservation" customer, WR-2609-0001, its booking, 3 trip_bookings and one
--      5000.00 payment).                                                                        ENABLED
--   B  owner self-tests: 2 customers (761db732 is merged into 4e69d762 and is deleted first), 1 trip_booking,
--      14 ai_leads (ai_messages cascade).                                       DISABLED (include_tier_b = false)
--   C  4 staff test payment_records (net 0.00) on real customer booking dab5a8cd-244e-4453-9503-e058ba951e30.
--      Removes ONLY those 4 payment rows; the booking itself is kept.             DISABLED (include_tier_c = false)
--
-- Never touched: audit_log (the audit trigger will append 'delete' rows during this reset -- that is intended)
-- and every catalogue / configuration table.
--
-- Payment handling: payment_records is append-only (trigger weemap_payment_records_append_only, no bypass flag),
-- so the trigger is disabled and re-enabled inside this same transaction. bookings / trip_bookings are protected
-- by weemap_keep_paid_rows, bypassed with set_config('weemap.payment_maintenance', 'on', true).
-- status_history and domain_events have no FKs, so their rows are deleted explicitly by entity / aggregate id.
--
-- Recovery: there is none once COMMIT runs. Take a Supabase backup / PITR marker first. To rehearse, use the
-- ROLLBACK variant at the bottom of this file.

BEGIN;

DO $reset$
DECLARE
  -- ---- tier flags ----
  include_tier_b boolean := true;    -- owner-approved 2026-10-01

  include_tier_c boolean := false;

  -- ---- Tier A ----
  a_customers      uuid[] := array['7c5c23c2-f032-44b4-95b4-42eec12314a9']::uuid[];
  a_trip_requests  uuid[] := array['d4efee63-7701-47eb-8ca9-78ce7aa47c52']::uuid[];
  a_bookings       uuid[] := array['03bd02ac-46bf-4574-9e43-28769354eb13']::uuid[];
  a_trip_bookings  uuid[] := array[
    '1b98b879-f9fe-49d3-a142-a0f00c768fa6',
    '9efb8d5f-ed09-410a-b58d-89690476c242',
    'ea945fc7-b60f-44d9-b6a0-7cd4f027cde4']::uuid[];
  a_payments       uuid[] := array['1443e829-4185-403d-94ea-1e203dba19b1']::uuid[];

  -- ---- Tier B ----
  b_customers      uuid[] := array[
    '761db732-07fd-4821-b88e-bfeff1de9a09',   -- merged into 4e69d762, listed first
    '4e69d762-366b-4f44-8b3b-31dcc797f478']::uuid[];
  b_trip_bookings  uuid[] := array['c5541256-e2d4-4dee-bf0d-2978a6c26f94']::uuid[];
  b_ai_leads       uuid[] := array[
    '06e821b9-ff52-485c-9e99-f691123e5a96', 'cebccc05-b0aa-4552-ae61-dc545a5fc8b8',
    'ed230852-4ae8-4971-bbf4-c109e9d880b5', '96aa47d3-6225-4b63-8ad9-b2604b6db48c',
    '2ce23240-6c33-4411-ba8c-00c867998ef1', 'e71adb24-4bc9-4e38-8c8b-141e7e047837',
    'bbc4951f-39c3-4f6d-9f85-34b31c424e82', '71e3d9bd-3f1c-432e-bd82-145302c630a0',
    '686fecd3-9152-4c28-a9ff-fe76330320c6', '3cd555dc-e06b-415c-aeff-28b19f639818',
    'f0d146d3-af3d-4f2b-886f-1fc4ba5a2a53', '8c52ce49-629c-4cf1-8628-1d516f8046db',
    '6ddb2d6a-caa9-4bfe-b692-17f59e96db15', '53a5fdd1-f50f-486b-b319-543ba224465b']::uuid[];

  -- ---- Tier C ----
  c_booking        uuid   := 'dab5a8cd-244e-4453-9503-e058ba951e30';
  c_payments       uuid[] := array[
    'ed57f276-fd7d-4a72-8477-cfbba77af351', '3f957a4c-b174-4b2c-9da1-b56eba85539f',
    '9678d1f3-17a8-4ea9-83df-53ce0403d01c', '6b780e68-ada0-45af-a72e-4686a0fc68f7']::uuid[];

  -- ---- effective delete lists (built below from the enabled tiers) ----
  del_customers      uuid[] := '{}';
  del_trip_requests  uuid[] := '{}';
  del_bookings       uuid[] := '{}';
  del_trip_bookings  uuid[] := '{}';
  del_payments       uuid[] := '{}';
  del_leads          uuid[] := '{}';
  del_entity_text    text[];          -- every deleted entity id, as text, for status_history / domain_events
  del_booking_text   text[];          -- booking + trip_booking ids, as text, for payment_records.entity_id

  r        record;
  j        jsonb;
  n        bigint;
  expected bigint;
  nm       text;
  amt      numeric;

  -- ---- recovery snapshot (counts proven by the 2026-10-01 rolled-back dry run) ----
  snap_ts                timestamptz;
  snap_lsn               text;
  snap_scope             text   := 'fresh-launch-reset v2: Tier A + Tier B, owner-approved 2026-10-01';
  snap_expected_messages bigint := 463;   -- ai_messages of the 14 Tier B leads (cascade)
  snap_expected_history  bigint := 11;    -- status_history rows of deleted entities
  snap_expected_events   bigint := 15;    -- domain_events rows of deleted entities
BEGIN
  -- ============================================================ build lists
  del_customers     := a_customers;
  del_trip_requests := a_trip_requests;
  del_bookings      := a_bookings;
  del_trip_bookings := a_trip_bookings;
  del_payments      := a_payments;

  IF include_tier_b THEN
    del_customers     := del_customers || b_customers;
    del_trip_bookings := del_trip_bookings || b_trip_bookings;
    del_leads         := b_ai_leads;
  END IF;
  IF include_tier_c THEN
    del_payments := del_payments || c_payments;
  END IF;

  del_booking_text := array(select x::text from unnest(del_bookings || del_trip_bookings) x);
  del_entity_text  := array(select x::text
                            from unnest(del_customers || del_trip_requests || del_bookings || del_trip_bookings) x);

  RAISE NOTICE 'fresh-launch-reset: tier A on, tier B %, tier C %', include_tier_b, include_tier_c;

  -- ============================================================ GUARDS (fail closed)

  -- G1. schema assumptions for the id-based deletes and the payment sum.
  FOR r IN SELECT * FROM (VALUES
      ('status_history', 'entity_id'), ('domain_events', 'aggregate_id'),
      ('payment_records', 'entity_id'), ('payment_records', 'amount')) AS v(t, c)
  LOOP
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.t AND column_name = r.c;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'guard G1: column public.%.% does not exist; schema changed since audit', r.t, r.c;
    END IF;
  END LOOP;

  -- G2. every id of every enabled tier exists (exact expected count per table).
  FOR r IN SELECT * FROM (VALUES
      ('customers', del_customers), ('trip_requests', del_trip_requests), ('bookings', del_bookings),
      ('trip_bookings', del_trip_bookings), ('payment_records', del_payments), ('ai_leads', del_leads)
    ) AS v(t, ids)
  LOOP
    expected := coalesce(cardinality(r.ids), 0);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id = ANY($1)', r.t) INTO n USING r.ids;
    IF n <> expected THEN
      RAISE EXCEPTION 'guard G2: % has % of the % expected target rows', r.t, n, expected;
    END IF;
  END LOOP;

  -- G3. the Tier A customer really is the test identity.
  SELECT to_jsonb(c) INTO j FROM public.customers c WHERE c.id = a_customers[1];
  nm := coalesce(j->>'name', j->>'full_name');
  IF lower(coalesce(j->>'email', '')) IS DISTINCT FROM 'test@example.com'
     OR nm IS DISTINCT FROM 'Test Reservation' THEN
    RAISE EXCEPTION 'guard G3: Tier A customer is not test@example.com / Test Reservation (email=%, name=%)',
      j->>'email', nm;
  END IF;

  -- G3b. Tier B rows really are the owner's own test identity or synthetic chatbot leads.
  IF include_tier_b THEN
    SELECT count(*) INTO n FROM public.customers c
     WHERE c.id = ANY (b_customers)
       AND lower(coalesce(c.email, '')) = 'adhamm.3bdallah@gmail.com'
       AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%1558588664';
    IF n <> cardinality(b_customers) THEN
      RAISE EXCEPTION 'guard G3b: only % of % Tier B customers are the owner identity', n, cardinality(b_customers);
    END IF;

    SELECT count(*) INTO n FROM public.trip_bookings t
     WHERE t.id = ANY (b_trip_bookings) AND t.customer_id = ANY (b_customers);
    IF n <> cardinality(b_trip_bookings) THEN
      RAISE EXCEPTION 'guard G3b: Tier B trip_booking does not belong to the owner customer';
    END IF;

    SELECT count(*) INTO n FROM public.ai_leads l
     WHERE l.id = ANY (b_ai_leads)
       AND (lower(coalesce(l.email, '')) = 'adhamm.3bdallah@gmail.com'
            OR l.whatsapp = '+201558588664'
            OR l.name ~* '(regression|^test( user| test)?$|^tessst$)');
    IF n <> cardinality(b_ai_leads) THEN
      RAISE EXCEPTION 'guard G3b: only % of % Tier B ai_leads match owner/synthetic identities',
        n, cardinality(b_ai_leads);
    END IF;
  END IF;

  -- G4. no payment on a booking / trip_booking being deleted is missing from the payment delete list.
  SELECT count(*) INTO n FROM public.payment_records p
   WHERE p.entity_id::text = ANY (del_booking_text) AND NOT (p.id = ANY (del_payments));
  IF n <> 0 THEN
    RAISE EXCEPTION 'guard G4: % payment_records row(s) reference a deleted booking but are not in the delete list', n;
  END IF;

  -- G5. payment ids: Tier A is exactly 1 row / 5000.00 on the Tier A booking; Tier C is exactly 4 rows on c_booking.
  SELECT count(*), coalesce(sum(p.amount), 0) INTO n, amt
    FROM public.payment_records p WHERE p.id = ANY (a_payments);
  IF n <> 1 OR amt <> 5000.00 THEN
    RAISE EXCEPTION 'guard G5: Tier A payments are % row(s) totalling %, expected 1 row totalling 5000.00', n, amt;
  END IF;
  SELECT count(*) INTO n FROM public.payment_records p
   WHERE p.id = ANY (a_payments) AND p.entity_id::text = a_bookings[1]::text;
  IF n <> 1 THEN
    RAISE EXCEPTION 'guard G5: Tier A payment does not belong to the Tier A booking';
  END IF;
  IF include_tier_c THEN
    SELECT count(*) INTO n FROM public.payment_records p
     WHERE p.id = ANY (c_payments) AND p.entity_id::text = c_booking::text;
    IF n <> 4 THEN
      RAISE EXCEPTION 'guard G5: only % of the 4 Tier C payments belong to booking %', n, c_booking;
    END IF;
  END IF;

  -- G6. nothing outside the delete lists still points at a customer being deleted.
  SELECT count(*) INTO n FROM public.bookings b
   WHERE b.customer_id = ANY (del_customers) AND NOT (b.id = ANY (del_bookings));
  IF n <> 0 THEN RAISE EXCEPTION 'guard G6: % other booking(s) reference a deleted customer', n; END IF;

  SELECT count(*) INTO n FROM public.trip_bookings t
   WHERE t.customer_id = ANY (del_customers) AND NOT (t.id = ANY (del_trip_bookings));
  IF n <> 0 THEN RAISE EXCEPTION 'guard G6: % other trip_booking(s) reference a deleted customer', n; END IF;

  SELECT count(*) INTO n FROM public.trip_requests t
   WHERE t.customer_id = ANY (del_customers) AND NOT (t.id = ANY (del_trip_requests));
  IF n <> 0 THEN RAISE EXCEPTION 'guard G6: % other trip_request(s) reference a deleted customer', n; END IF;

  SELECT count(*) INTO n FROM public.commerce_orders o WHERE o.customer_id = ANY (del_customers);
  IF n <> 0 THEN RAISE EXCEPTION 'guard G6: % commerce_order(s) reference a deleted customer', n; END IF;

  SELECT count(*) INTO n FROM public.experience_bookings e WHERE e.customer_id = ANY (del_customers);
  IF n <> 0 THEN RAISE EXCEPTION 'guard G6: % experience_booking(s) reference a deleted customer', n; END IF;

  SELECT count(*) INTO n FROM public.customers c
   WHERE c.merged_into = ANY (del_customers) AND NOT (c.id = ANY (del_customers));
  IF n <> 0 THEN RAISE EXCEPTION 'guard G6: % other customer(s) are merged into a deleted customer', n; END IF;

  -- G7. table totals still match the audit (data has not changed since it was taken).
  FOR r IN SELECT * FROM (VALUES
      ('customers', 14), ('bookings', 5), ('trip_bookings', 7),
      ('trip_requests', 1), ('payment_records', 5), ('ai_leads', 25),
      ('ai_messages', 539), ('status_history', 30), ('domain_events', 41)) AS v(t, expected_rows)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO n;
    IF n <> r.expected_rows THEN
      RAISE EXCEPTION 'guard G7: % has % rows, audit expected % (data changed since audit)',
        r.t, n, r.expected_rows;
    END IF;
  END LOOP;

  -- ============================================================ RECOVERY SNAPSHOT (owner-approved, option 2)
  -- Every row this reset removes is copied first into maintenance.flr_20261001_<table> (same column types via
  -- LIKE), with a manifest row recording UTC time, WAL LSN, scope and counts. CREATE TABLE has no IF NOT EXISTS:
  -- if a snapshot from an earlier run exists, the whole reset aborts instead of mixing snapshots.
  -- Restore procedure: fresh-launch-reset.restore.sql (do not run without owner approval).
  snap_ts  := clock_timestamp();
  snap_lsn := pg_current_wal_lsn()::text;

  EXECUTE 'CREATE SCHEMA IF NOT EXISTS maintenance';
  EXECUTE 'REVOKE ALL ON SCHEMA maintenance FROM PUBLIC, anon, authenticated';
  EXECUTE 'CREATE TABLE maintenance.flr_20261001_manifest (table_name text PRIMARY KEY, expected_rows bigint NOT NULL,
             snapshot_rows bigint NOT NULL, captured_at timestamptz NOT NULL, wal_lsn text NOT NULL, scope text NOT NULL)';

  FOR r IN SELECT * FROM (VALUES
      ('customers',       'id = ANY ($1)',                                     1, cardinality(del_customers)::bigint),
      ('trip_requests',   'id = ANY ($2)',                                     2, cardinality(del_trip_requests)::bigint),
      ('bookings',        'id = ANY ($3)',                                     3, cardinality(del_bookings)::bigint),
      ('trip_bookings',   'id = ANY ($4)',                                     4, cardinality(del_trip_bookings)::bigint),
      ('payment_records', 'id = ANY ($5)',                                     5, cardinality(del_payments)::bigint),
      ('ai_leads',        'id = ANY ($6)',                                     6, coalesce(cardinality(del_leads), 0)::bigint),
      ('ai_messages',     'session_id IN (SELECT l.session_id FROM public.ai_leads l WHERE l.id = ANY ($6))',
                                                                               6, snap_expected_messages),
      ('status_history',  'entity_id::text = ANY ($7)',                        7, snap_expected_history),
      ('domain_events',   'aggregate_id::text = ANY ($7)',                     7, snap_expected_events)
    ) AS v(t, cond, argn, expected_rows)
  LOOP
    EXECUTE format('CREATE TABLE maintenance.%I (LIKE public.%I)', 'flr_20261001_' || r.t, r.t);
    EXECUTE format('INSERT INTO maintenance.%I SELECT * FROM public.%I WHERE %s', 'flr_20261001_' || r.t, r.t, r.cond)
      USING del_customers, del_trip_requests, del_bookings, del_trip_bookings, del_payments, del_leads, del_entity_text;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> r.expected_rows THEN
      RAISE EXCEPTION 'snapshot: % captured % rows, approved delete set is %', r.t, n, r.expected_rows;
    END IF;
    INSERT INTO maintenance.flr_20261001_manifest VALUES (r.t, r.expected_rows, n, snap_ts, snap_lsn, snap_scope);
  END LOOP;

  -- Identity re-check: the snapshot holds exactly the approved ids, nothing else.
  FOR r IN SELECT * FROM (VALUES
      ('customers', del_customers), ('trip_requests', del_trip_requests), ('bookings', del_bookings),
      ('trip_bookings', del_trip_bookings), ('payment_records', del_payments), ('ai_leads', del_leads)) AS v(t, ids)
  LOOP
    EXECUTE format('SELECT count(*) FROM maintenance.%I WHERE NOT (id = ANY ($1))', 'flr_20261001_' || r.t)
      INTO n USING r.ids;
    IF n <> 0 THEN RAISE EXCEPTION 'snapshot: % holds % row(s) outside the approved ids', r.t, n; END IF;
  END LOOP;
  SELECT count(*) INTO n FROM maintenance.flr_20261001_payment_records WHERE id = ANY (c_payments);
  IF n <> 0 THEN RAISE EXCEPTION 'snapshot: Tier C payment rows were captured; Tier C must be untouched'; END IF;
  RAISE NOTICE 'snapshot taken at % (WAL %)', snap_ts, snap_lsn;

  -- ============================================================ DELETES

  PERFORM set_config('weemap.payment_maintenance', 'on', true);   -- bypass weemap_keep_paid_rows (this txn only)

  -- payment_records (append-only trigger off, then straight back on)
  ALTER TABLE public.payment_records DISABLE TRIGGER weemap_payment_records_append_only;
  DELETE FROM public.payment_records WHERE id = ANY (del_payments);
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.payment_records ENABLE TRIGGER weemap_payment_records_append_only;
  IF n <> cardinality(del_payments) THEN
    RAISE EXCEPTION 'payment_records: deleted % rows, expected %', n, cardinality(del_payments);
  END IF;

  -- status_history / domain_events (no FKs; counts are informational only)
  DELETE FROM public.status_history WHERE entity_id::text = ANY (del_entity_text);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> snap_expected_history THEN
    RAISE EXCEPTION 'status_history: deleted % rows, expected %', n, snap_expected_history;
  END IF;

  DELETE FROM public.domain_events WHERE aggregate_id::text = ANY (del_entity_text);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> snap_expected_events THEN
    RAISE EXCEPTION 'domain_events: deleted % rows, expected %', n, snap_expected_events;
  END IF;

  -- trip_bookings
  DELETE FROM public.trip_bookings WHERE id = ANY (del_trip_bookings);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> cardinality(del_trip_bookings) THEN
    RAISE EXCEPTION 'trip_bookings: deleted % rows, expected %', n, cardinality(del_trip_bookings);
  END IF;

  -- bookings
  DELETE FROM public.bookings WHERE id = ANY (del_bookings);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> cardinality(del_bookings) THEN
    RAISE EXCEPTION 'bookings: deleted % rows, expected %', n, cardinality(del_bookings);
  END IF;

  -- trip_requests
  DELETE FROM public.trip_requests WHERE id = ANY (del_trip_requests);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> cardinality(del_trip_requests) THEN
    RAISE EXCEPTION 'trip_requests: deleted % rows, expected %', n, cardinality(del_trip_requests);
  END IF;

  -- ai_leads (Tier B; ai_messages cascade, ai_training_notes.related_session_id is set to NULL)
  IF include_tier_b THEN
    DELETE FROM public.ai_leads WHERE id = ANY (del_leads);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> cardinality(del_leads) THEN
      RAISE EXCEPTION 'ai_leads: deleted % rows, expected %', n, cardinality(del_leads);
    END IF;
    SELECT count(*) INTO n FROM public.ai_messages;
    IF n <> 539 - snap_expected_messages THEN
      RAISE EXCEPTION 'ai_messages: % remain after cascade, expected %', n, 539 - snap_expected_messages;
    END IF;
  END IF;

  -- customers: merged (child) rows first, because customers.merged_into is NO ACTION
  DELETE FROM public.customers WHERE id = ANY (del_customers) AND merged_into IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  expected := n;
  DELETE FROM public.customers WHERE id = ANY (del_customers);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF expected + n <> cardinality(del_customers) THEN
    RAISE EXCEPTION 'customers: deleted % rows, expected %', expected + n, cardinality(del_customers);
  END IF;

  -- ============================================================ final self-checks
  PERFORM 1 FROM pg_trigger
   WHERE tgrelid = 'public.payment_records'::regclass
     AND tgname = 'weemap_payment_records_append_only' AND tgenabled = 'O';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'append-only trigger on payment_records is not enabled at the end of the reset';
  END IF;

  RAISE NOTICE 'fresh-launch-reset: all guards and delete counts matched';
END
$reset$;

-- ---------------------------------------------------------------------------------------------------------------
-- Finish the transaction.
-- OPERATORS: for a DRY RUN, replace COMMIT with ROLLBACK (the guards and delete counts still run in full, then
-- everything is undone). Dry-run variant, uncomment this and comment out COMMIT:
-- ROLLBACK;
COMMIT;
