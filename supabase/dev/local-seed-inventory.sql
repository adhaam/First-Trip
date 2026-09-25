-- ═══════════════════════════════════════════════════════════════════════════
-- LOCAL ACCEPTANCE FIXTURES — NEVER APPLY TO PRODUCTION
-- ───────────────────────────────────────────────────────────────────────────
-- Separately-appliable inventory fixture: 4 active merch (sale) products with
-- variants/stock, and 3 active rental products with rental tiers. Depends on
-- the commerce_categories rows created by local-seed.sql (run that first).
--
-- Toggle with scripts/local-stack/inventory.sh:
--   inventory.sh on   -> applies this file (products become active/visible)
--   inventory.sh off  -> deactivates/deletes everything this file created
--
-- Lets you test that storefront inventory appears purely from data, with no
-- code changes, by flipping the toggle and reloading the site.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Clean slate for this file's rows only (fixed ids => safe to re-run).
DELETE FROM public.rental_pricing_tiers WHERE product_id IN (
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000003'
);
DELETE FROM public.commerce_product_variants WHERE product_id IN (
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000003',
  '31000000-0000-4000-8000-000000000004'
);
DELETE FROM public.commerce_product_option_values WHERE option_id IN (
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000003'
);
DELETE FROM public.commerce_product_options WHERE product_id IN (
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000003',
  '31000000-0000-4000-8000-000000000004'
);
DELETE FROM public.commerce_products WHERE id IN (
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000003',
  '31000000-0000-4000-8000-000000000004',
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000003'
);

-- ─────────────────────────────────────────────────────────────────────────
-- Merch (sale) products
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.commerce_products (
  id, category_id, product_type, slug, name_ar, name_en, description_ar, description_en,
  images, base_price, sku, track_inventory, requires_delivery, pickup_enabled, delivery_enabled,
  is_active, is_featured, sort_order
) VALUES
(
  '31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000004', 'sale',
  'weemap-desert-explorer-tshirt', 'تيشيرت WEEMAP ديزرت إكسبلورر', 'WEEMAP Desert Explorer T-Shirt',
  'تيشيرت قطن ١٠٠٪ بتصميم مستوحى من صحراء سيناء.', '100% cotton t-shirt with a design inspired by the Sinai desert.',
  ARRAY[]::text[],
  350, 'WM-TS-001', true, true, true, true, true, true, 0
),
(
  '31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000004', 'sale',
  'sinai-bedouin-shemagh-scarf', 'وشاح بدوي سيناوي', 'Sinai Bedouin Shemagh Scarf',
  'وشاح قطني تقليدي بألوان بدوية أصيلة.', 'A traditional cotton scarf in genuine Bedouin colors.',
  ARRAY[]::text[],
  250, 'WM-SC-001', true, true, true, true, true, false, 1
),
(
  '31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'sale',
  'dahab-dive-mask-snorkel-set', 'طقم قناع وسنوركل دهب', 'Dahab Dive Mask & Snorkel Set',
  'طقم قناع وأنبوب تنفس عالي الجودة مناسب لكل الأعمار.', 'A high-quality mask and snorkel set suitable for all ages.',
  ARRAY[]::text[],
  900, 'WM-DV-001', true, true, true, true, true, true, 2
),
(
  '31000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000002', 'sale',
  'weemap-insulated-water-bottle', 'ترمس WEEMAP الحراري', 'WEEMAP Insulated Water Bottle',
  'ترمس ستانلس ستيل يحافظ على برودة المياه طوال رحلات الصحراء.', 'A stainless-steel bottle that keeps water cold throughout desert trips.',
  ARRAY[]::text[],
  300, 'WM-BT-001', true, true, true, true, true, false, 3
);

-- Options + values (Size for the t-shirt, Color for the scarf and bottle)
INSERT INTO public.commerce_product_options (id, product_id, name_ar, name_en, sort_order) VALUES
  ('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'المقاس', 'Size', 0),
  ('33000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', 'اللون', 'Color', 0),
  ('33000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004', 'اللون', 'Color', 0);

INSERT INTO public.commerce_product_option_values (id, option_id, value_ar, value_en, sort_order) VALUES
  ('34000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'صغير', 'S', 0),
  ('34000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', 'وسط', 'M', 1),
  ('34000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000001', 'كبير', 'L', 2),
  ('34000000-0000-4000-8000-000000000004', '33000000-0000-4000-8000-000000000001', 'كبير جدًا', 'XL', 3),
  ('34000000-0000-4000-8000-000000000005', '33000000-0000-4000-8000-000000000002', 'أسود', 'Black', 0),
  ('34000000-0000-4000-8000-000000000006', '33000000-0000-4000-8000-000000000002', 'أحمر', 'Red', 1),
  ('34000000-0000-4000-8000-000000000007', '33000000-0000-4000-8000-000000000002', 'أزرق', 'Blue', 2),
  ('34000000-0000-4000-8000-000000000008', '33000000-0000-4000-8000-000000000003', 'أسود', 'Black', 0),
  ('34000000-0000-4000-8000-000000000009', '33000000-0000-4000-8000-000000000003', 'أزرق', 'Blue', 1),
  ('3400000a-0000-4000-8000-000000000010', '33000000-0000-4000-8000-000000000003', 'أخضر', 'Green', 2);

-- Variants (with stock)
INSERT INTO public.commerce_product_variants (id, product_id, sku, option_value_ids, price_override, inventory_quantity, is_active, sort_order) VALUES
  ('35000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'WM-TS-001-S',  ARRAY['34000000-0000-4000-8000-000000000001'::uuid], NULL, 18, true, 0),
  ('35000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'WM-TS-001-M',  ARRAY['34000000-0000-4000-8000-000000000002'::uuid], NULL, 24, true, 1),
  ('35000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001', 'WM-TS-001-L',  ARRAY['34000000-0000-4000-8000-000000000003'::uuid], NULL, 20, true, 2),
  ('35000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'WM-TS-001-XL', ARRAY['34000000-0000-4000-8000-000000000004'::uuid], NULL, 10, true, 3),
  ('35000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000002', 'WM-SC-001-BLK', ARRAY['34000000-0000-4000-8000-000000000005'::uuid], NULL, 15, true, 0),
  ('35000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000002', 'WM-SC-001-RED', ARRAY['34000000-0000-4000-8000-000000000006'::uuid], NULL, 12, true, 1),
  ('35000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000002', 'WM-SC-001-BLU', ARRAY['34000000-0000-4000-8000-000000000007'::uuid], NULL, 12, true, 2),
  ('35000000-0000-4000-8000-000000000008', '31000000-0000-4000-8000-000000000003', 'WM-DV-001',     ARRAY[]::uuid[], NULL, 9,  true, 0),
  ('35000000-0000-4000-8000-000000000009', '31000000-0000-4000-8000-000000000004', 'WM-BT-001-BLK', ARRAY['34000000-0000-4000-8000-000000000008'::uuid], NULL, 20, true, 0),
  ('3500000a-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000004', 'WM-BT-001-BLU', ARRAY['34000000-0000-4000-8000-000000000009'::uuid], NULL, 20, true, 1),
  ('3500000b-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000004', 'WM-BT-001-GRN', ARRAY['3400000a-0000-4000-8000-000000000010'::uuid], NULL, 20, true, 2);

-- ─────────────────────────────────────────────────────────────────────────
-- Rental products
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.commerce_products (
  id, category_id, product_type, slug, name_ar, name_en, description_ar, description_en,
  images, base_price, sku, track_inventory, requires_delivery, pickup_enabled, delivery_enabled,
  deposit_amount, rental_requirements, is_active, is_featured, sort_order
) VALUES
(
  '32000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'rental',
  'full-scuba-diving-gear-set', 'طقم معدات غوص كامل', 'Full Scuba Diving Gear Set',
  'طقم غوص كامل يشمل بدلة وBCD ومنظم، مناسب للغطاسين المعتمدين.', 'A complete scuba set including wetsuit, BCD and regulator, for certified divers.',
  ARRAY[]::text[],
  0, 'WM-RN-DV-001', true, true, true, false,
  1500, ARRAY['id_required', 'dive_certification_required'], true, true, 0
),
(
  '32000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000003', 'rental',
  'mountain-bike-rental', 'إيجار دراجة جبلية', 'Mountain Bike Rental',
  'دراجة جبلية بحالة ممتازة مناسبة لطرق دهب والصحراء المحيطة.', 'A well-maintained mountain bike suitable for Dahab''s roads and surrounding desert.',
  ARRAY[]::text[],
  0, 'WM-RN-BK-001', true, true, true, true,
  500, ARRAY['id_required'], true, false, 1
),
(
  '32000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000003', 'rental',
  'kayak-rental-single', 'إيجار كاياك فردي', 'Kayak Rental (Single)',
  'كاياك فردي مثالي لاستكشاف اللاجونة والساحل الهادئ.', 'A single kayak, perfect for exploring the Lagoon and the calm coastline.',
  ARRAY[]::text[],
  0, 'WM-RN-KY-001', true, true, true, false,
  300, ARRAY['id_required'], true, false, 2
);

INSERT INTO public.rental_pricing_tiers (id, product_id, variant_id, duration_days, label_ar, label_en, price, sort_order, is_active) VALUES
  ('36000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', NULL, 1, 'يوم واحد', '1 Day', 600, 0, true),
  ('36000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', NULL, 3, '٣ أيام', '3 Days', 1500, 1, true),
  ('36000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', NULL, 7, '٧ أيام', '7 Days', 3000, 2, true),
  ('36000000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000002', NULL, 1, 'يوم واحد', '1 Day', 250, 0, true),
  ('36000000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000002', NULL, 3, '٣ أيام', '3 Days', 650, 1, true),
  ('36000000-0000-4000-8000-000000000006', '32000000-0000-4000-8000-000000000002', NULL, 7, '٧ أيام', '7 Days', 1300, 2, true),
  ('36000000-0000-4000-8000-000000000007', '32000000-0000-4000-8000-000000000003', NULL, 1, 'يوم واحد', '1 Day', 300, 0, true),
  ('36000000-0000-4000-8000-000000000008', '32000000-0000-4000-8000-000000000003', NULL, 3, '٣ أيام', '3 Days', 800, 1, true);

COMMIT;

NOTIFY pgrst, 'reload schema';
