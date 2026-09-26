-- 043_sinai_package_commercial_content.sql
-- Final commercial identities, bilingual copy, and generated editorial heroes
-- for the five existing Sinai experience bundles. Membership and every price
-- field remain untouched; public totals continue to derive from the included
-- trips' existing price/package_price values.

DO $$
BEGIN
  IF (SELECT count(*) FROM public.trip_packages WHERE id IN (
    'f42a7242-cf60-465a-9b35-3b418612d47d',
    '9f235090-41e7-4c21-9cad-64693605c2b2',
    '2853ceb7-b458-485d-ac11-8b6775bf6be9',
    '4be50d9d-fd13-4ef4-ad0b-e7c413293f00',
    'f768c93f-a2a7-44e8-86e2-2dee522cec57'
  )) <> 5 THEN
    RAISE EXCEPTION 'Expected all five production Sinai packages before applying commercial content';
  END IF;
END $$;

-- Refuse the content pass if membership or either pricing authority has
-- drifted from the production snapshot approved for this release.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('f42a7242-cf60-465a-9b35-3b418612d47d'::uuid, 3,  800::numeric,  500::numeric),
      ('9f235090-41e7-4c21-9cad-64693605c2b2'::uuid, 5, 3650::numeric, 2600::numeric),
      ('2853ceb7-b458-485d-ac11-8b6775bf6be9'::uuid, 5, 6150::numeric, 4650::numeric),
      ('4be50d9d-fd13-4ef4-ad0b-e7c413293f00'::uuid, 4, 3950::numeric, 3050::numeric),
      ('f768c93f-a2a7-44e8-86e2-2dee522cec57'::uuid, 4, 3200::numeric, 2500::numeric)
    ) AS expected(package_id, item_count, public_total, package_total)
    LEFT JOIN (
      SELECT items.package_id,
             count(*)::integer AS item_count,
             sum(trips.price)::numeric AS public_total,
             sum(trips.package_price)::numeric AS package_total
      FROM public.trip_package_items AS items
      JOIN public.sinai_trips AS trips ON trips.id = items.trip_id
      GROUP BY items.package_id
    ) AS actual USING (package_id)
    WHERE actual.item_count IS DISTINCT FROM expected.item_count
       OR actual.public_total IS DISTINCT FROM expected.public_total
       OR actual.package_total IS DISTINCT FROM expected.package_total
  ) THEN
    RAISE EXCEPTION 'Sinai package composition or pricing drifted; commercial content was not applied';
  END IF;
END $$;

UPDATE public.trip_packages SET
  name_en = 'Dahab Essentials',
  name_ar = 'أساسيات دهب',
  badge_en = 'Best Value',
  badge_ar = 'أفضل قيمة',
  short_description_en = 'Three easy-going Dahab experiences—Red Sea snorkeling, a mountain night and a bonfire by the Laguna—bundled for exceptional value.',
  short_description_ar = 'ثلاث تجارب خفيفة تعيشك روح دهب: سنوركلينج في البحر الأحمر، ليلة بين الجبال، وبون فاير عند اللاجونا—بسعر يوفر بجد.',
  description_en = 'Start with the clear water and coral scenery of Three Pools, trade the promenade for a night at Jabal Al-Tawilat, then slow things down around a Laguna bonfire. Dahab Essentials is a compact, good-value bundle for travelers who want a real taste of Dahab without building a bigger package. Use the experiences across your trip, subject to availability and operational confirmation. Accommodation is not included. Round-trip pickup and drop-off from your accommodation in Dahab is included with each experience.',
  description_ar = 'ابدأ بمياه الثري بولز والشعاب المرجانية، وغيّر أجواء الممشى بليلة بين جبال جبل الطويلات، وبعدها خليك على الهادي حوالين نار اللاجونا. أساسيات دهب باقة بسيطة وموفرة للي عايز يعيش طعم دهب الحقيقي من غير ما يدخل في باقة كبيرة. تقدر توزع التجارب على رحلتك حسب التوافر والتأكيد التشغيلي. الإقامة غير مشمولة. الاستقبال والتوصيل ذهابًا وعودة من مكان إقامتك داخل دهب مشمول مع كل تجربة.',
  image = '/media/packages/dahab-essentials.webp'
WHERE id = 'f42a7242-cf60-465a-9b35-3b418612d47d' AND slug = 'dahab-on-a-budget';

UPDATE public.trip_packages SET
  name_en = 'The Dahab Mix', name_ar = 'دهب على أصولها',
  badge_en = 'WEEMAP Pick', badge_ar = 'اختيار WEEMAP', featured = true,
  short_description_en = 'Sea, desert, yacht time and nights out—the broadest mix of Dahab and Sinai in one flexible bundle.',
  short_description_ar = 'بحر وصحراء ويخت وسهرات—أكتر باقة متنوعة تعيشك كذا وش من دهب وسيناء.',
  description_en = 'The Dahab Mix brings together several sides of the experience without locking you into a fixed itinerary. Explore the Blue Hole, Ras Abu Galum and Blue Lagoon, take an evening yacht onto the Red Sea, chase sunset through Wadi Gnai and Three Pools, spend a night between Farsha and Sharm’s Old Market, and wind down around a Laguna bonfire. Arrange the experiences across your trip according to availability and operational confirmation. Accommodation is not included. Round-trip pickup and drop-off from your accommodation in Dahab is included with each experience.',
  description_ar = 'دهب على أصولها تجمع لك أكتر من وش للرحلة من غير برنامج ثابت: البلو هول ورأس أبو جالوم والبلو لاجون، خروجة يخت مسائية في البحر الأحمر، سفاري غروب بين وادي جني والثري بولز، ليلة بين فرشة والسوق القديم في شرم، وقعدة بون فاير عند اللاجونا. وزّع التجارب على رحلتك حسب التوافر والتأكيد التشغيلي. الإقامة غير مشمولة. الاستقبال والتوصيل ذهابًا وعودة من مكان إقامتك داخل دهب مشمول مع كل تجربة.',
  image = '/media/packages/the-dahab-mix.webp'
WHERE id = '9f235090-41e7-4c21-9cad-64693605c2b2' AND slug = 'first-time-in-dahab';

UPDATE public.trip_packages SET
  name_en = 'Wild Sinai', name_ar = 'سيناء البرّية', badge_en = 'For Explorers', badge_ar = 'للمغامرين',
  short_description_en = 'Mountains, canyons, desert tracks and a first dive—a high-energy bundle built for people who want to move.',
  short_description_ar = 'جبال ووديان ومسارات صحراوية وأول تجربة غطس—باقة مليانة حركة للمغامرين بجد.',
  description_en = 'Wild Sinai moves between the mountains of Wadi El Weshwash, the overnight climb toward Mount Sinai’s sunrise, an early buggy ride to Panorama, the Colored and White Canyons, and a first scuba experience at Lighthouse. It is the most physical and varied package in the collection, designed for travelers drawn to movement, changing terrain and time in the water. The experiences are arranged across your trip according to availability and operational confirmation, not as consecutive fixed days. Accommodation is not included. Round-trip pickup and drop-off from your accommodation in Dahab is included with each experience.',
  description_ar = 'سيناء البرّية تنقلك بين جبال وادي الوشواش، وصعود جبل موسى وقت الليل للحاق بالشروق، وجولة باجي بدري ناحية البانوراما، والـColored Canyon والـWhite Canyon، وأول تجربة سكوبا في اللايت هاوس. دي أكتر باقة فيها حركة وتنوع في المجموعة، للي بيحب الجبال وتغيّر التضاريس والنزول للمياه. التجارب بتتوزع على رحلتك حسب التوافر والتأكيد التشغيلي، ومش أيام ثابتة ورا بعض. الإقامة غير مشمولة. الاستقبال والتوصيل ذهابًا وعودة من مكان إقامتك داخل دهب مشمول مع كل تجربة.',
  image = '/media/packages/wild-sinai.webp'
WHERE id = '2853ceb7-b458-485d-ac11-8b6775bf6be9' AND slug = 'sinai-adventure-route';

UPDATE public.trip_packages SET
  name_en = 'Into the Blue', name_ar = 'في قلب الأزرق', badge_en = 'Red Sea Essential', badge_ar = 'قلب البحر الأحمر',
  short_description_en = 'Four ways into the Red Sea—from Blue Hole and Three Pools to a yacht day and your first scuba dive.',
  short_description_ar = 'أربع طرق تعيش بيها البحر الأحمر: البلو هول، والثري بولز، ويوم يخت، وأول تجربة سكوبا.',
  description_en = 'Into the Blue is built around time in and on the Red Sea. Explore the Blue Hole, Ras Abu Galum and Blue Lagoon, spend a full morning and afternoon aboard a yacht, snorkel at Three Pools, and take your first scuba dive at Lighthouse. It is a flexible sea-first bundle rather than a fixed schedule, with each experience arranged according to availability and operational confirmation. Accommodation is not included. Round-trip pickup and drop-off from your accommodation in Dahab is included with each experience.',
  description_ar = 'في قلب الأزرق باقة معمولة للوقت اللي هتقضيه جوه البحر الأحمر وفوقه. اكتشف البلو هول ورأس أبو جالوم والبلو لاجون، اقضي يومك على اليخت، اعمل سنوركلينج في الثري بولز، وخد أول تجربة سكوبا في اللايت هاوس. دي باقة بحر مرنة مش جدول ثابت، وكل تجربة بتتحدد حسب التوافر والتأكيد التشغيلي. الإقامة غير مشمولة. الاستقبال والتوصيل ذهابًا وعودة من مكان إقامتك داخل دهب مشمول مع كل تجربة.',
  image = '/media/packages/into-the-blue.webp'
WHERE id = '4be50d9d-fd13-4ef4-ad0b-e7c413293f00' AND slug = 'dahab-red-sea-weekender';

UPDATE public.trip_packages SET
  name_en = 'Sinai After Dark', name_ar = 'سيناء بعد الغروب', badge_en = 'After Dark', badge_ar = 'بعد الغروب',
  short_description_en = 'Ride into sunset, follow the lights to Sharm, gather by the fire and catch Sinai’s selected-night electronic scene.',
  short_description_ar = 'اركب مع الغروب، اتبع نور شرم، اقعد حوالين النار، والحق ليالي سيناء الإلكترونية المختارة.',
  description_en = 'Sinai After Dark follows the landscape from golden hour into the night: a guided horse ride around Dahab Lagoon, Farsha and the Old Market in Sharm, a relaxed Laguna bonfire, and—when the event calendar lines up—a mountain night of Techno and House. The rave operates only on selected event nights; its final date and location are confirmed before booking. Experiences can be arranged across your trip according to availability and operational confirmation. Accommodation is not included. Round-trip pickup and drop-off from your accommodation in Dahab is included with each experience.',
  description_ar = 'سيناء بعد الغروب تبدأ مع آخر ضوء وتكمل لحد الليل: جولة خيل حوالين لاجونا دهب، ليلة بين فرشة والسوق القديم في شرم، قعدة بون فاير هادية، ولما مواعيد الإيفنتات تسمح—ليلة Techno وHouse بين الجبال. حفلة الرايف بتشتغل في ليالي إيفنتات مختارة فقط، والتاريخ والمكان النهائيين بيتأكدوا قبل الحجز. تقدر توزع التجارب على رحلتك حسب التوافر والتأكيد التشغيلي. الإقامة غير مشمولة. الاستقبال والتوصيل ذهابًا وعودة من مكان إقامتك داخل دهب مشمول مع كل تجربة.',
  image = '/media/packages/sinai-after-dark.webp'
WHERE id = 'f768c93f-a2a7-44e8-86e2-2dee522cec57' AND slug = 'dahab-after-dark';

-- The featured state belongs to The Dahab Mix alone.
UPDATE public.trip_packages
SET featured = false
WHERE id <> '9f235090-41e7-4c21-9cad-64693605c2b2' AND featured = true;
