-- fresh-launch-reset.audit.sql — READ ONLY.
--
-- Run before fresh-launch-reset.sql. It changes nothing. It shows:
--   1. row counts for every operational / customer-history table that exists;
--   2. every customer identity currently on file;
--   3. every payment_records row and the booking it belongs to;
--   4. every live foreign key that points at an operational table, with its
--      delete rule, so the reset's delete order can be checked against reality;
--   5. row counts for catalogue / configuration tables the reset must NOT touch
--      (baseline for fresh-launch-reset.verify.sql).
--
-- Tables that do not exist in this database are reported as NULL, not errors.

-- ─── 1. Operational row counts ───
WITH ops(t) AS (VALUES
  ('customers'), ('trip_requests'), ('bookings'), ('trip_bookings'),
  ('experience_bookings'), ('edition_requests'), ('payment_records'),
  ('status_history'), ('domain_events'), ('partner_inquiries'),
  ('commerce_orders'), ('commerce_order_items'), ('rental_reservations'),
  ('rental_availability_blocks'), ('newsletter_subscribers'),
  ('ai_leads'), ('ai_messages'), ('staff_login_throttle'), ('audit_log')
)
SELECT o.t AS table_name,
       CASE WHEN to_regclass('public.' || o.t) IS NULL THEN NULL
            ELSE (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM public.%I', o.t), false, true, '')))[1]::text::bigint
       END AS row_count
FROM ops o
ORDER BY 1;

-- ─── 2. Customer identities ───
SELECT * FROM public.customers ORDER BY created_at;

-- ─── 3. Payment ledger with owning entity ───
-- owner_row is the whole owning booking row, whatever its columns are.
SELECT p.*,
       COALESCE(to_jsonb(b), to_jsonb(tb), to_jsonb(eb)) AS owner_row
FROM public.payment_records p
LEFT JOIN public.bookings            b  ON p.entity_type = 'bookings'            AND b.id  = p.entity_id
LEFT JOIN public.trip_bookings       tb ON p.entity_type = 'trip_bookings'       AND tb.id = p.entity_id
LEFT JOIN public.experience_bookings eb ON p.entity_type = 'experience_bookings' AND eb.id = p.entity_id
ORDER BY p.received_at;

-- ─── 4. Live foreign keys touching operational tables ───
SELECT con.conrelid::regclass  AS child_table,
       a.attname               AS child_column,
       con.confrelid::regclass AS parent_table,
       CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
WHERE con.contype = 'f'
  AND con.connamespace = 'public'::regnamespace
ORDER BY 3, 1;

-- ─── 5. Preserved-table baseline ───
WITH keep(t) AS (VALUES
  ('accommodations'), ('accommodation_room_upgrades'), ('accommodation_seasonal_rates'),
  ('sinai_trips'), ('trip_packages'), ('trip_package_items'), ('trip_package_categories'),
  ('trip_categories'), ('experiences'), ('experience_dates'), ('experience_partners'),
  ('editions'), ('community_posts'), ('site_pages'), ('site_settings'),
  ('transport_weekly_rules'), ('transport_date_exceptions'), ('payment_policies'),
  ('payment_methods'), ('staff_users'), ('commerce_products'), ('commerce_product_variants'),
  ('commerce_categories'), ('commerce_collections'), ('commerce_settings'), ('delivery_zones'),
  ('rental_pricing_tiers'), ('stay_patterns')
)
SELECT k.t AS table_name,
       CASE WHEN to_regclass('public.' || k.t) IS NULL THEN NULL
            ELSE (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM public.%I', k.t), false, true, '')))[1]::text::bigint
       END AS row_count
FROM keep k
ORDER BY 1;
