-- fresh-launch-reset.verify.sql -- READ ONLY.
--
-- Run AFTER fresh-launch-reset.sql. It changes nothing. Every row is (check_name, expected, actual, ok); every
-- ok must be true. The expected counts below assume ONLY Tier A was reset.
--
-- If Tier B was also enabled, change the expected values to:
--   customers = 11, trip_bookings = 3, ai_leads = 11
-- If Tier C was also enabled, change the expected value to:
--   payment_records = 0
-- (A table that does not exist is reported with actual NULL and ok = false.)

WITH expected_counts(check_name, tbl, expected) AS (VALUES
  -- preserved catalogue / configuration tables (must be unchanged)
  ('preserved: accommodations',        'accommodations',        25),
  ('preserved: sinai_trips',           'sinai_trips',           19),
  ('preserved: trip_packages',         'trip_packages',         5),
  ('preserved: editions',              'editions',              6),
  ('preserved: community_posts',       'community_posts',       30),
  ('preserved: site_pages',            'site_pages',            9),
  ('preserved: site_settings',         'site_settings',         1),
  ('preserved: transport_weekly_rules', 'transport_weekly_rules', 4),
  ('preserved: payment_policies',      'payment_policies',      5),
  ('preserved: payment_methods',       'payment_methods',       4),
  ('preserved: staff_users',           'staff_users',           2),
  ('preserved: trip_package_items',    'trip_package_items',    21),
  ('preserved: trip_categories',       'trip_categories',       8),
  ('preserved: stay_patterns',         'stay_patterns',         4),
  -- remaining operational rows after a Tier-A-only reset
  ('remaining: customers',             'customers',             11),   -- Tier A + B
  ('remaining: bookings',              'bookings',              4),
  ('remaining: trip_bookings',         'trip_bookings',         3),    -- Tier A + B
  ('remaining: trip_requests',         'trip_requests',         0),
  ('remaining: payment_records',       'payment_records',       4),    -- Tier C on: 0
  ('remaining: ai_leads',              'ai_leads',              11)    -- Tier A + B
),
counted AS (
  SELECT e.check_name,
         e.expected::bigint AS expected,
         CASE WHEN to_regclass('public.' || e.tbl) IS NULL THEN NULL
              ELSE (xpath('/row/c/text()',
                    query_to_xml(format('SELECT count(*) AS c FROM public.%I', e.tbl),
                                 false, true, '')))[1]::text::bigint
         END AS actual
  FROM expected_counts e
)
SELECT check_name, expected, actual, coalesce(actual = expected, false) AS ok
FROM counted

UNION ALL
SELECT 'absent: Tier A customer', 0, count(*), count(*) = 0
FROM public.customers WHERE id = '7c5c23c2-f032-44b4-95b4-42eec12314a9'

UNION ALL
SELECT 'absent: Tier A trip_request', 0, count(*), count(*) = 0
FROM public.trip_requests WHERE id = 'd4efee63-7701-47eb-8ca9-78ce7aa47c52'

UNION ALL
SELECT 'absent: Tier A booking', 0, count(*), count(*) = 0
FROM public.bookings WHERE id = '03bd02ac-46bf-4574-9e43-28769354eb13'

UNION ALL
SELECT 'absent: Tier A trip_bookings', 0, count(*), count(*) = 0
FROM public.trip_bookings
WHERE id IN ('1b98b879-f9fe-49d3-a142-a0f00c768fa6',
             '9efb8d5f-ed09-410a-b58d-89690476c242',
             'ea945fc7-b60f-44d9-b6a0-7cd4f027cde4')

UNION ALL
SELECT 'absent: Tier A payment_record', 0, count(*), count(*) = 0
FROM public.payment_records WHERE id = '1443e829-4185-403d-94ea-1e203dba19b1'

UNION ALL
SELECT 'enabled: payment_records append-only trigger', 1, count(*), count(*) = 1
FROM pg_trigger
WHERE tgrelid = 'public.payment_records'::regclass
  AND tgname = 'weemap_payment_records_append_only'
  AND tgenabled = 'O'

ORDER BY 1;
