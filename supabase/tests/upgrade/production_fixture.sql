-- Production-shaped data for the M4 upgrade rehearsal, mirroring the row
-- counts and shapes the read-only preflight measured (2026-09-25):
--   13 customers; 4 bookings (2 accommodation-only, 2 package), all 'new',
--   unpaid, no payment channel, every one linked to a customer; 4 trip
--   bookings (3 'new', 1 'completed'), unpaid; 0 Signature requests;
--   0 shop/rent orders; 0 Supabase Auth users; no newsletter table.
-- Every value is synthetic — no production data is copied. LOCAL ONLY.
\set ON_ERROR_STOP 1

INSERT INTO public.customers (id, name, phone)
SELECT ('c1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       'Synthetic Customer ' || g, '+2010000' || lpad(g::text, 5, '0')
FROM generate_series(1, 13) g;

INSERT INTO public.accommodations (id, name_ar, name_en, type, is_active)
VALUES ('a1100000-0000-4000-8000-000000000001', 'إقامة تجريبية', 'Rehearsal Stay', 'camp', true);
INSERT INTO public.sinai_trips (id, name_ar, name_en, price, is_active)
VALUES ('a1200000-0000-4000-8000-000000000001', 'رحلة تجريبية', 'Rehearsal Trip', 900, true);
INSERT INTO public.trip_packages (id, slug, name_ar, name_en, is_active)
VALUES ('a1300000-0000-4000-8000-000000000001', 'rehearsal-package', 'باقة تجريبية', 'Rehearsal Package', true);

INSERT INTO public.bookings (id, customer_id, customer_name, customer_phone, booking_type, accommodation_id,
    total_price, status, payment_status, amount_paid)
SELECT ('b1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       ('c1000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       'Synthetic Customer ' || g, '+2010000' || lpad(g::text, 5, '0'),
       CASE WHEN g <= 2 THEN 'accommodation-only' ELSE 'package' END,
       'a1100000-0000-4000-8000-000000000001', 4000 + g * 100, 'new', 'unpaid', 0
FROM generate_series(1, 4) g;

INSERT INTO public.trip_bookings (id, customer_id, trip_id, trip_package_id, customer_name, customer_phone,
    num_people, quoted_price, status, payment_status, amount_paid, context)
SELECT ('b2000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       ('c1000000-0000-4000-8000-' || lpad((g + 4)::text, 12, '0'))::uuid,
       CASE WHEN g < 4 THEN 'a1200000-0000-4000-8000-000000000001'::uuid END,
       CASE WHEN g = 4 THEN 'a1300000-0000-4000-8000-000000000001'::uuid END,
       'Synthetic Customer ' || (g + 4), '+2010000' || lpad((g + 4)::text, 5, '0'),
       2, 1800, CASE WHEN g = 1 THEN 'completed' ELSE 'new' END, 'unpaid', 0,
       CASE WHEN g = 4 THEN 'package' ELSE 'standalone' END
FROM generate_series(1, 4) g;

-- Ask WEEMAP rows in production's own AI shape.
INSERT INTO public.ai_leads (session_id, name, whatsapp, locale, source, handoff_status, bot_enabled)
VALUES ('a1400000-0000-4000-8000-000000000001', 'Synthetic Lead', '+201000099999', 'ar', 'website_ai', 'human', false);
