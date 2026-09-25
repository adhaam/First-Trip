-- ═══════════════════════════════════════════════════════════════════════════
-- LOCAL ACCEPTANCE FIXTURES — NEVER APPLY TO PRODUCTION
-- ───────────────────────────────────────────────────────────────────────────
-- Realistic, bilingual (Arabic + English) fixture data for browser acceptance
-- testing of the WEEMAP SINAI site against a disposable local Postgres +
-- PostgREST stack (scripts/local-stack/up.sh). Every id below is a FIXED
-- UUID so this file is deterministic and safe to re-run: it starts by
-- truncating (CASCADE) only the tables it fully owns, then re-inserts.
--
-- Deliberately NOT truncated (owned by the migration chain, not this file):
--   trip_categories, stay_patterns, transfer_settings,
--   transfer_governorate_pricing, governorate_pricing, payment_policies,
--   payment_methods, transport_weekly_rules, transport_date_exceptions,
--   experience_categories, commerce_settings.
-- This file only UPDATEs/activates a couple of rows in those tables where
-- the task calls for it (site_settings row 1, two inactive trip_categories).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 0. Reset the tables this fixture file owns (disposable local DB — safe).
-- ─────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE
  accommodations,
  sinai_trips,
  trip_packages,
  trip_package_categories,
  community_posts,
  experiences,
  commerce_categories,
  testimonials
RESTART IDENTITY CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. site_settings (row already exists — id=1 — from the migration chain)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.site_settings SET
  whatsapp_number         = '201000000000',
  phone_number             = '201000000000',
  email                    = 'hello@weemapsinai.com',
  facebook_url             = 'https://facebook.com/weemapsinai',
  instagram_url            = 'https://instagram.com/weemapsinai',
  organization_name        = 'WEEMAP SINAI',
  location                 = 'Dahab, South Sinai, Egypt',
  seo_title                = 'WEEMAP SINAI — Dahab Stays, Sinai Trips & Experiences',
  seo_description_ar       = 'احجز إقامتك في دهب ورحلاتك في سيناء مع ويماب — فنادق وشاليهات وكامبات، رحلات يومية، وتجارب مميزة في قلب سيناء.',
  seo_description_en       = 'Book your Dahab stay and Sinai trips with WEEMAP — hotels, chalets and camps, day trips, and signature experiences across South Sinai.',
  hero_heading_ar          = 'دهب وسيناء، بالطريقة اللي تحبها',
  hero_heading_en          = 'Dahab and Sinai, exactly how you want them',
  hero_subheading_ar       = 'إقامات، انتقالات، ورحلات مختارة بعناية — كله في مكان واحد.',
  hero_subheading_en       = 'Stays, transport and hand-picked trips — all in one place.',
  primary_cta_label_ar     = 'احجز رحلتك',
  primary_cta_label_en     = 'Plan Your Trip',
  secondary_cta_label_ar   = 'تصفح الرحلات',
  secondary_cta_label_en   = 'Browse Trips',
  payment_instructions_ar  = 'بعد تأكيد التوفر، هيوصلك تفاصيل الدفع عبر واتساب. الدفع يكون عن طريق فودافون كاش أو إنستاباي أو كاش عند الوصول حسب نوع الحجز.',
  payment_instructions_en  = 'Once availability is confirmed, we will send payment details over WhatsApp. Payment is by Vodafone Cash, InstaPay, or cash on arrival, depending on the booking type.',
  package_included_trip_ids = ARRAY['b1000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000009'::uuid]
WHERE id = 1;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Activate the two V2 trip category tags the task's taxonomy needs.
--    (Seeded inactive by migration 033; sinai_trips below tag into them.)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.trip_categories SET is_active = true
  WHERE slug IN ('culture-bedouin', 'night-experiences');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Accommodations — 6 Dahab properties, mixed type/tier
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.accommodations (
  id, name_ar, name_en, type, tier, description_ar, description_en, images, image_url,
  rating, location, location_ar, location_en, latitude, longitude,
  amenities_ar, amenities_en,
  price_per_night, price_4day, price_5day,
  price_double_room, price_single_room, price_triple_room,
  meal_plans, discount_value, discount_type, discount_label,
  is_active, sort_order
) VALUES
(
  'a1000000-0000-4000-8000-000000000001',
  'كامب سي بريز البدوي', 'Sea Breeze Bedouin Camp', 'camp', 'budget',
  'كامب بسيط على الشاطئ مباشرة في منطقة المشربة، أكواخ خشبية مفتوحة على البحر وأجواء بدوية أصيلة. مثالي للمسافرين اللي بيدوروا على تجربة حقيقية وميزانية بسيطة من غير ما يفوتهم جمال دهب.',
  'A simple beachfront camp in Mashraba, open wooden huts facing the sea and genuine Bedouin atmosphere. Perfect for travelers who want an authentic experience on a modest budget without missing out on Dahab''s beauty.',
  ARRAY[
    'https://images.unsplash.com/photo-1452022582947-b521d8779ab6?w=1600&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
    'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80'
  ],
  'https://images.unsplash.com/photo-1452022582947-b521d8779ab6?w=1600&q=80',
  4.3, 'Mashraba, Dahab', 'المشربة، دهب', 'Mashraba, Dahab', 28.5100, 34.5150,
  ARRAY['واي فاي مجاني', 'شاطئ خاص', 'مطعم بدوي', 'إطلالة على البحر'],
  ARRAY['Free Wi-Fi', 'Private beach', 'Bedouin restaurant', 'Sea view'],
  800, 3200, 4000,
  1600, 900, 2200,
  '[
    {"key":"room_only","label_ar":"بدون وجبات","label_en":"Room Only","price_per_person_per_night":0,"is_active":true},
    {"key":"breakfast","label_ar":"إفطار","label_en":"Breakfast","price_per_person_per_night":120,"is_active":true},
    {"key":"half_board","label_ar":"نصف إقامة","label_en":"Half Board","price_per_person_per_night":280,"is_active":true},
    {"key":"all_inclusive","label_ar":"شامل بالكامل","label_en":"All Inclusive","price_per_person_per_night":520,"is_active":false}
  ]'::jsonb,
  NULL, NULL, '',
  true, 0
),
(
  'a1000000-0000-4000-8000-000000000002',
  'شاليهات بلو لاجون', 'Blue Lagoon Chalets', 'chalet', 'lagoon',
  'شاليهات مطلة مباشرة على لاجونة دهب الشهيرة، مثالية لعشاق الكايت سيرف والويند سيرف. كل شاليه فيه تراس خاص وإطلالة على المياه الفيروزية الهادئة.',
  'Chalets directly overlooking Dahab''s famous lagoon, ideal for kitesurfers and windsurfers. Every chalet has a private terrace and a view over the calm turquoise water.',
  ARRAY[
    'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80',
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80'
  ],
  'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80',
  4.6, 'The Lagoon, Dahab', 'اللاجونة، دهب', 'The Lagoon, Dahab', 28.5350, 34.5180,
  ARRAY['واي فاي مجاني', 'مدرسة كايت سيرف', 'مسبح', 'تراس خاص', 'تكييف'],
  ARRAY['Free Wi-Fi', 'Kitesurf school', 'Swimming pool', 'Private terrace', 'A/C'],
  2100, 8400, 10500,
  4200, 2600, 5600,
  '[
    {"key":"room_only","label_ar":"بدون وجبات","label_en":"Room Only","price_per_person_per_night":0,"is_active":true},
    {"key":"breakfast","label_ar":"إفطار","label_en":"Breakfast","price_per_person_per_night":180,"is_active":true},
    {"key":"half_board","label_ar":"نصف إقامة","label_en":"Half Board","price_per_person_per_night":400,"is_active":true},
    {"key":"all_inclusive","label_ar":"شامل بالكامل","label_en":"All Inclusive","price_per_person_per_night":750,"is_active":true}
  ]'::jsonb,
  NULL, NULL, '',
  true, 1
),
(
  'a1000000-0000-4000-8000-000000000003',
  'فندق جولدن كوست', 'Golden Coast Hotel', 'hotel', 'standard',
  'فندق ثلاث نجوم في قلب المشربة، على بعد خطوات من المطاعم والمقاهي والشاطئ. غرف مريحة ومطبخ بحري متنوع وموقع يسهل منه الوصول لكل حاجة في دهب.',
  'A three-star hotel in the heart of Mashraba, steps from restaurants, cafés and the beach. Comfortable rooms, a varied seafood-forward kitchen, and a location that puts everything in Dahab within easy reach.',
  ARRAY[
    'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80'
  ],
  'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80',
  4.2, 'Mashraba, Dahab', 'المشربة، دهب', 'Mashraba, Dahab', 28.5080, 34.5130,
  ARRAY['واي فاي مجاني', 'مطعم', 'مسبح', 'استقبال 24 ساعة', 'تكييف'],
  ARRAY['Free Wi-Fi', 'Restaurant', 'Swimming pool', '24-hour front desk', 'A/C'],
  1700, 6800, 8500,
  3400, 2100, 4500,
  '[
    {"key":"room_only","label_ar":"بدون وجبات","label_en":"Room Only","price_per_person_per_night":0,"is_active":true},
    {"key":"breakfast","label_ar":"إفطار","label_en":"Breakfast","price_per_person_per_night":150,"is_active":true},
    {"key":"half_board","label_ar":"نصف إقامة","label_en":"Half Board","price_per_person_per_night":350,"is_active":true},
    {"key":"all_inclusive","label_ar":"شامل بالكامل","label_en":"All Inclusive","price_per_person_per_night":620,"is_active":true}
  ]'::jsonb,
  10, 'percentage', 'عرض الحجز المبكر -10%',
  true, 2
),
(
  'a1000000-0000-4000-8000-000000000004',
  'فندق داهاب باي البوتيك', 'Dahab Bay Boutique Hotel', 'hotel', 'premium',
  'فندق بوتيك فاخر في عسلة، بتصميم عصري يمزج بين الطابع السيناوي والراحة الحديثة. غرف واسعة بإطلالة على البحر الأحمر وجبال السعودية من بعيد، ومركز غوص خاص بالفندق.',
  'A luxury boutique hotel in Assalah, modern design blending Sinai character with contemporary comfort. Spacious rooms with Red Sea views (and the Saudi mountains in the distance), plus an in-house dive center.',
  ARRAY[
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
    'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
    'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80'
  ],
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
  4.8, 'Assalah, Dahab', 'عسلة، دهب', 'Assalah, Dahab', 28.5220, 34.5240,
  ARRAY['واي فاي مجاني', 'مركز غوص', 'مسبح إنفينيتي', 'سبا', 'مطعم فاخر', 'تكييف'],
  ARRAY['Free Wi-Fi', 'Dive center', 'Infinity pool', 'Spa', 'Fine-dining restaurant', 'A/C'],
  3600, 14400, 18000,
  6800, 4200, 8800,
  '[
    {"key":"room_only","label_ar":"بدون وجبات","label_en":"Room Only","price_per_person_per_night":0,"is_active":true},
    {"key":"breakfast","label_ar":"إفطار","label_en":"Breakfast","price_per_person_per_night":250,"is_active":true},
    {"key":"half_board","label_ar":"نصف إقامة","label_en":"Half Board","price_per_person_per_night":550,"is_active":true},
    {"key":"all_inclusive","label_ar":"شامل بالكامل","label_en":"All Inclusive","price_per_person_per_night":900,"is_active":true}
  ]'::jsonb,
  NULL, NULL, '',
  true, 3
),
(
  'a1000000-0000-4000-8000-000000000005',
  'كامب ديزرت بيرل', 'Desert Pearl Camp', 'camp', 'budget',
  'كامب هادي على أطراف دهب، بيجمع بين قرب الصحراء وسهولة الوصول للبحر. مكان مثالي لمحبي مراقبة النجوم والهدوء بعيد عن الزحمة.',
  'A quiet camp on the edge of Dahab, combining desert proximity with easy beach access. Ideal for stargazers and anyone looking for calm away from the crowds.',
  ARRAY[
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80',
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80',
    'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80'
  ],
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80',
  4.1, 'Asalah Outskirts, Dahab', 'أطراف عسلة، دهب', 'Assalah Outskirts, Dahab', 28.5300, 34.5300,
  ARRAY['واي فاي مجاني', 'مراقبة نجوم', 'مطعم بدوي', 'موقف سيارات'],
  ARRAY['Free Wi-Fi', 'Stargazing deck', 'Bedouin restaurant', 'Parking'],
  850, 3400, 4250,
  1700, 1000, 2400,
  '[
    {"key":"room_only","label_ar":"بدون وجبات","label_en":"Room Only","price_per_person_per_night":0,"is_active":true},
    {"key":"breakfast","label_ar":"إفطار","label_en":"Breakfast","price_per_person_per_night":100,"is_active":true},
    {"key":"half_board","label_ar":"نصف إقامة","label_en":"Half Board","price_per_person_per_night":260,"is_active":true}
  ]'::jsonb,
  NULL, NULL, '',
  true, 4
),
(
  'a1000000-0000-4000-8000-000000000006',
  'منتجع لاجون بريز', 'Lagoon Breeze Resort', 'hotel', 'lagoon',
  'منتجع مطل على اللاجونة بغرف واسعة ومسبحين ونادي رياضات مائية داخلي. الاختيار المفضل للعائلات والأزواج اللي عايزين رفاهية مع إطلالة مباشرة على المياه الهادئة.',
  'A lagoon-facing resort with spacious rooms, two pools, and an in-house watersports club. The go-to choice for families and couples who want comfort with a direct view of the calm water.',
  ARRAY[
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
    'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80'
  ],
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
  4.5, 'The Lagoon, Dahab', 'اللاجونة، دهب', 'The Lagoon, Dahab', 28.5400, 34.5220,
  ARRAY['واي فاي مجاني', 'مسبحين', 'نادي رياضات مائية', 'مطعمين', 'سبا', 'تكييف'],
  ARRAY['Free Wi-Fi', 'Two pools', 'Watersports club', 'Two restaurants', 'Spa', 'A/C'],
  4100, 16400, 20500,
  8200, 5200, 10200,
  '[
    {"key":"room_only","label_ar":"بدون وجبات","label_en":"Room Only","price_per_person_per_night":0,"is_active":true},
    {"key":"breakfast","label_ar":"إفطار","label_en":"Breakfast","price_per_person_per_night":220,"is_active":true},
    {"key":"half_board","label_ar":"نصف إقامة","label_en":"Half Board","price_per_person_per_night":480,"is_active":true},
    {"key":"all_inclusive","label_ar":"شامل بالكامل","label_en":"All Inclusive","price_per_person_per_night":850,"is_active":true}
  ]'::jsonb,
  NULL, NULL, '',
  true, 5
);

-- Seasonal rate — Dahab Bay Boutique Hotel, Christmas / New Year period
INSERT INTO public.accommodation_seasonal_rates (
  id, accommodation_id, name, start_date, end_date, single_price, double_price, triple_price, is_active
) VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000004',
  'Christmas / New Year',
  '2026-12-20', '2027-01-05',
  5600, 9200, 11800,
  true
);

-- Room upgrades — Dahab Bay Boutique Hotel (2 tiers) + Lagoon Breeze Resort (1 tier)
INSERT INTO public.accommodation_room_upgrades (
  id, accommodation_id, name_ar, name_en, extra_price_per_night, sort_order, is_active
) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 'إطلالة بحر', 'Sea View', 800, 0, true),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', 'قياسي', 'Standard', 0, 1, true),
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000006', 'إطلالة لاجونة', 'Lagoon View', 1000, 0, true);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Sinai Trips — 10 trips spread across the six trip categories
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.sinai_trips (
  id, name_ar, name_en, description_ar, description_en, category_ar, category_en,
  trip_category_id, images, duration, duration_en, price, package_price,
  discount_type, discount_value, discount_label,
  includes_ar, includes_en, is_active, sort_order
) VALUES
(
  'b1000000-0000-4000-8000-000000000001',
  'رحلة سنوركلينج البلوهول والثري بولز', 'Blue Hole & Three Pools Snorkel',
  'رحلة سنوركلينج لأشهر بقعتين في دهب — البلوهول والثري بولز. مياه فيروزية وشعاب مرجانية غنية، مناسبة للمبتدئين والمحترفين.',
  'A snorkel trip to Dahab''s two most famous spots — the Blue Hole and the Three Pools. Turquoise water and rich coral reefs, suitable for beginners and experienced snorkelers alike.',
  'بحر وسنوركلينج', 'Sea & Snorkeling',
  (SELECT id FROM public.trip_categories WHERE slug = 'sea-snorkeling'),
  ARRAY[
    'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80'
  ],
  'نصف يوم', 'Half Day', 900, 650,
  NULL, NULL, '',
  ARRAY['مرشد سياحي', 'معدات سنوركلينج', 'مشروبات خفيفة'],
  ARRAY['Tour guide', 'Snorkeling gear', 'Light refreshments'],
  true, 0
),
(
  'b1000000-0000-4000-8000-000000000002',
  'رحلة رأس أبو جلوم البدوية والسنوركلينج', 'Ras Abu Galum Bedouin & Snorkel Trip',
  'رحلة بالجمال أو القوارب لمحمية رأس أبو جلوم الطبيعية، سنوركلينج في مياه نظيفة وغداء بدوي تقليدي على الشاطئ.',
  'A camel or boat trip to the Ras Abu Galum protected area, snorkeling in pristine water followed by a traditional Bedouin lunch on the beach.',
  'بحر وسنوركلينج', 'Sea & Snorkeling',
  (SELECT id FROM public.trip_categories WHERE slug = 'sea-snorkeling'),
  ARRAY[
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80'
  ],
  'يوم كامل', 'Full Day', 750, 550,
  NULL, NULL, '',
  ARRAY['ركوب جمال', 'مرشد بدوي', 'غداء بدوي', 'معدات سنوركلينج'],
  ARRAY['Camel ride', 'Bedouin guide', 'Bedouin lunch', 'Snorkeling gear'],
  true, 1
),
(
  'b1000000-0000-4000-8000-000000000003',
  'مغامرة الكانيون الملون', 'Colored Canyon Adventure',
  'مشي وسط تشكيلات صخرية ملونة مذهلة في واحد من أجمل الأودية في سيناء، مغامرة سهلة تناسب كل الأعمار.',
  'A walk through stunning multicolored rock formations in one of Sinai''s most beautiful canyons — an easy adventure suitable for all ages.',
  'صحراء وسفاري', 'Desert & Safari',
  (SELECT id FROM public.trip_categories WHERE slug = 'desert-safari'),
  ARRAY[
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80',
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80'
  ],
  'يوم كامل', 'Full Day', 1100, 800,
  'percentage', 15, 'عرض لفترة محدودة',
  ARRAY['نقل بسيارات دفع رباعي', 'مرشد', 'غداء بدوي'],
  ARRAY['4x4 transport', 'Guide', 'Bedouin lunch'],
  true, 2
),
(
  'b1000000-0000-4000-8000-000000000004',
  'رحلة تسلق جبل سيناء لمشاهدة الشروق', 'Mount Sinai Sunrise Hike',
  'تسلق ليلي لقمة جبل سيناء المقدس لمشاهدة شروق الشمس من فوق الجبال، تجربة روحانية لا تُنسى.',
  'A night hike to the summit of the sacred Mount Sinai to watch the sunrise over the mountains — an unforgettable, spiritual experience.',
  'جبال وهايكنج', 'Mountains & Hiking',
  (SELECT id FROM public.trip_categories WHERE slug = 'mountains-hiking'),
  ARRAY[
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80'
  ],
  'ليلي', 'Overnight', 1400, 1000,
  NULL, NULL, '',
  ARRAY['نقل ذهاب وعودة', 'مرشد بدوي', 'ماء وشاي على القمة'],
  ARRAY['Round-trip transport', 'Bedouin guide', 'Water and tea at the summit'],
  true, 3
),
(
  'b1000000-0000-4000-8000-000000000005',
  'جولة دير سانت كاترين', 'St. Catherine Monastery Tour',
  'زيارة لأقدم دير مسيحي لا يزال يعمل في العالم، عند سفح جبل سيناء، وتعرف على تاريخه وكنوزه الأثرية.',
  'Visit one of the oldest continuously operating Christian monasteries in the world, at the foot of Mount Sinai, and learn about its history and treasures.',
  'جبال وهايكنج', 'Mountains & Hiking',
  (SELECT id FROM public.trip_categories WHERE slug = 'mountains-hiking'),
  ARRAY[
    'https://images.unsplash.com/photo-1517824806704-9040b037703b?w=1600&q=80',
    'https://images.unsplash.com/photo-1452022582947-b521d8779ab6?w=1600&q=80'
  ],
  'يوم كامل', 'Full Day', 950, 700,
  NULL, NULL, '',
  ARRAY['نقل', 'مرشد', 'دخول الدير'],
  ARRAY['Transport', 'Guide', 'Monastery entry'],
  true, 4
),
(
  'b1000000-0000-4000-8000-000000000006',
  'ترك الكانيون الأبيض', 'White Canyon Trek',
  'مشي مغامرات وسط جدران صخرية بيضاء ضيقة، مسار مختلف عن الكانيون الملون ومناسب لمحبي التصوير.',
  'An adventurous walk through narrow white rock walls — a different route from the Colored Canyon, great for photography lovers.',
  'صحراء وسفاري', 'Desert & Safari',
  (SELECT id FROM public.trip_categories WHERE slug = 'desert-safari'),
  ARRAY[
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80'
  ],
  'يوم كامل', 'Full Day', 950, 700,
  NULL, NULL, '',
  ARRAY['نقل بسيارات دفع رباعي', 'مرشد', 'وجبة خفيفة'],
  ARRAY['4x4 transport', 'Guide', 'Light meal'],
  true, 5
),
(
  'b1000000-0000-4000-8000-000000000007',
  'عشاء بدوي وسهرة تحت النجوم', 'Bedouin Dinner & Stargazing Night',
  'أمسية في الصحراء حول نار المخيم، عشاء بدوي تقليدي، شاي أعشاب، ومراقبة النجوم بعيد عن أضواء المدينة.',
  'An evening in the desert around a campfire — a traditional Bedouin dinner, herbal tea, and stargazing far from city lights.',
  'الثقافة والتجارب البدوية', 'Culture & Bedouin',
  (SELECT id FROM public.trip_categories WHERE slug = 'culture-bedouin'),
  ARRAY[
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
    'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80'
  ],
  'مسائي', 'Evening', 700, 500,
  'amount', 100, 'خصم ليلة بدوية',
  ARRAY['نقل', 'عشاء بدوي كامل', 'شاي وقهوة بدوية'],
  ARRAY['Transport', 'Full Bedouin dinner', 'Bedouin tea and coffee'],
  true, 6
),
(
  'b1000000-0000-4000-8000-000000000008',
  'سفاري الكويد وقت الغروب', 'Quad Bike Sunset Safari',
  'قيادة دراجات الكويد في الصحراء المحيطة بدهب وقت الغروب، تجربة مليئة بالأدرينالين تنتهي بمشهد غروب رائع.',
  'Ride quad bikes through the desert around Dahab at sunset — an adrenaline-filled experience ending with a stunning sunset view.',
  'صحراء وسفاري', 'Desert & Safari',
  (SELECT id FROM public.trip_categories WHERE slug = 'desert-safari'),
  ARRAY[
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80'
  ],
  'مسائي', 'Evening', 850, 600,
  NULL, NULL, '',
  ARRAY['دراجة كويد فردية', 'خوذة أمان', 'مرشد'],
  ARRAY['Solo quad bike', 'Safety helmet', 'Guide'],
  true, 7
),
(
  'b1000000-0000-4000-8000-000000000009',
  'درس تجريبي كايت سيرف في اللاجونة', 'Lagoon Kitesurf Intro Lesson',
  'درس تعريفي لرياضة الكايت سيرف في مياه اللاجونة الضحلة والهادئة، مثالي للمبتدئين تمامًا.',
  'An introductory kitesurfing lesson in the shallow, calm lagoon water — perfect for complete beginners.',
  'بحر وسنوركلينج', 'Sea & Snorkeling',
  (SELECT id FROM public.trip_categories WHERE slug = 'sea-snorkeling'),
  ARRAY[
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80'
  ],
  'ساعتين', '2 Hours', 1200, 900,
  NULL, NULL, '',
  ARRAY['معدات كايت سيرف', 'مدرب معتمد', 'تأمين'],
  ARRAY['Kitesurf gear', 'Certified instructor', 'Insurance'],
  true, 8
),
(
  'b1000000-0000-4000-8000-00000000000a',
  'رحلة نويبع ليوم واحد', 'Nuweiba Day Escape',
  'يوم في نويبع بين الشاطئ الهادئ ووادي القرة، بعيد عن زحمة دهب، بما في ذلك وقت حر للسباحة والاسترخاء.',
  'A day in Nuweiba between the quiet beach and Wadi El Qura, away from Dahab''s crowds, including free time to swim and relax.',
  'رحلات اليوم الواحد', 'Day Escapes',
  (SELECT id FROM public.trip_categories WHERE slug = 'day-escapes'),
  ARRAY[
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80'
  ],
  'يوم كامل', 'Full Day', 1300, 950,
  NULL, NULL, '',
  ARRAY['نقل', 'مرشد', 'غداء', 'وقت حر للسباحة'],
  ARRAY['Transport', 'Guide', 'Lunch', 'Free swim time'],
  true, 9
);

-- Multi-tag category memberships (a trip can belong to more than one V2
-- category — see migration 033). The primary category is always included.
INSERT INTO public.sinai_trip_category_tags (trip_id, category_id)
SELECT id, trip_category_id FROM public.sinai_trips WHERE trip_category_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.sinai_trip_category_tags (trip_id, category_id) VALUES
  ('b1000000-0000-4000-8000-000000000002', (SELECT id FROM public.trip_categories WHERE slug = 'desert-safari')),
  ('b1000000-0000-4000-8000-000000000004', (SELECT id FROM public.trip_categories WHERE slug = 'night-experiences')),
  ('b1000000-0000-4000-8000-000000000005', (SELECT id FROM public.trip_categories WHERE slug = 'culture-bedouin')),
  ('b1000000-0000-4000-8000-000000000007', (SELECT id FROM public.trip_categories WHERE slug = 'night-experiences')),
  ('b1000000-0000-4000-8000-000000000008', (SELECT id FROM public.trip_categories WHERE slug = 'night-experiences'))
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Trip Packages — 2 stay_package ("Dahab Stay Packages") +
--    2 experience_package ("Sinai Experience Packages")
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.trip_package_categories (id, slug, name_ar, name_en, is_active, sort_order) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'dahab-stay-packages', 'باقات إقامة دهب', 'Dahab Stay Packages', true, 0),
  ('c1000000-0000-4000-8000-000000000002', 'sinai-experience-packages', 'باقات تجارب سيناء', 'Sinai Experience Packages', true, 1);

INSERT INTO public.trip_packages (
  id, slug, name_ar, name_en, short_description_ar, short_description_en,
  description_ar, description_en, image, badge_ar, badge_en,
  package_category_id, payment_kind, featured, is_active, sort_order
) VALUES
(
  'c2000000-0000-4000-8000-000000000001',
  'dahab-weekend-escape',
  'هروب نهاية الأسبوع في دهب', 'Dahab Weekend Escape',
  'سنوركلينج في البلوهول ودرس كايت سيرف في اللاجونة.', 'Blue Hole snorkeling plus a lagoon kitesurf lesson.',
  'باقة مثالية لنهاية أسبوع في دهب تجمع بين أفضل تجربتين بحريتين: سنوركلينج البلوهول والثري بولز، ودرس تجريبي في الكايت سيرف داخل اللاجونة الهادئة.',
  'The perfect Dahab weekend bundle combining two standout sea experiences: Blue Hole & Three Pools snorkeling, and an introductory kitesurf lesson in the calm lagoon.',
  'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80',
  'الأكثر طلبًا', 'Most Popular',
  'c1000000-0000-4000-8000-000000000001', 'stay_package', true, true, 0
),
(
  'c2000000-0000-4000-8000-000000000002',
  'dahab-adventure-stay',
  'إقامة المغامرة في دهب', 'Dahab Adventure Stay',
  'الكانيون الملون وسفاري الكويد وقت الغروب.', 'Colored Canyon and a sunset quad safari.',
  'باقة للمغامرين اللي عايزين يجمعوا بين جمال الكانيون الملون وإثارة سفاري الكويد الصحراوي وقت الغروب في رحلة واحدة.',
  'A bundle for adventurers who want the beauty of the Colored Canyon and the thrill of a desert quad safari at sunset, in one package.',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80',
  '', '',
  'c1000000-0000-4000-8000-000000000001', 'stay_package', false, true, 1
),
(
  'c2000000-0000-4000-8000-000000000003',
  'sinai-mountains-culture-experience',
  'تجربة جبال وثقافة سيناء', 'Sinai Mountains & Culture Experience',
  'شروق جبل سيناء، دير سانت كاترين، وعشاء بدوي.', 'Mount Sinai sunrise, St. Catherine, and a Bedouin dinner.',
  'رحلة متكاملة لعشاق الجبال والثقافة: تسلق جبل سيناء لمشاهدة الشروق، زيارة دير سانت كاترين التاريخي، وليلة بدوية تحت النجوم.',
  'A complete journey for mountain and culture lovers: a Mount Sinai sunrise hike, a visit to the historic St. Catherine Monastery, and a Bedouin night under the stars.',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&q=80',
  'تجربة كاملة', 'Complete Experience',
  'c1000000-0000-4000-8000-000000000002', 'experience_package', true, true, 2
),
(
  'c2000000-0000-4000-8000-000000000004',
  'sinai-sea-desert-experience',
  'تجربة بحر وصحراء سيناء', 'Sinai Sea & Desert Experience',
  'رأس أبو جلوم، الكانيون الأبيض، ورحلة نويبع.', 'Ras Abu Galum, White Canyon, and a Nuweiba day escape.',
  'باقة تجمع بين جمال الساحل البكر في رأس أبو جلوم، مغامرة الكانيون الأبيض، ويوم هروب هادئ في نويبع.',
  'A bundle combining the pristine coastline of Ras Abu Galum, the White Canyon adventure, and a relaxed day escape in Nuweiba.',
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
  '', '',
  'c1000000-0000-4000-8000-000000000002', 'experience_package', false, true, 3
);

INSERT INTO public.trip_package_items (package_id, trip_id, sort_order) VALUES
  ('c2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 0),
  ('c2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000009', 1),
  ('c2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003', 0),
  ('c2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000008', 1),
  ('c2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000004', 0),
  ('c2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000005', 1),
  ('c2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000007', 2),
  ('c2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000002', 0),
  ('c2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000006', 1),
  ('c2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-00000000000a', 2);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Community Posts — 6 published, bilingual, multi-paragraph
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.community_posts (
  id, slug, title_ar, title_en, content_ar, content_en, category, image_url,
  sort_order, is_pinned, is_published
) VALUES
(
  'd1000000-0000-4000-8000-000000000001',
  '5-reasons-dahab-red-sea-trip',
  '٥ أسباب تخلي دهب وجهتك الجاية على البحر الأحمر', '5 Reasons Dahab Should Be Your Next Red Sea Trip',
  E'دهب مش زي أي مدينة ساحلية تانية على البحر الأحمر. هي مزيج نادر بين الهدوء والمغامرة، بين الجبل والبحر، بين الثقافة البدوية والحياة العصرية البسيطة.\n\nأولاً، الشعاب المرجانية قريبة جدًا من الشاطئ — تقدر تعوم من على الرصيف مباشرة وتشوف عالم تحت الماء مذهل من غير الحاجة لقارب. ثانيًا، الأسعار في دهب لسه معقولة جدًا مقارنة بالغردقة أو شرم الشيخ.\n\nثالثًا، القرب من الصحراء والجبال يعني إنك تقدر تجمع بين يوم غطس ويوم رحلة صحراوية في نفس الأسبوع. رابعًا، أجواء دهب هادية ومريحة، بعيدة عن ضجيج المنتجعات الكبيرة. وأخيرًا، ناسها — الطابع البدوي والضيافة المصرية الأصيلة بتخلي أي زيارة تجربة إنسانية مش مجرد سياحة.',
  E'Dahab isn''t like any other Red Sea coastal town. It''s a rare mix of calm and adventure, mountain and sea, Bedouin culture and simple modern life.\n\nFirst, the coral reefs sit right off the shore — you can swim in straight from the promenade and see an incredible underwater world without needing a boat. Second, prices in Dahab remain very reasonable compared to Hurghada or Sharm El Sheikh.\n\nThird, the proximity to the desert and mountains means you can combine a diving day with a desert trip in the same week. Fourth, Dahab''s atmosphere is calm and relaxed, far from the noise of big resorts. And finally, its people — the Bedouin character and genuine Egyptian hospitality turn any visit into a human experience, not just tourism.',
  'blog',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
  0, true, true
),
(
  'd1000000-0000-4000-8000-000000000002',
  'first-timers-guide-dahab-lagoon',
  'دليل أول زيارة للاجونة دهب', 'A First-Timer''s Guide to Dahab''s Lagoon',
  E'اللاجونة هي المنطقة المفضلة لمحبي الكايت سيرف والويند سيرف في دهب، لكنها كمان مكان رائع لأي حد عايز يقضي يوم هادي على الشاطئ.\n\nأفضل وقت تزور فيه اللاجونة الصبح بدري قبل ما الريح تقوى، أو قبل الغروب علشان تستمتع بالمنظر. فيه مدارس كايت سيرف كتير هناك بتقدم دروس للمبتدئين بأسعار مختلفة.\n\nلو مش عايز تجرب رياضة مائية، تقدر بس تقعد في أي من الكافيهات المطلة على المياه وتستمتع بالمنظر. المياه في اللاجونة ضحلة وهادية، فهي مكان آمن جدًا للعائلات والأطفال.',
  E'The Lagoon is Dahab''s favorite spot for kitesurfers and windsurfers, but it''s also a wonderful place for anyone who just wants a calm day by the water.\n\nThe best time to visit the Lagoon is early morning before the wind picks up, or just before sunset to enjoy the view. There are many kitesurf schools there offering beginner lessons at various price points.\n\nIf watersports aren''t your thing, you can simply sit at one of the waterfront cafés and enjoy the view. The Lagoon''s water is shallow and calm, making it a very safe spot for families and children.',
  'dahab-guide',
  'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80',
  1, false, true
),
(
  'd1000000-0000-4000-8000-000000000003',
  'ras-abu-galum-hidden-coastline',
  'رأس أبو جلوم: ساحل سيناء اللي لسه ما اتلمسش', 'Ras Abu Galum: Sinai''s Untouched Coastline',
  E'محمية رأس أبو جلوم من أقل الأماكن ازدحامًا على ساحل سيناء، ومن أكتر الأماكن اللي بتدي إحساس حقيقي بجمال المنطقة قبل السياحة.\n\nمفيش طريق سيارات للمكان — إما تروح بالجمل من دهب، أو بالقارب. الرحلة نفسها جزء من التجربة، خصوصًا لو كانت بالجمل عبر الساحل الصخري.\n\nلما توصل، هتلاقي مياه صافية جدًا ومرجان بحالة ممتازة، وقرى بدوية بسيطة بتقدملك غداء طازة. المكان مثالي لمين عايز يهرب من الزحمة ويشوف جمال سيناء الطبيعي.',
  E'Ras Abu Galum protected area is one of the least crowded spots on Sinai''s coast, and one of the places that best captures the region''s beauty before tourism arrived.\n\nThere''s no road for cars — you either go by camel from Dahab, or by boat. The journey itself is part of the experience, especially by camel along the rocky coastline.\n\nOnce you arrive, you''ll find remarkably clear water and coral in excellent condition, plus simple Bedouin villages offering fresh lunch. It''s the perfect place for anyone who wants to escape the crowds and see Sinai''s natural beauty.',
  'hidden-gems',
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
  2, false, true
),
(
  'd1000000-0000-4000-8000-000000000004',
  'bedouin-family-welcomed-us-dinner',
  'إزاي عيلة بدوية استضافتنا على عشاء', 'How a Bedouin Family Welcomed Us for Dinner',
  E'وصلنا الكامب بعد ما الشمس غابت، والنار كانت مشتعلة والشاي بيغلي فوقها. أحمد، صاحب الكامب، رحب بينا وكأننا أهله من زمان.\n\nالعشاء كان بسيط لكنه لذيذ جدًا — فراخ مشوية على الفحم، أرز، وخضار طازة، وكل حاجة اتعملت على النار من غير أي كهرباء. قعدنا نتكلم عن حياة البدو في سيناء، وإزاي الجيل الجديد بيحاول يحافظ على العادات القديمة مع التغيرات اللي حصلت في المنطقة.\n\nبعد العشاء، اتمدينا على الرمل ونظرنا للسما. مافيش تلوث ضوئي هناك، فالنجوم كانت واضحة بشكل مش طبيعي. لحظة بسيطة، لكنها من أكتر اللحظات اللي هتفضل في ذاكرتنا من الرحلة دي.',
  E'We arrived at the camp after the sun had set, the fire already lit and tea brewing over it. Ahmed, the camp owner, welcomed us like old family.\n\nDinner was simple but delicious — chicken grilled over charcoal, rice, and fresh vegetables, all cooked over the fire with no electricity in sight. We sat talking about Bedouin life in Sinai, and how the new generation is trying to preserve old traditions alongside the region''s changes.\n\nAfter dinner, we lay back on the sand and looked up. There''s no light pollution out there, so the stars were unnaturally clear. A simple moment, but one of the ones that will stay with us longest from that trip.',
  'stories',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=80',
  3, false, true
),
(
  'd1000000-0000-4000-8000-000000000005',
  'diving-blue-hole-what-to-know',
  'الغطس في البلوهول: اللي لازم تعرفه قبل ما تروح', 'Diving the Blue Hole: What to Know Before You Go',
  E'البلوهول واحد من أشهر مواقع الغطس في العالم، لكنه كمان محتاج احترام وخبرة كافية، خصوصًا لو نويت تنزل لعمق كبير.\n\nللمبتدئين، فيه مناطق ضحلة وآمنة تمامًا للسنوركلينج والغطس السطحي، وبتديك فرصة تشوف جمال المكان من غير أي مخاطرة. أما الغطاسين المحترفين، فلازم ينزلوا مع مرشد معتمد وميعرفوش المنطقة كويس.\n\nأفضل وقت للزيارة الصبح بدري قبل ما الرياح تقوى والمكان يزدحم. خد معاك مية كفاية وواقي شمس، والأهم — احترم حدود مستواك في الغطس مهما كان المكان مغري.',
  E'The Blue Hole is one of the most famous dive sites in the world, but it also demands respect and adequate experience, especially if you plan to go deep.\n\nFor beginners, there are shallow areas that are entirely safe for snorkeling and surface diving, giving you a chance to see the site''s beauty without any risk. Professional divers should go with a certified guide who knows the area well.\n\nThe best time to visit is early morning before the wind picks up and the site gets crowded. Bring enough water and sunscreen, and — most importantly — respect your diving limits no matter how tempting the site looks.',
  'blog',
  'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80',
  4, false, true
),
(
  'd1000000-0000-4000-8000-000000000006',
  'best-time-of-year-visit-dahab',
  'أفضل وقت في السنة لزيارة دهب', 'Best Time of Year to Visit Dahab',
  E'دهب مدينة ممكن تزورها طول السنة تقريبًا، لكن كل موسم بيدي تجربة مختلفة شوية.\n\nمن أكتوبر لأبريل، الجو معتدل ومريح جدًا للأنشطة زي الغطس والرحلات الصحراوية والهايكنج — وده أكتر وقت مزدحم بالسياح. الصيف (يونيو-أغسطس) بيبقى حر جدًا في النهار لكنه أفضل وقت لعشاق الكايت سيرف بسبب قوة الرياح.\n\nلو عايز تتجنب الزحمة وتحصل على أسعار أفضل، جرب تزور في مايو أو سبتمبر — الجو لسه كويس والأسعار أقل من موسم الذروة.',
  E'Dahab is a town you can visit almost year-round, but each season offers a slightly different experience.\n\nFrom October to April, the weather is mild and very comfortable for activities like diving, desert trips and hiking — this is also the busiest tourist season. Summer (June-August) gets quite hot during the day but is the best time for kitesurfers thanks to strong winds.\n\nIf you want to avoid crowds and get better prices, try visiting in May or September — the weather is still good and prices are lower than peak season.',
  'dahab-guide',
  'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80',
  5, false, true
);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Signature Experiences — 3 published, bilingual
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.experiences (
  id, slug, title_ar, title_en, category, partner_name,
  partner_description_ar, partner_description_en,
  short_description_ar, short_description_en, full_description_ar, full_description_en,
  included_ar, included_en, not_included_ar, not_included_en, itinerary,
  hero_image, gallery, duration_ar, duration_en, price, currency,
  discount_value, discount_type, discount_label,
  badge_ar, badge_en, featured, starting_from_price, status, sort_order
) VALUES
(
  'e1000000-0000-4000-8000-000000000001',
  'sinai-honeymoon-escape',
  'هروب شهر العسل في سيناء', 'Sinai Honeymoon Escape',
  'honeymoon', 'Dahab Bay Boutique Hotel',
  'فندق بوتيك شريك متخصص في تجارب الأزواج.', 'A partner boutique hotel specializing in couples'' experiences.',
  'ثلاث ليالٍ هادئة في دهب مصممة خصيصًا للأزواج.', 'Three quiet nights in Dahab designed specifically for couples.',
  'تجربة شهر عسل متكاملة تجمع بين إقامة فاخرة، عشاء خاص على الشاطئ، وجولة غروب بالقارب. كل التفاصيل مرتبة مسبقًا عشان تفضلوا مركزين على بعض بس.',
  'A complete honeymoon experience combining a luxury stay, a private beachside dinner, and a sunset boat tour. Every detail is arranged in advance so you can focus only on each other.',
  ARRAY['إقامة 3 ليالٍ', 'عشاء خاص على الشاطئ', 'جولة غروب بالقارب', 'ترحيب بالورود والشوكولاتة'],
  ARRAY['3 nights accommodation', 'Private beachside dinner', 'Sunset boat tour', 'Rose petal and chocolate welcome'],
  ARRAY['تذاكر الطيران', 'المصاريف الشخصية'],
  ARRAY['Flights', 'Personal expenses'],
  '[
    {"title_ar":"اليوم الأول: وصول واستقبال", "title_en":"Day 1: Arrival & Welcome", "description_ar":"استقبال خاص في الفندق مع ترحيب بالورود.", "description_en":"Private hotel check-in with a rose-petal welcome."},
    {"title_ar":"اليوم الثاني: عشاء الشاطئ", "title_en":"Day 2: Beach Dinner", "description_ar":"عشاء خاص مُعد على الرمال عند الغروب.", "description_en":"A private dinner set up on the sand at sunset."},
    {"title_ar":"اليوم الثالث: جولة القارب", "title_en":"Day 3: Boat Tour", "description_ar":"جولة غروب هادئة على متن قارب خاص.", "description_en":"A calm private sunset boat tour."}
  ]'::jsonb,
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80',
    'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80',
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80'
  ],
  '٣ أيام / ٢ ليالٍ', '3 Days / 2 Nights', 14500, 'EGP',
  NULL, NULL, '',
  'مميز', 'Featured', true, true, 'published', 0
),
(
  'e1000000-0000-4000-8000-000000000002',
  'complete-dive-journey',
  'رحلة الغوص المتكاملة', 'Complete Dive Journey',
  'dive-journey', 'Dahab Bay Dive Center',
  'مركز غوص معتمد شريك بخبرة أكتر من ١٥ سنة.', 'A certified partner dive center with 15+ years of experience.',
  'كورس غوص كامل مع ٦ غطسات في أشهر مواقع دهب.', 'A full diving course with 6 dives at Dahab''s most famous sites.',
  'تجربة غوص متكاملة تبدأ بكورس تأسيسي وتنتهي بـ ٦ غطسات موجهة في مواقع زي البلوهول والكانيون، مع إقامة مناسبة طوال المدة.',
  'A complete diving experience starting with a foundation course and ending with 6 guided dives at sites like the Blue Hole and the Canyon, with matching accommodation for the whole duration.',
  ARRAY['كورس غوص معتمد', '٦ غطسات موجهة', 'معدات كاملة', 'إقامة ٤ ليالٍ'],
  ARRAY['Certified diving course', '6 guided dives', 'Full equipment', '4 nights accommodation'],
  ARRAY['تذاكر الطيران', 'التأمين الطبي'],
  ARRAY['Flights', 'Medical insurance'],
  '[
    {"title_ar":"اليوم الأول: الكورس النظري", "title_en":"Day 1: Theory Course", "description_ar":"مقدمة نظرية وتدريب في مسبح ضحل.", "description_en":"Theory introduction and shallow-pool training."},
    {"title_ar":"اليوم الثاني والثالث: الغطسات الموجهة", "title_en":"Day 2-3: Guided Dives", "description_ar":"٦ غطسات في مواقع دهب الشهيرة.", "description_en":"6 dives across Dahab''s famous sites."},
    {"title_ar":"اليوم الرابع: شهادة وتوديع", "title_en":"Day 4: Certification & Farewell", "description_ar":"استلام الشهادة وجلسة توديع.", "description_en":"Certificate handover and farewell session."}
  ]'::jsonb,
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1600&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
    'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80'
  ],
  '٤ أيام / ٤ ليالٍ', '4 Days / 4 Nights', 22000, 'EGP',
  10, 'percentage', 'حجز مبكر',
  '', '', false, true, 'published', 1
),
(
  'e1000000-0000-4000-8000-000000000003',
  'kite-escape-week',
  'أسبوع هروب الكايت سيرف', 'Kite Escape Week',
  'kite-escape', 'Lagoon Kite Club',
  'نادي كايت سيرف شريك معتمد دوليًا.', 'An internationally certified partner kite club.',
  'أسبوع كامل من دروس الكايت سيرف في لاجونة دهب.', 'A full week of kitesurf lessons at the Dahab lagoon.',
  'أسبوع مصمم لمحبي الرياضات المائية، يجمع بين دروس كايت سيرف مكثفة، إقامة قريبة من اللاجونة، ووقت حر للاستكشاف.',
  'A week designed for watersports lovers, combining intensive kitesurf lessons, accommodation near the lagoon, and free time to explore.',
  ARRAY['٥ أيام دروس كايت سيرف', 'معدات كاملة', 'إقامة ٦ ليالٍ قرب اللاجونة'],
  ARRAY['5 days of kitesurf lessons', 'Full equipment', '6 nights accommodation near the lagoon'],
  ARRAY['تذاكر الطيران', 'الوجبات خارج الفندق'],
  ARRAY['Flights', 'Meals outside the hotel'],
  '[
    {"title_ar":"الأيام ١-٥: دروس الكايت", "title_en":"Days 1-5: Kite Lessons", "description_ar":"دروس يومية تدريجية مع مدربين معتمدين.", "description_en":"Progressive daily lessons with certified instructors."},
    {"title_ar":"اليوم ٦: وقت حر", "title_en":"Day 6: Free Time", "description_ar":"استكشاف دهب أو التدريب الحر.", "description_en":"Explore Dahab or practice freely."}
  ]'::jsonb,
  'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80',
  ARRAY[
    'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=1600&q=80',
    'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1600&q=80'
  ],
  '٦ أيام / ٦ ليالٍ', '6 Days / 6 Nights', 27500, 'EGP',
  NULL, NULL, '',
  '', '', false, true, 'published', 2
);

-- A couple of open dates per experience so the booking flow has something to show.
INSERT INTO public.experience_dates (id, experience_id, start_date, end_date, total_spots, status, is_open) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', '2026-11-05', '2026-11-07', 6, 'open', true),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', '2026-12-10', '2026-12-12', 6, 'open', true),
  ('e2000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000002', '2026-11-15', '2026-11-19', 8, 'open', true),
  ('e2000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000003', '2026-11-20', '2026-11-26', 10, 'open', true);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Commerce categories — no products yet (that's local-seed-inventory.sql)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.commerce_categories (id, slug, applies_to, name_ar, name_en, description_ar, description_en, image_url, icon, is_active, is_featured, sort_order) VALUES
  ('21000000-0000-4000-8000-000000000001', 'diving-gear', 'both', 'معدات الغوص', 'Diving Gear', 'أقنعة وزعانف ومعدات غطس للبيع والإيجار.', 'Masks, fins and diving gear for sale and rent.', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80', 'anchor', true, true, 0),
  ('21000000-0000-4000-8000-000000000002', 'camping-gear', 'sale', 'معدات التخييم', 'Camping Gear', 'أدوات ومستلزمات للرحلات الصحراوية والتخييم.', 'Gear and essentials for desert trips and camping.', 'https://images.unsplash.com/photo-1452022582947-b521d8779ab6?w=1600&q=80', 'tent', true, false, 1),
  ('21000000-0000-4000-8000-000000000003', 'bikes-kayaks', 'rental', 'دراجات وكاياك', 'Bikes & Kayaks', 'دراجات جبلية وكاياك للإيجار.', 'Mountain bikes and kayaks for rent.', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80', 'bike', true, true, 2),
  ('21000000-0000-4000-8000-000000000004', 'beachwear', 'sale', 'ملابس الشاطئ', 'Beachwear', 'تيشيرتات وإكسسوارات بطابع سيناوي.', 'T-shirts and accessories with Sinai character.', 'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=1600&q=80', 'shirt', true, false, 3);

-- Delivery zones (read by getDeliveryZones()) — small addition for commerce completeness.
INSERT INTO public.delivery_zones (id, name_ar, name_en, fee_type, fixed_fee, is_active, sort_order) VALUES
  ('22000000-0000-4000-8000-000000000001', 'داخل دهب', 'Within Dahab', 'free', 0, true, 0),
  ('22000000-0000-4000-8000-000000000002', 'خارج دهب', 'Outside Dahab', 'fixed', 150, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Testimonials — 2 additional (on top of migration_v3's 3 placeholders)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.testimonials (id, name, text_ar, text_en, rating, trip_ar, trip_en, source, sort_order, is_published) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'Layla Hassan',
   'إقامتنا في دهب باي البوتيك كانت أحلى من المتوقع. الغرفة نظيفة والإطلالة خيالية والفريق متعاون جدًا.',
   'Our stay at Dahab Bay Boutique was better than expected. The room was spotless, the view stunning, and the team incredibly helpful.',
   5, 'إقامة في دهب باي البوتيك', 'Stay at Dahab Bay Boutique', 'google', 3, true),
  ('f1000000-0000-4000-8000-000000000002', 'Omar Farouk',
   'رحلة الكانيون الملون كانت من أجمل اللي جربتها في سيناء. المرشد كان محترف والمناظر خيالية.',
   'The Colored Canyon trip was one of the best I''ve done in Sinai. The guide was professional and the scenery was incredible.',
   5, 'رحلة الكانيون الملون', 'Colored Canyon trip', 'facebook', 4, true);

COMMIT;

NOTIFY pgrst, 'reload schema';
